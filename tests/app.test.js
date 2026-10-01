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
        document: { addEventListener() {}, ...overrides.document },
        window: overrides.window || {}
    };

    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'utils.js'), 'utf8'), context);
    context.Utils = { ...context.window.Utils, ...context.Utils, ...overrides.utils };
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

function fixtureRow(overrides = {}) {
    return { name: '合成測試水庫', county: '測試縣', region: 'north', percentage: 25,
        effective_capacity: 100, effective_water_storage: 25, observed_at: Date.now(), capacity_recorded_at: null, ...overrides };
}

test('volume overview exposes the weighted numerator and denominator with explicit scope', () => {
    const App = loadReservoirApp();
    const app = Object.create(App.prototype);
    app.state = { data: { a: fixtureRow({ effective_water_storage: 5, percentage: 5 }), b: fixtureRow({ effective_capacity: 900, effective_water_storage: 810, percentage: 90 }) }, metadata: { expected: 20 } };
    app.elements = { statsGrid: { innerHTML: '' } };
    app.renderStats();
    const html = app.elements.statsGrid.innerHTML;
    assert.match(html, /81\.5/);
    assert.match(html, /815/);
    assert.match(html, /1,000/);
    assert.match(html, /2\/20/);
    assert.match(html, /部分資料缺漏/);
    assert.match(html, /非全台總量、非同時刻觀測/);
    assert.doesNotMatch(html, /47\.5/);
});

test('above-capacity readings survive both overview and cards; only drawings are clamped', () => {
    const App = loadReservoirApp();
    const app = Object.create(App.prototype);
    app.state = { currentRegion: 'all', data: { a: fixtureRow({ percentage: 110, effective_water_storage: 110 }) } };
    app.elements = { statsGrid: { innerHTML: '' }, reservoirsGrid: { innerHTML: '' } };
    app.renderStats();
    app.renderReservoirGrid();
    for (const element of Object.values(app.elements)) {
        assert.match(element.innerHTML, /110\.0/);
        assert.match(element.innerHTML, /--progress-width: 100%/);
        assert.match(element.innerHTML, /數值如實保留/);
    }
});

test('card values remain separate from drawing, metadata is explicit, and names are escaped', () => {
    const App = loadReservoirApp();
    const app = Object.create(App.prototype);
    app.state = { currentRegion: 'all', data: { a: fixtureRow({ name: '長名字 <測試> "水庫"', percentage: 0, effective_water_storage: 0 }) } };
    app.elements = { reservoirsGrid: { innerHTML: '' } };
    app.renderReservoirGrid();
    const html = app.elements.reservoirsGrid.innerHTML;
    assert.match(html, /&lt;測試&gt; &quot;水庫&quot;/);
    assert.match(html, /<article[^>]+tabindex="-1"/);
    assert.match(html, /<h3 class="reservoir-name">/);
    assert.match(html, /--progress-width: 0%/);
    assert.match(html, /water-bar-content[\s\S]+<div class="water-bar" aria-hidden="true"/);
    assert.match(html, /萬立方公尺/);
    assert.match(html, /容量資料：時間未知/);
});

test('chart failure leaves every raw value and a keyboard-operable reservoir action', () => {
    const App = loadReservoirApp({ window: { chartManager: { createOverviewChart: () => null } } });
    const app = Object.create(App.prototype);
    app.state = { data: { a: fixtureRow({ name: '高庫', percentage: 110 }), b: fixtureRow({ name: '低庫', percentage: 5 }) } };
    app.elements = { overviewChart: {}, overviewDetail: { open: true }, overviewList: { innerHTML: '' }, chartFrame: { style: {} }, chartStatus: {} };
    app.renderOverviewChart();
    assert.equal(app.elements.chartFrame.hidden, true);
    assert.match(app.elements.chartStatus.textContent, /圖表暫時無法載入/);
    assert.match(app.elements.overviewList.innerHTML, /<button type="button"/);
    assert.match(app.elements.overviewList.innerHTML, /110\.0%/);
    assert.match(app.elements.overviewList.innerHTML, /5\.0%/);
    assert.ok(app.elements.overviewList.innerHTML.indexOf('低庫') < app.elements.overviewList.innerHTML.indexOf('高庫'));
    app.state.data = {};
    app.renderOverviewChart();
    assert.doesNotMatch(app.elements.overviewList.innerHTML, /高庫|低庫|110\.0/);
    assert.match(app.elements.chartStatus.textContent, /尚無可用資料/);
});

