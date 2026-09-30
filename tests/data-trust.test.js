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


test('page documents time, scope, weighting and non-official status thresholds', () => {
    for (const text of ['上次成功擷取', '水量觀測時間', '台北', '48 小時', '10/20', '尚未納入東部及離島', '有效容量總和', '停水', '未提供歷年同期比較']) {
        assert.ok(html.includes(text), text);
    }
    assert.match(html, /https:\/\/data.gov.tw\/dataset\/45501/);
    assert.match(html, /https:\/\/data.gov.tw\/dataset\/41568/);
});

test('all referenced local scripts and styles are present and syntactically valid', () => {
    const { execFileSync } = require('node:child_process');
    const root = path.join(__dirname, '..');
    const references = [...html.matchAll(/(?:src|href)="((?:js|css)\/[^"?]+)"/g)].map(match => match[1]);
    assert.equal(references.length, 6);
    for (const file of references) {
        assert.ok(fs.existsSync(path.join(root, file)), file);
        if (file.endsWith('.js')) execFileSync(process.execPath, ['--check', path.join(root, file)]);
    }
});
