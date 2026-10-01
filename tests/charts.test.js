const assert = require('node:assert/strict');
const test = require('node:test');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

function loadCharts() {
    const canvas = { style: {}, onclick: null, getContext: () => ({}) };
    const charts = [];
    const context = {
        window: { addEventListener() {} },
        document: { getElementById: () => canvas },
        console: { log() {}, warn() {}, error() {} },
        Chart: class {
            constructor(_, config) { this.config = config; charts.push(this); }
            destroy() { this.destroyed = true; }
            getElementsAtEventForMode() { return [{ index: 0 }]; }
        }
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'utils.js'), 'utf8'), context);
    context.Utils = context.window.Utils;
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'charts.js'), 'utf8'), context);
    return { manager: context.window.chartManager, canvas, charts };
}

const data = {
    small: { name: '小庫', county: '測試', region: 'north', percentage: 110, effective_capacity: 100, effective_water_storage: 110, observed_at: Date.parse('2026-09-30T04:00:00Z'), capacity_recorded_at: null },
    large: { name: '大庫', county: '測試', region: 'north', percentage: 10, effective_capacity: 900, effective_water_storage: 90, observed_at: Date.parse('2026-09-30T04:00:00Z'), capacity_recorded_at: null }
};

test('overview preserves above-capacity percentages and labels source times', () => {
    const { manager } = loadCharts();
    const chart = manager.createOverviewChart('overview-chart', data);
    assert.equal(chart.config.options.scales.x.max, undefined);
    assert.equal(chart.config.options.scales.x.suggestedMax, 100);
    assert.equal(chart.config.data.datasets[0].data[1], 110);
    const tooltip = chart.config.options.plugins.tooltip.callbacks.label({ dataIndex: 1 });
    assert.ok(tooltip.some(line => line.startsWith('水量觀測:')));
    assert.ok(tooltip.some(line => line === '容量資料: 時間未知'));
});

test('repeat refresh replaces the chart click handler and destruction removes it', () => {
    const { manager, canvas, charts } = loadCharts();
    let clicks = 0;
    manager.onChartClick = () => { clicks += 1; };
    manager.createOverviewChart('overview-chart', data);
    const firstHandler = canvas.onclick;
    manager.createOverviewChart('overview-chart', data);
    assert.notEqual(canvas.onclick, firstHandler);
    assert.equal(charts[0].destroyed, true);
    canvas.onclick({});
    assert.equal(clicks, 1);
    manager.destroyChart('overview-chart');
    assert.equal(canvas.onclick, null);
    manager.createOverviewChart('overview-chart', data);
    manager.destroyAllCharts();
    assert.equal(canvas.onclick, null);
    assert.equal(manager.charts.size, 0);
});

test('regional aggregation is weighted and historical chart never invents readings', () => {
    const { manager, charts } = loadCharts();
    const chart = manager.createRegionComparisonChart('region-chart', data);
    assert.equal(chart.config.data.datasets[0].data[0], 20);
    const count = charts.length;
    assert.equal(manager.createTrendChart('trend-chart'), null);
    assert.equal(charts.length, count);
    const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'charts.js'), 'utf8');
    assert.doesNotMatch(source, /Math\.random/);
});

test('snapshot charts never animate readings and expose every y-axis label', () => {
    const { manager } = loadCharts();
    const chart = manager.createOverviewChart('overview-chart', data);
    assert.equal(chart.config.options.animation, false);
    assert.equal(chart.config.options.scales.y.ticks.autoSkip, false);
});
