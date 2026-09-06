const assert = require('node:assert/strict');
const test = require('node:test');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

class EventEmitter {
    constructor() {
        this.events = new Map();
    }

    on(event, listener) {
        const listeners = this.events.get(event) || [];
        listeners.push(listener);
        this.events.set(event, listeners);
    }

    emit(event, payload) {
        for (const listener of this.events.get(event) || []) {
            listener(payload);
        }
    }
}

function loadReservoirAPI() {
    const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'api.js'), 'utf8');
    const storage = new Map();
    const context = {
        AbortController,
        Date,
        Map,
        Object,
        console: { log() {}, warn() {}, error() {} },
        fetch,
        setTimeout,
        clearTimeout,
        Utils: {
            EventEmitter,
            LocalStorage: {
                get: key => storage.get(key) || null,
                set: (key, value) => storage.set(key, value),
                remove: key => storage.delete(key)
            },
            handleError: error => ({ message: error.message })
        },
        getMockReservoirData: async () => {
            throw new Error('mock data must not be used as live reservoir data');
        },
        window: {}
    };

    vm.runInNewContext(source, context, { filename: 'js/api.js' });
    return context.window.ReservoirAPI;
}

function buildSnapshot(api, updateTime, count = 10) {
    return Object.fromEntries(
        Object.keys(api.stationMapping).slice(0, count).map((stationNo, index) => [
            `reservoir-${index}`,
            { station_no: stationNo, update_time: updateTime }
        ])
    );
}

test('API failure is surfaced instead of displaying simulated live data', async () => {
    const ReservoirAPI = loadReservoirAPI();
    const api = new ReservoirAPI();
    const errors = [];

    api.requestConfig.retries = 0;
    api.cache.data = { stale: { percentage: 80 } };
    api.cache.timestamp = Date.now();
    api.makeRequest = async () => {
        throw new Error('upstream returned HTML');
    };
    api.on('fetchError', error => errors.push(error));

    await assert.rejects(
        api.fetchReservoirData(true),
        /水利署資料目前無法取得/
    );
    assert.equal(errors.length, 1);
    assert.match(errors[0].message, /水利署資料目前無法取得/);
    assert.equal(api.cache.data, null);
    assert.equal(api.cache.timestamp, null);
});

test('partial official snapshots are rejected instead of marked verified', async () => {
    const ReservoirAPI = loadReservoirAPI();
    const api = new ReservoirAPI();
    const now = new Date().toISOString().slice(0, 16).replace('T', ' ');

    api.requestConfig.retries = 0;
    api.makeRequest = async () => ({ json: async () => [] });
    api.parseOpenData = () => ({
        only: { update_time: now }
    });

    await assert.rejects(api.fetchReservoirData(true), /涵蓋不足/);
    assert.equal(api.cache.data, null);
});

test('stale official snapshots are rejected instead of marked verified', async () => {
    const ReservoirAPI = loadReservoirAPI();
    const api = new ReservoirAPI();
    const staleTime = new Date(Date.now() - 72 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 16)
        .replace('T', ' ');
    const snapshot = buildSnapshot(api, staleTime);

    api.requestConfig.retries = 0;
    api.makeRequest = async () => ({ json: async () => [] });
    api.parseOpenData = () => snapshot;

    await assert.rejects(api.fetchReservoirData(true), /資料過期/);
    assert.equal(api.cache.data, null);
});

test('cached snapshots are revalidated before display', () => {
    const ReservoirAPI = loadReservoirAPI();
    const api = new ReservoirAPI();
    const staleTime = new Date(Date.now() - 72 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 16)
        .replace('T', ' ');

    api.cache.data = buildSnapshot(api, staleTime);
    api.cache.timestamp = Date.now();

    assert.equal(api.getCachedData(), null);
    assert.equal(api.cache.data, null);
});

test('impossible calendar dates are rejected', () => {
    const ReservoirAPI = loadReservoirAPI();
    const api = new ReservoirAPI();
    const snapshot = buildSnapshot(api, '2026-02-30 12:00');

    assert.throws(() => api.validateSnapshot(snapshot), /有效觀測時間/);
});

test('duplicate station identifiers do not satisfy mapped coverage', () => {
    const ReservoirAPI = loadReservoirAPI();
    const api = new ReservoirAPI();
    const now = new Date().toISOString().slice(0, 16).replace('T', ' ');
    const stationNo = Object.keys(api.stationMapping)[0];
    const snapshot = Object.fromEntries(
        Array.from({ length: 10 }, (_, index) => [
            `reservoir-${index}`,
            { station_no: stationNo, update_time: now }
        ])
    );

    assert.throws(() => api.validateSnapshot(snapshot), /涵蓋不足/);
});