test('collapsed comparison defers optional chart work while preserving native text', () => {
    let renders = 0;
    const App = loadReservoirApp({ window: { chartManager: { createOverviewChart: () => { renders += 1; return {}; } } } });
    const app = Object.create(App.prototype);
    app.state = { data: { a: fixtureRow() } };
    app.elements = { overviewChart: {}, overviewDetail: { open: false }, overviewList: {}, chartFrame: { style: {} }, chartStatus: {} };
    app.renderOverviewChart();
    assert.equal(renders, 0);
    assert.match(app.elements.overviewList.innerHTML, /25\.0%/);
    app.elements.overviewDetail.open = true;
    app.renderOverviewChart();
    assert.equal(renders, 1);
    assert.equal(app.elements.chartFrame.hidden, false);
});

test('region summary distinguishes no snapshot, partial region coverage, and unmapped east', () => {
    const App = loadReservoirApp();
    const app = Object.create(App.prototype);
    app.elements = { reservoirsGrid: {}, regionSummary: {} };
    app.state = { data: {}, currentRegion: 'north' };
    app.renderReservoirGrid();
    assert.match(app.elements.regionSummary.textContent, /尚無可用快照/);
    assert.doesNotMatch(app.elements.regionSummary.textContent, /0\/5/);
    app.state.data = { a: fixtureRow() };
    app.renderReservoirGrid();
    assert.match(app.elements.regionSummary.textContent, /1\/5/);
    app.state.currentRegion = 'east';
    app.renderReservoirGrid();
    assert.match(app.elements.regionSummary.textContent, /尚未納入/);
    assert.match(app.elements.reservoirsGrid.innerHTML, /data-reset-region/);
});

test('detail navigation reveals a hidden reservoir before moving focus, and unknown targets do nothing', () => {
    const order = [];
    const card = { dataset: { reservoir: '南方測試庫' }, focus: options => { assert.equal(options.preventScroll, true); order.push('focus'); } };
    const App = loadReservoirApp({ document: { querySelectorAll: () => [card] }, utils: { scrollToElement: () => order.push('scroll') } });
    const app = Object.create(App.prototype);
    app.state = { currentRegion: 'north', data: { a: fixtureRow({ name: '南方測試庫', region: 'south' }) } };
    app.setCurrentRegion = region => { assert.equal(region, 'south'); app.state.currentRegion = region; order.push('region'); };
    assert.equal(app.scrollToReservoir('南方測試庫'), true);
    assert.deepEqual(order, ['region', 'focus', 'scroll']);
    assert.equal(app.scrollToReservoir('missing'), false);
    assert.deepEqual(order, ['region', 'focus', 'scroll']);
});

test('filter arrows and Home/End select predictably, retain focus, and leave Tab native', () => {
    const buttons = ['all', 'north', 'central', 'south', 'east'].map(region => ({
        dataset: { region }, handlers: {}, focused: false,
        addEventListener(name, handler) { this.handlers[name] = handler; },
        focus() { this.focused = true; }
    }));
    const App = loadReservoirApp({ window: { addEventListener() {}, api: { on() {} } } });
    const app = Object.create(App.prototype);
    app.elements = { regionBtns: buttons };
    const regions = [];
    app.setCurrentRegion = region => regions.push(region);
    app.bindEvents();
    let prevented = 0;
    const key = value => ({ key: value, preventDefault() { prevented += 1; } });
    buttons[0].handlers.keydown(key('ArrowLeft'));
    assert.equal(buttons[4].focused, true);
    buttons[4].handlers.keydown(key('Home'));
    buttons[0].handlers.keydown(key('End'));
    buttons[4].handlers.keydown(key('ArrowRight'));
    buttons[0].handlers.keydown(key('Tab'));
    assert.deepEqual(regions, ['east', 'all', 'east', 'all']);
    assert.equal(prevented, 4);
});

test('delegated alert/list actions do not install inline handlers or reset the page hash', () => {
    const App = loadReservoirApp();
    const app = Object.create(App.prototype);
    app.state = { data: { a: fixtureRow() } };
    app.elements = { alertsSection: { style: {} }, alertsContainer: {} };
    app.renderAlerts();
    assert.match(app.elements.alertsContainer.innerHTML, /<button[^>]+data-reservoir-target=/);
    assert.doesNotMatch(app.elements.alertsContainer.innerHTML, /onclick=|href="#"/);
    assert.match(app.elements.alertsContainer.innerHTML, /不是官方限水或停水警報/);
});

