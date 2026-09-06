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
        window: {}
    };

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
