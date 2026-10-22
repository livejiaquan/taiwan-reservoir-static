const assert = require('node:assert/strict');
const test = require('node:test');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

function loadUtils() {
    const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'utils.js'), 'utf8');
    const context = { console, Date, Math, Number, String };
    context.globalThis = context;
    vm.runInNewContext(source, context, { filename: 'js/utils.js' });
    return context.Utils;
}

const Utils = loadUtils();

test('storage levels follow the project thresholds', () => {
    assert.equal(Utils.classify(80).key, 'full');
    assert.equal(Utils.classify(79.99).key, 'normal');
    assert.equal(Utils.classify(50).key, 'normal');
    assert.equal(Utils.classify(49.9).key, 'low');
    assert.equal(Utils.classify(30).key, 'low');
    assert.equal(Utils.classify(29.6).key, 'critical');
});

test('Taiwan observation times are parsed as UTC+8 regardless of host zone', () => {
    assert.equal(Utils.parseTaiwanTime('2026-10-22T15:00:00'), Date.UTC(2026, 9, 22, 7, 0));
    assert.equal(Utils.parseTaiwanTime('2026-10-22 15:00'), Date.UTC(2026, 9, 22, 7, 0));
    assert.equal(Utils.parseTaiwanTime('not a time'), null);
});

test('observation labels drop the date only for the same Taiwan day', () => {
    const now = Date.UTC(2026, 9, 22, 8, 0); // 台灣 16:00
    assert.equal(Utils.formatObservation(Date.UTC(2026, 9, 22, 7, 0), now), '15:00');
    assert.equal(Utils.formatObservation(Date.UTC(2026, 9, 21, 15, 0), now), '10/21 23:00');
});

test('relative times read naturally', () => {
    const now = Date.UTC(2026, 9, 22, 8, 0);
    assert.equal(Utils.formatRelative(now - 20 * 1000, now), '剛剛');
    assert.equal(Utils.formatRelative(now - 5 * 60 * 1000, now), '5 分鐘前');
    assert.equal(Utils.formatRelative(now - 3 * 60 * 60 * 1000, now), '3 小時前');
});

test('sparklines keep a minimum vertical span so noise is not exaggerated', () => {
    assert.equal(Utils.sparklinePoints([50, 50.1], 10, 10), '0.0,5.5 10.0,4.5');
    assert.equal(Utils.sparklinePoints([50], 10, 10), '');
});

test('HTML is escaped before insertion', () => {
    assert.equal(Utils.escapeHTML('<b>"x"</b>'), '&lt;b&gt;&quot;x&quot;&lt;/b&gt;');
});