test('refresh pending label matches disabled state and repeated clicks do not duplicate requests', async () => {
    const App = loadReservoirApp();
    const app = Object.create(App.prototype);
    app.state = {};
    app.elements = { refreshBtn: { classList: { toggle() {} } }, refreshLabel: {} };
    app.emit = () => {};
    app.setLoading(true);
    assert.equal(app.elements.refreshBtn.disabled, true);
    assert.equal(app.elements.refreshLabel.textContent, '擷取中…');
    let requests = 0;
    app.loadData = () => { requests += 1; };
    await app.refreshData();
    await app.refreshData();
    assert.equal(requests, 0);
    app.setLoading(false);
    assert.equal(app.elements.refreshBtn.disabled, false);
    assert.equal(app.elements.refreshLabel.textContent, '重新擷取資料');
});

test('background rerenders restore the same station focus and fall back safely when it disappears', () => {
    const active = { dataset: { reservoirTarget: '合成測試水庫' } };
    const actions = [];
    const replacement = { dataset: { reservoirTarget: '合成測試水庫' }, focus: options => actions.push(['station', options.preventScroll]) };
    let nodes = [replacement];
    const element = { contains: node => node === active, querySelectorAll: () => nodes, innerHTML: '' };
    const App = loadReservoirApp({ document: { activeElement: active } });
    const app = Object.create(App.prototype);
    app.elements = { refreshBtn: { focus: options => actions.push(['refresh', options.preventScroll]) } };
    app.replaceContent(element, '<button>new snapshot</button>');
    assert.deepEqual(actions, [['station', true]]);
    nodes = [];
    app.replaceContent(element, '<p>unavailable</p>');
    assert.deepEqual(actions, [['station', true], ['refresh', true]]);
});

test('initial loading block leaves layout before the main page is revealed', () => {
    const App = loadReservoirApp();
    const app = Object.create(App.prototype);
    app.elements = { loadingScreen: {}, mainContainer: { classList: { remove: value => {
        assert.equal(value, 'hidden');
        assert.equal(app.elements.loadingScreen.hidden, true);
    } } } };
    app.hideLoadingScreen();
});

test('a valid snapshot missing a whole mapped region does not claim all data failed', () => {
    const App = loadReservoirApp();
    const app = Object.create(App.prototype);
    app.state = { currentRegion: 'north', data: { southern: fixtureRow({ region: 'south' }) } };
    app.elements = { reservoirsGrid: {}, regionSummary: {} };
    app.renderReservoirGrid();
    assert.match(app.elements.regionSummary.textContent, /0\/5/);
    assert.match(app.elements.reservoirsGrid.innerHTML, /本次快照未包含此地區/);
    assert.match(app.elements.reservoirsGrid.innerHTML, /其他地區資料仍可查看/);
    assert.doesNotMatch(app.elements.reservoirsGrid.innerHTML, /目前沒有通過資料檢查的水庫快照/);
});

test('disappearing low-fill alerts remove stale text and hand focus back to refresh', () => {
    const active = { dataset: { reservoirTarget: '合成測試水庫' } };
    let focused = 0;
    const App = loadReservoirApp({ document: { activeElement: active } });
    const app = Object.create(App.prototype);
    app.state = { data: {} };
    app.elements = { alertsContainer: { innerHTML: 'old reading', contains: () => true, querySelectorAll: () => [] }, alertsSection: { style: {} }, refreshBtn: { focus: () => { focused += 1; } } };
    app.renderAlerts();
    assert.equal(app.elements.alertsContainer.innerHTML, '');
    assert.equal(app.elements.alertsSection.style.display, 'none');
    assert.equal(focused, 1);
});

test('background refresh also preserves the empty-region reset action focus', () => {
    const active = { dataset: {}, hasAttribute: name => name === 'data-reset-region' };
    let focus = 0;
    const replacement = { dataset: {}, hasAttribute: name => name === 'data-reset-region', focus: () => { focus += 1; } };
    const App = loadReservoirApp({ document: { activeElement: active } });
    const app = Object.create(App.prototype);
    app.elements = {};
    const container = { contains: () => true, querySelectorAll: () => [replacement] };
    app.replaceContent(container, '<button data-reset-region>查看全部清單</button>');
    assert.equal(focus, 1);
});
