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

    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'utils.js'), 'utf8'), context);
    context.Utils = { ...context.window.Utils, ...context.Utils };
    vm.runInNewContext(source, context, { filename: 'js/api.js' });
    return context.window.ReservoirAPI;
}

function parseTime(value) {
    const context = { window: {} };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'utils.js'), 'utf8'), context);
    return context.window.Utils.parseSourceTime(value);
}

function buildSnapshot(api, updateTime, count = 10) {
    return Object.fromEntries(
        Object.keys(api.stationMapping).slice(0, count).map((stationNo, index) => [
            `reservoir-${index}`,
            { station_no: stationNo, observed_at: parseTime(updateTime), effective_capacity: 100, effective_water_storage: 60, percentage: 60 }
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

function sampleSources(api, time = '2026-09-30T12:00:00', count = 20) {
    const ids = Object.keys(api.stationMapping).slice(0, count);
    return {
        realtime: ids.map(reservoiridentifier => ({ reservoiridentifier, observationtime: time, effectivewaterstoragecapacity: '50' })),
        daily: ids.map(reservoiridentifier => ({ reservoiridentifier, datetime: '2026-09-29T00:00:00', capacity: '100' }))
    };
}

test('source fixture retains observation and capacity times separately', () => {
    const api = new (loadReservoirAPI())();
    const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'source-records.json'), 'utf8'));
    const reservoir = Object.values(api.parseOpenData(fixture.realtime, fixture.daily))[0];
    assert.equal(reservoir.observed_at, Date.parse('2026-09-30T04:00:00Z'));
    assert.equal(reservoir.capacity_recorded_at, Date.parse('2026-09-28T16:00:00Z'));
    assert.equal(reservoir.effective_capacity, 200);
    assert.equal(reservoir.percentage, 60);
});

test('newest capacity and observation are selected by instant, not response order or date string', () => {
    const api = new (loadReservoirAPI())();
    const realtime = [
        { reservoiridentifier: '10201', observationtime: '2026-09-30T12:00:00+08:00', effectivewaterstoragecapacity: '60' },
        { reservoiridentifier: '10201', observationtime: '2026-09-30T05:00:00Z', effectivewaterstoragecapacity: '90' }
    ];
    const daily = [
        { reservoiridentifier: '10201', datetime: '2026-09-29T00:00:00', capacity: '200' },
        { reservoiridentifier: '10201', datetime: '2026-09-28T00:00:00', capacity: '100' }
    ];
    for (const order of [daily, daily.slice().reverse()]) {
        const reservoir = Object.values(api.parseOpenData(realtime, order))[0];
        assert.equal(reservoir.percentage, 45);
        assert.equal(reservoir.observed_at, Date.parse('2026-09-30T05:00:00Z'));
    }
});

test('blank, negative sentinels and malformed numeric fields never become zero readings', () => {
    const api = new (loadReservoirAPI())();
    for (const value of ['', ' ', '-998.0', '50abc', 'Infinity', null, false]) {
        const source = sampleSources(api);
        source.realtime[0].effectivewaterstoragecapacity = value;
        const data = api.parseOpenData(source.realtime, source.daily);
        assert.equal(Object.keys(data).length, 19, String(value));
        assert.equal(api.getSnapshotMetadata(data).missing.length, 1);
    }
    const source = sampleSources(api);
    source.realtime[0].effectivewaterstoragecapacity = '0';
    assert.equal(api.parseOpenData(source.realtime, source.daily)['石門水庫'].percentage, 0);
});

test('missing capacity time is explicit and does not become the fetch or observation time', () => {
    const api = new (loadReservoirAPI())();
    const source = sampleSources(api);
    delete source.daily[0].datetime;
    const data = api.parseOpenData(source.realtime, source.daily);
    assert.equal(data['石門水庫'].capacity_recorded_at, null);
    assert.equal(api.getSnapshotMetadata(data).unknownCapacityTimes, 1);
});

test('partial accepted coverage reports missing stations and never calls it national coverage', () => {
    const api = new (loadReservoirAPI())();
    const source = sampleSources(api, '2026-09-30T12:00:00', 10);
    const data = api.parseOpenData(source.realtime, source.daily);
    api.validateSnapshot(data, Date.parse('2026-09-30T05:00:00Z'));
    const metadata = api.getSnapshotMetadata(data);
    assert.equal(metadata.covered, 10);
    assert.equal(metadata.expected, 20);
    assert.equal(metadata.missing.length, 10);
    assert.equal(Object.values(api.stationMapping).filter(r => r.region === 'east').length, 0);
});

test('future observations fail closed and the 48-hour boundary is explicit', () => {
    const api = new (loadReservoirAPI())();
    const source = sampleSources(api);
    const data = api.parseOpenData(source.realtime, source.daily);
    const observed = Date.parse('2026-09-30T04:00:00Z');
    assert.throws(() => api.validateSnapshot(data, observed - 60 * 60 * 1000 - 1), /時間異常/);
    assert.doesNotThrow(() => api.validateSnapshot(data, observed + 48 * 60 * 60 * 1000));
    assert.throws(() => api.validateSnapshot(data, observed + 48 * 60 * 60 * 1000 + 1), /資料過期/);
});

test('fresh cache retains original network fetch time and is not fetched again', async () => {
    const api = new (loadReservoirAPI())();
    const source = sampleSources(api, new Date().toISOString());
    api.saveCache(api.parseOpenData(source.realtime, source.daily));
    const originalFetchedAt = Date.now() - 120000;
    api.cache.timestamp = originalFetchedAt;
    api.makeRequest = async () => { throw new Error('cache must avoid network'); };
    const data = await api.fetchReservoirData();
    assert.equal(api.getSnapshotMetadata(data).fetchedAt, originalFetchedAt);
    assert.equal(Object.keys(data).length, 20);
});

test('future-dated cache is rejected', () => {
    const api = new (loadReservoirAPI())();
    const source = sampleSources(api, new Date().toISOString());
    api.cache.data = api.parseOpenData(source.realtime, source.daily);
    api.cache.timestamp = Date.now() + 120000;
    assert.equal(api.getCachedData(), null);
});

test('statistics use summed capacity and storage rather than mean of percentages', async () => {
    const api = new (loadReservoirAPI())();
    api.fetchReservoirData = async () => ({
        small: { effective_capacity: 100, effective_water_storage: 100, percentage: 100 },
        large: { effective_capacity: 900, effective_water_storage: 90, percentage: 10 }
    });
    const stats = await api.getStatistics();
    assert.equal(stats.weightedPercentage, 19);
    assert.equal(stats.totalCapacity, 1000);
    assert.equal(stats.totalStorage, 190);
});
