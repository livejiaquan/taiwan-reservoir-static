const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

test('page defaults to an explicit unavailable data status', () => {
    assert.match(html, /id="data-status"/);
    assert.match(html, /目前無法確認官方資料/);
    assert.doesNotMatch(html, /<script src="data\/mock-data\.js"><\/script>/);
});
