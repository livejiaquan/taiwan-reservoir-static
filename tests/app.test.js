const assert = require('node:assert/strict');
const test = require('node:test');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

class EventEmitter {}

function loadReservoirApp(overrides = {}) {
    const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'main.js'), 'utf8');
    const context = {
        console: { log() {}, warn() {}, error() {} },
        clearInterval,
        setInterval: overrides.setInterval || setInterval,
        setTimeout,
        Utils: { EventEmitter },
        document: { addEventListener() {} },
        window: overrides.window || {}
    };

    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'utils.js'), 'utf8'), context);
    context.Utils = { ...context.window.Utils, ...context.Utils };
    vm.runInNewContext(source, context, { filename: 'js/main.js' });
    return context.window.ReservoirApp;
}

test('failed refresh clears previously displayed readings', () => {
    const ReservoirApp = loadReservoirApp();
    const app = Object.create(ReservoirApp.prototype);
    let destroyed = 0;
    let rendered = 0;

    app.state = {
        data: { stale: { percentage: 80 } },
        lastUpdate: new Date()
    };
    app.elements = {
        lastUpdateTime: { textContent: 'previous time' }
    };
    app.renderAll = () => { rendered += 1; };
    app.window = undefined;

    const previousWindow = global.window;
    try {
        global.window = { chartManager: { destroyChart: () => { destroyed += 1; } } };
        app.clearDisplayedData(global.window.chartManager);
    } finally {
        global.window = previousWindow;
    }

    assert.equal(Object.keys(app.state.data).length, 0);
    assert.equal(app.state.lastUpdate, null);
    assert.equal(app.elements.lastUpdateTime.textContent, '--');
    assert.equal(destroyed, 1);
    assert.equal(rendered, 1);
});

test('initial failure still starts automatic recovery', async () => {
    const ReservoirApp = loadReservoirApp();
    const app = Object.create(ReservoirApp.prototype);
    let refreshStarted = 0;

    app.bindEvents = () => {};
    app.loadData = async () => { throw new Error('offline'); };
    app.hideLoadingScreen = () => {};
    app.startAutoRefresh = () => { refreshStarted += 1; };
    app.setupScrollListeners = () => {};
    app.setDataStatus = () => {};
    app.showError = () => {};

    await app.init();
    assert.equal(refreshStarted, 1);
});

test('automatic refresh handles rejected data loads', async () => {
    let timerCallback;
    const ReservoirApp = loadReservoirApp({
        setInterval: callback => {
            timerCallback = callback;
            return 123;
        }
    });
    const app = Object.create(ReservoirApp.prototype);
    app.state = { refreshInterval: null, autoRefresh: true, isLoading: false };
    app.loadData = async () => { throw new Error('offline'); };

    app.startAutoRefresh();
    await assert.doesNotReject(() => timerCallback());
});

test('fetch errors invoke the fail-closed cleanup path', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'main.js'), 'utf8');
    assert.match(source, /on\('fetchError',[\s\S]*?this\.clearDisplayedData\(window\.chartManager\)/);
});


test('source context names missing coverage without treating it as zero water', () => {
    const ReservoirApp = loadReservoirApp();
    const app = Object.create(ReservoirApp.prototype);
    app.elements = Object.fromEntries(['observationRange', 'coverageSummary', 'missingStations', 'capacityTimeNote'].map(key => [key, { textContent: '' }]));
    app.state = { metadata: { observedFrom: 1790740800000, observedTo: 1790744400000, covered: 19, expected: 20, missing: ['霧社水庫'], unknownCapacityTimes: 1 } };
    app.renderSourceContext();
    assert.match(app.elements.coverageSummary.textContent, /19\/20/);
    assert.match(app.elements.missingStations.textContent, /霧社水庫/);
    assert.match(app.elements.missingStations.textContent, /不代表蓄水量為零/);
    assert.match(app.elements.capacityTimeNote.textContent, /1 座.*未知/);
    assert.match(app.elements.observationRange.textContent, /台北 UTC\+8/);
    app.state.metadata = null;
    app.renderSourceContext();
    assert.match(app.elements.coverageSummary.textContent, /涵蓋狀況未知/);
    assert.equal(app.elements.missingStations.textContent, '');
});

test('East empty state explains unmapped coverage, not an eastern API failure', () => {
    const ReservoirApp = loadReservoirApp();
    const app = Object.create(ReservoirApp.prototype);
    app.elements = { reservoirsGrid: { innerHTML: '' } };
    app.state = { data: {}, currentRegion: 'east' };
    app.renderReservoirGrid();
    assert.match(app.elements.reservoirsGrid.innerHTML, /本站尚未納入東部水庫/);
    assert.match(app.elements.reservoirsGrid.innerHTML, /不代表.*官方 API 故障/);
    app.state.currentRegion = 'north';
    app.renderReservoirGrid();
    assert.match(app.elements.reservoirsGrid.innerHTML, /暫無可用水庫資料/);
    assert.doesNotMatch(app.elements.reservoirsGrid.innerHTML, /本站尚未納入東部水庫/);
});

test('rendered total is capacity weighted and card times have distinct labels', () => {
    const ReservoirApp = loadReservoirApp();
    const app = Object.create(ReservoirApp.prototype);
    const small = { name: '測試小庫', county: '測試', region: 'north', percentage: 100, effective_capacity: 100, effective_water_storage: 100, observed_at: Date.now(), capacity_recorded_at: null };
    const large = { ...small, name: '測試大庫', percentage: 10, effective_capacity: 900, effective_water_storage: 90 };
    app.state = { data: { small, large }, currentRegion: 'all' };
    app.elements = { statsGrid: { innerHTML: '' }, reservoirsGrid: { innerHTML: '' } };
    app.renderStats();
    assert.match(app.elements.statsGrid.innerHTML, /19\.0/);
    assert.match(app.elements.statsGrid.innerHTML, /合計蓄水率（容量加權）/);
    assert.doesNotMatch(app.elements.statsGrid.innerHTML, /55\.0|平均蓄水率/);
    app.renderReservoirGrid();
    assert.match(app.elements.reservoirsGrid.innerHTML, /水量觀測：/);
    assert.match(app.elements.reservoirsGrid.innerHTML, /容量資料：時間未知/);
});

test('fetch-success uses cached network time and the load path does not overwrite it', async () => {
    const handlers = {};
    const fetchedAt = Date.now() - 120000;
    const data = { sample: {} };
    const metadata = { fetchedAt, observedFrom: fetchedAt, observedTo: fetchedAt, covered: 20, expected: 20 };
    const fakeWindow = {
        addEventListener() {},
        api: {
            on: (name, callback) => { handlers[name] = callback; },
            getSnapshotMetadata: () => metadata,
            fetchReservoirData: async () => { handlers.fetchSuccess(data); return data; }
        }
    };
    const ReservoirApp = loadReservoirApp({ window: fakeWindow });
    const app = Object.create(ReservoirApp.prototype);
    app.state = {};
    app.elements = { regionBtns: [] };
    app.setLoading = () => {};
    app.setDataStatus = () => {};
    app.renderAll = () => {};
    app.bindEvents();
    await app.loadData();
    assert.equal(app.state.lastUpdate, fetchedAt);
    assert.equal(app.state.metadata, metadata);
});
