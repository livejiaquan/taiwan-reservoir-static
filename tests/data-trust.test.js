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

test('page reading order puts source validity before weighted summary, exploration and methodology', () => {
    const landmarks = ['id="snapshot"', 'id="data-status"', 'id="stats-grid"', 'id="overview-detail"', 'id="explorer"', 'id="sources"'];
    const offsets = landmarks.map(value => html.indexOf(value));
    assert.ok(offsets.every(offset => offset >= 0));
    assert.deepEqual(offsets, [...offsets].sort((a, b) => a - b));
    assert.match(html, /class="skip-link" href="#snapshot"/);
    assert.match(html, /id="region-summary"[^>]+role="status"/);
    assert.match(html, /<script async id="chart-library"/);
    assert.match(html, /<noscript>/);
});

test('essential text tokens pass contrast checks on their designated surfaces', () => {
    const css = fs.readFileSync(path.join(__dirname, '..', 'css', 'main.css'), 'utf8')
        + fs.readFileSync(path.join(__dirname, '..', 'css', 'components.css'), 'utf8');
    function luminance(hex) {
        const values = hex.slice(1).match(/../g).map(value => parseInt(value, 16) / 255)
            .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
        return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722;
    }
    const pairs = [
        ['#183d46', '#ffffff'], ['#4b6267', '#f2f6f5'], ['#586b70', '#ffffff'],
        ['#d8e9e9', '#123d47'], ['#cee2e3', '#123d47'], ['#744008', '#fff4e2'],
        ['#852929', '#fff0ed'], ['#245963', '#e6f2f1'], ['#ffffff', '#176170']
    ];
    for (const [foreground, background] of pairs) {
        assert.ok(css.includes(foreground) && css.includes(background), `${foreground}/${background} token exists`);
        const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
        const contrast = (values[0] + 0.05) / (values[1] + 0.05);
        assert.ok(contrast >= 4.5, `${foreground}/${background}: ${contrast.toFixed(2)}`);
    }
});

test('source styles expose focus, touch sizes, narrow layouts and reduced-motion safeguards', () => {
    const main = fs.readFileSync(path.join(__dirname, '..', 'css', 'main.css'), 'utf8');
    const components = fs.readFileSync(path.join(__dirname, '..', 'css', 'components.css'), 'utf8');
    assert.match(main, /\.overview-detail summary:focus-visible\s*\{ outline-offset: -5px/);
    assert.match(main, /prefers-reduced-motion: reduce/);
    assert.match(main, /\.region-btn\s*\{[^}]*min-height: 46px/);
    assert.match(components, /\.alert-action, \.empty-reset\s*\{[^}]*min-height: 44px/);
    assert.match(main, /@media \(max-width: 700px\)/);
    assert.match(components, /@media \(max-width: 360px\)/);
    assert.doesNotMatch(components, /infinite|min-width:\s*(?:2\.4rem|350px)/);
});
