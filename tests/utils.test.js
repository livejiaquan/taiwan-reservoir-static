const assert = require('node:assert/strict');
const test = require('node:test');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const context = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'utils.js'), 'utf8'), context);
const Utils = context.window.Utils;

test('source timestamps are explicit Taipei or respect provided timezone offsets', () => {
    const expected = Date.parse('2026-09-30T04:00:00Z');
    for (const input of ['2026-09-30T12:00:00', '2026-09-30 12:00', '20260930t120000', '2026-09-30T12:00:00+08:00', '2026-09-30T04:00:00Z', '2026-09-29T23:00:00-05:00']) {
        assert.equal(Utils.parseSourceTime(input), expected, input);
    }
    const display = Utils.formatTaipeiTime(expected);
    assert.match(display, /12:00/);
    assert.match(display, /台北 UTC\+8/);
});

test('invalid and missing timestamps remain unknown rather than normalized dates', () => {
    for (const value of [null, '', '2026-02-30T12:00:00', '2026-09-30T24:00:00', '2026-09-30T12:00:00+25:00', '2026-09-30', 'nonsense']) {
        assert.equal(Utils.parseSourceTime(value), null, String(value));
    }
    assert.equal(Utils.formatTaipeiTime(null), '時間未知');
    assert.equal(Utils.formatTaipeiTime(NaN), '時間未知');
});

test('aggregate is capacity weighted, empty is unknown, and over-capacity ratios are not clamped', () => {
    const rows = [{ effective_capacity: 100, effective_water_storage: 100 }, { effective_capacity: 900, effective_water_storage: 90 }];
    assert.equal(Utils.getStorageSummary(rows).weightedPercentage, 19);
    assert.equal(Utils.getStorageSummary([]).weightedPercentage, null);
    assert.equal(Utils.getStorageSummary([{ effective_capacity: 100, effective_water_storage: 110 }]).weightedPercentage, 110.00000000000001);
});

test('age labels distinguish missing, delayed, stale and future source times', () => {
    const now = Date.parse('2026-09-30T04:00:00Z');
    assert.equal(Utils.getObservationStatus(null, now), '觀測時間未知');
    assert.equal(Utils.getObservationStatus(now, now), '6 小時內觀測');
    assert.equal(Utils.getObservationStatus(now - 7 * 3600000, now), '觀測距今已逾 6 小時');
    assert.equal(Utils.getObservationStatus(now - 49 * 3600000, now), '觀測已過期');
    assert.equal(Utils.getObservationStatus(now + 2 * 3600000, now), '觀測時間異常');
});


test('fractional seconds preserve ordering rather than collapsing observations', () => {
    assert.equal(Utils.parseSourceTime('2026-09-30T12:00:00.9+08:00') - Utils.parseSourceTime('2026-09-30T12:00:00.100+08:00'), 800);
    assert.equal(Utils.parseSourceTime('2026-09-30T12:00:00.01'), Date.parse('2026-09-30T04:00:00.010Z'));
});
