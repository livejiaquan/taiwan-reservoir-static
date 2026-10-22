// 主應用程式
const REGION_LABELS = { north: '北部', central: '中部', south: '南部' };
const STALE_ROW_HOURS = 12;
const STALE_PAGE_HOURS = 3;
const REFRESH_INTERVAL = 5 * 60 * 1000;
const THEME_KEY = 'reservoir_theme';

class ReservoirApp extends Utils.EventEmitter {
    constructor() {
        super();

        this.state = {
            data: {},
            status: 'loading',
            region: 'all',
            sort: 'geo',
            open: new Set(),
            isLoading: false,
            lastUpdate: null,
            autoRefresh: true,
            refreshInterval: null,
            clockInterval: null
        };

        this.elements = {
            dataStatus: document.getElementById('data-status'),
            refreshBtn: document.getElementById('refresh-btn'),
            retryBtn: document.getElementById('retry-btn'),
            themeBtn: document.getElementById('theme-btn'),
            totalPercentage: document.getElementById('total-percentage'),
            verdict: document.getElementById('verdict'),
            observedAt: document.getElementById('observed-at'),
            fetchedAt: document.getElementById('fetched-at'),
            wallColumns: document.getElementById('wall-columns'),
            rows: document.getElementById('reservoir-rows'),
            regionFilter: document.getElementById('region-filter'),
            sortOrder: document.getElementById('sort-order'),
            distributionBar: document.getElementById('distribution-bar'),
            distributionLegend: document.getElementById('distribution-legend'),
            totalStorage: document.getElementById('total-storage'),
            totalCapacity: document.getElementById('total-capacity'),
            watchList: document.getElementById('watch-list')
        };

        // 由北到南的固定順序與分區，來自 API 的站點對照表
        this.stations = Object.entries(window.api.stationMapping).map(([stationNo, info]) => ({
            stationNo,
            ...info
        }));

        this.init();
    }

    async init() {
        try {
            this.bindEvents();
            this.buildWall();
            this.setDataStatus('loading');

            // 即使初次請求失敗，仍保留後續自動恢復機會。
            this.startAutoRefresh();
            this.startClock();

            await this.loadData();
        } catch (error) {
            console.error('初始化失敗:', error);
            this.setDataStatus('unavailable', error.message);
        }
    }

    bindEvents() {
        this.elements.refreshBtn.addEventListener('click', () => this.refreshData());
        this.elements.retryBtn.addEventListener('click', () => this.refreshData());
        this.elements.themeBtn.addEventListener('click', () => this.toggleTheme());
        this.updateThemeButton();

        this.elements.regionFilter.addEventListener('change', event => {
            this.state.region = event.target.value;
            this.renderList();
        });
        this.elements.sortOrder.addEventListener('change', event => {
            this.state.sort = event.target.value;
            this.renderList();
        });

        this.elements.rows.addEventListener('toggle', event => {
            const station = event.target.dataset && event.target.dataset.station;
            if (!station) return;
            if (event.target.open) this.state.open.add(station);
            else this.state.open.delete(station);
        }, true);

        this.elements.watchList.addEventListener('click', event => {
            const link = event.target.closest('a[data-station]');
            if (!link) return;
            event.preventDefault();
            this.revealReservoir(link.dataset.station);
        });

        window.api.on('fetchStart', () => this.setLoading(true));

        window.api.on('fetchSuccess', data => {
            this.state.data = data;
            this.state.lastUpdate = new Date();
            this.setLoading(false);
            this.setDataStatus('verified');
            this.renderAll();
        });

        window.api.on('fetchError', error => {
            this.setLoading(false);
            this.setDataStatus('unavailable', error.message);
            this.clearDisplayedData();
        });

        // 手機切回分頁時，資料若已超過更新週期就立即更新
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState !== 'visible' || this.state.isLoading) return;
            const age = this.state.lastUpdate ? Date.now() - this.state.lastUpdate.getTime() : Infinity;
            if (age >= REFRESH_INTERVAL) this.loadData(true).catch(() => {});
        });

        window.addEventListener('online', () => {
            if (this.state.status === 'unavailable') this.refreshData();
        });
    }

    async loadData(forceRefresh = false) {
        try {
            this.state.data = await window.api.fetchReservoirData(forceRefresh);
            this.state.lastUpdate = new Date();
            this.renderAll();
        } catch (error) {
            throw new Error(`載入資料失敗: ${error.message}`);
        }
    }

    async refreshData() {
        if (this.state.isLoading) return;
        try {
            await this.loadData(true);
        } catch (error) {
            console.warn('手動更新失敗:', error.message);
        }
    }

    // 水利署資料無法驗證時，畫面上不能留下任何先前的數字
    clearDisplayedData() {
        this.state.data = {};
        this.state.lastUpdate = null;
        this.renderAll();
    }

    setDataStatus(status, reason = '') {
        this.state.status = status;
        document.body.dataset.state = status;

        const element = this.elements.dataStatus;
        element.dataset.state = status;
        element.dataset.ready = '';

        const title = element.querySelector('.data-status-title');
        const body = element.querySelector('.data-status-body');
        if (status === 'verified') {
            title.textContent = '已載入經濟部水利署官方資料';
            body.textContent = '';
        } else if (status === 'loading') {
            title.textContent = '正在讀取水利署資料';
            body.textContent = '';
        } else {
            const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
            title.textContent = offline ? '目前沒有網路連線' : '目前無法確認官方資料';
            body.textContent = offline
                ? '連上網路後會自動重新載入。為避免誤導，本站不顯示先前或推測的水情。'
                : `為避免顯示錯誤水情，本站暫不顯示數字，請以水利署公告為準。${reason ? `（${this.describeReason(reason)}）` : ''}`;
        }
    }

    describeReason(reason) {
        return reason
            .replace(/^載入資料失敗: /, '')
            .replace(/Failed to fetch|NetworkError[^）]*|Load failed/, '無法連線到水利署伺服器');
    }

    setLoading(isLoading) {
        this.state.isLoading = isLoading;
        const button = this.elements.refreshBtn;
        button.disabled = isLoading;
        button.classList.toggle('is-loading', isLoading);
        button.querySelector('.icon-btn-label').textContent = isLoading ? '更新中' : '重新整理';
        this.elements.rows.setAttribute('aria-busy', String(isLoading));
        this.emit('loadingStateChange', isLoading);
    }

    // ---------- 主題 ----------

    currentTheme() {
        const chosen = document.documentElement.dataset.theme;
        if (chosen) return chosen;
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    toggleTheme() {
        const next = this.currentTheme() === 'dark' ? 'light' : 'dark';
        document.documentElement.dataset.theme = next;
        try {
            localStorage.setItem(THEME_KEY, next);
        } catch {
            // 無法儲存時仍套用本次選擇
        }
        this.updateThemeButton();
    }

    updateThemeButton() {
        const next = this.currentTheme() === 'dark' ? '淺色' : '深色';
        this.elements.themeBtn.setAttribute('aria-label', `切換為${next}模式`);
        this.elements.themeBtn.title = `切換為${next}模式`;
    }

    // ---------- 資料整理 ----------

    reservoirs() {
        return Object.values(this.state.data);
    }

    byStation() {
        return new Map(this.reservoirs().map(reservoir => [reservoir.station_no, reservoir]));
    }

    totals(reservoirs) {
        let storage = 0;
        let capacity = 0;
        for (const reservoir of reservoirs) {
            capacity += reservoir.effective_capacity;
            // 超過有效容量的觀測值（例如溢流）以容量計，與單座蓄水率的上限一致
            storage += Math.min(reservoir.effective_water_storage, reservoir.effective_capacity);
        }
        return { storage, capacity, percentage: capacity > 0 ? storage / capacity * 100 : null };
    }

    countLevels(reservoirs) {
        const counts = { full: 0, normal: 0, low: 0, critical: 0 };
        for (const reservoir of reservoirs) counts[Utils.classify(reservoir.percentage).key] += 1;
        return counts;
    }

    shortName(name) {
        return name.replace(/水庫$/, '');
    }

    // ---------- 繪製 ----------

    renderAll() {
        this.renderSummary();
        this.renderWall();
        this.renderList();
        this.renderSide();
        this.renderFreshness();
    }

    renderSummary() {
        const reservoirs = this.reservoirs();
        const { totalPercentage, verdict } = this.elements;

        if (reservoirs.length === 0) {
            totalPercentage.innerHTML = '<span class="headline-number headline-empty">—</span>';
            verdict.textContent = this.state.status === 'loading'
                ? '正在讀取水利署最新觀測資料'
                : '資料無法驗證時，這裡不顯示數字。';
            return;
        }

        const { percentage } = this.totals(reservoirs);
        const counts = this.countLevels(reservoirs);
        // 數字與單位分成兩個節點，數字本身才是頁面上最大的文字
        totalPercentage.innerHTML = `<span class="headline-number">${percentage.toFixed(1)}</span><span class="headline-unit">%</span>`;

        const total = reservoirs.length;
        const critical = `<strong class="tone-critical">${counts.critical} 座低於三成</strong>`;
        const low = `<strong class="tone-low">${counts.low} 座介於三到五成</strong>`;
        let sentence;
        if (counts.critical && counts.low) {
            sentence = `${total} 座水庫中，${critical}、${low}。`;
        } else if (counts.critical) {
            sentence = `${total} 座水庫中，${critical}，其餘都在五成以上。`;
        } else if (counts.low) {
            sentence = `${total} 座水庫中，${low}，其餘都在五成以上。`;
        } else {
            sentence = `${total} 座水庫都在五成以上。`;
        }
        verdict.innerHTML = sentence;
    }

    renderFreshness() {
        const { observedAt, fetchedAt } = this.elements;
        const times = this.reservoirs()
            .map(reservoir => Utils.parseTaiwanTime(reservoir.update_time))
            .filter(Number.isFinite);

        if (times.length === 0) {
            observedAt.textContent = this.state.status === 'loading' ? '觀測時間讀取中' : '沒有可用的觀測時間';
            observedAt.classList.remove('is-stale');
            fetchedAt.textContent = '';
            return;
        }

        const now = Date.now();
        const latest = Math.max(...times);
        const stale = now - latest > STALE_PAGE_HOURS * Utils.HOUR;
        observedAt.textContent = `水利署觀測至 ${Utils.formatObservation(latest, now)}${stale ? '，已超過 3 小時沒有新資料' : ''}`;
        observedAt.classList.toggle('is-stale', stale);

        const fetched = window.api.cache.timestamp || (this.state.lastUpdate && this.state.lastUpdate.getTime());
        fetchedAt.textContent = fetched ? `${Utils.formatRelative(fetched, now)}取得` : '';
    }

    // 水尺牆的結構固定（20 根水柱），資料只更新高度，避免版面跳動
    buildWall() {
        const groups = Object.keys(REGION_LABELS).map(region => {
            const columns = this.stations
                .filter(station => station.region === region)
                .map(station => `
                    <div class="gauge" data-station="${station.stationNo}" data-level="missing" style="--p: 0">
                        <span class="gauge-value">—</span>
                        <span class="gauge-tube"><span class="gauge-fill"></span></span>
                        <span class="gauge-name">${Utils.escapeHTML(this.shortName(station.name))}</span>
                    </div>`)
                .join('');
            return `
                <div class="wall-group" data-region="${region}">
                    <div class="wall-group-columns">${columns}</div>
                    <span class="wall-group-label">${REGION_LABELS[region]}</span>
                </div>`;
        });
        this.elements.wallColumns.innerHTML = groups.join('');
        this.gauges = new Map(
            [...this.elements.wallColumns.querySelectorAll('.gauge')].map(gauge => [gauge.dataset.station, gauge])
        );
    }

    renderWall() {
        if (!this.gauges) return;
        const data = this.byStation();
        for (const [stationNo, gauge] of this.gauges) {
            const reservoir = data.get(stationNo);
            const value = gauge.querySelector('.gauge-value');
            if (!reservoir) {
                gauge.dataset.level = 'missing';
                gauge.style.setProperty('--p', 0);
                value.textContent = '—';
                value.classList.remove('is-wide');
                continue;
            }
            gauge.dataset.level = Utils.classify(reservoir.percentage).key;
            gauge.style.setProperty('--p', (reservoir.percentage / 100).toFixed(4));
            value.textContent = Utils.formatPercentage(reservoir.percentage, 0);
            value.classList.toggle('is-wide', value.textContent.length > 2);
        }

        // 第一次有資料時直接畫出最終高度，下一幀才開啟過渡
        if (data.size > 0 && !this.wallReady) {
            this.wallReady = true;
            requestAnimationFrame(() => requestAnimationFrame(() => {
                document.getElementById('wall').classList.add('is-ready');
            }));
        }
    }

    renderList() {
        const container = this.elements.rows;
        const focusedStation = document.activeElement && document.activeElement.closest
            ? (document.activeElement.closest('[data-station]') || {}).dataset
            : null;

        const reservoirs = this.reservoirs();
        if (reservoirs.length === 0) {
            container.innerHTML = this.state.status === 'loading'
                ? Array.from({ length: 6 }, () => '<div class="row-skeleton" aria-hidden="true"></div>').join('')
                : '<p class="list-empty">目前沒有通過驗證的水庫資料，所以不列出任何數字。</p>';
            return;
        }

        const order = new Map(this.stations.map((station, index) => [station.stationNo, index]));
        const visible = reservoirs
            .filter(reservoir => this.state.region === 'all' || reservoir.region === this.state.region)
            .sort((a, b) => (this.state.sort === 'low'
                ? a.percentage - b.percentage
                : order.get(a.station_no) - order.get(b.station_no)));

        if (visible.length === 0) {
            container.innerHTML = '<p class="list-empty">這個地區目前沒有通過驗證的水庫資料。</p>';
            return;
        }

        const now = Date.now();
        let html = '';
        if (this.state.sort === 'geo') {
            for (const region of Object.keys(REGION_LABELS)) {
                const inRegion = visible.filter(reservoir => reservoir.region === region);
                if (inRegion.length === 0) continue;
                html += `<h3 class="region-heading">${REGION_LABELS[region]}<small>${inRegion.length} 座</small></h3>`;
                html += inRegion.map(reservoir => this.rowHTML(reservoir, now)).join('');
            }
        } else {
            html = visible.map(reservoir => this.rowHTML(reservoir, now)).join('');
        }
        container.innerHTML = html;

        if (focusedStation && focusedStation.station) {
            const summary = container.querySelector(`[data-station="${focusedStation.station}"] summary`);
            if (summary) summary.focus({ preventScroll: true });
        }
    }

    trendHTML(reservoir) {
        const change = reservoir.change_24h;
        const values = (reservoir.history || []).map(point => point.percentage);
        const line = Utils.sparklinePoints(values, 56, 18);
        const spark = line
            ? `<svg class="spark" viewBox="-2 -2 60 22" aria-hidden="true"><polyline points="${line}"/></svg>`
            : '<span class="spark spark-empty" aria-hidden="true"></span>';

        if (!Number.isFinite(change)) {
            return `${spark}<span class="trend-value" title="逐時資料不足 24 小時">—<span class="visually-hidden">24 小時變化：逐時資料不足</span></span>`;
        }
        const rounded = Math.round(change * 10) / 10;
        const direction = rounded > 0 ? '上升' : rounded < 0 ? '下降' : '持平';
        const sign = rounded > 0 ? '+' : rounded < 0 ? '−' : '±';
        return `${spark}<span class="trend-value"><span class="visually-hidden">24 小時${direction}</span>${sign}${Math.abs(rounded).toFixed(1)}<span class="visually-hidden">個百分點</span></span>`;
    }

    rowHTML(reservoir, now) {
        const level = Utils.classify(reservoir.percentage);
        const observed = Utils.parseTaiwanTime(reservoir.update_time);
        const stale = Number.isFinite(observed) && now - observed > STALE_ROW_HOURS * Utils.HOUR;
        const timeText = Number.isFinite(observed) ? Utils.formatObservation(observed, now) : '—';
        const open = this.state.open.has(reservoir.station_no) ? ' open' : '';
        const name = Utils.escapeHTML(reservoir.name);

        return `
            <details class="row" id="r-${reservoir.station_no}" data-station="${reservoir.station_no}" data-level="${level.key}"${open}>
                <summary>
                    <span class="row-name"><strong>${name}</strong><span class="row-county">${Utils.escapeHTML(reservoir.county)}</span></span>
                    <span class="row-bar" aria-hidden="true"><span class="row-bar-fill" style="--p: ${(reservoir.percentage / 100).toFixed(4)}"></span><i style="--at: .3"></i><i style="--at: .5"></i><i style="--at: .8"></i></span>
                    <span class="row-pct"><span class="visually-hidden">蓄水率</span><b>${Utils.formatPercentage(reservoir.percentage)}</b><small>%</small></span>
                    <span class="pill" data-level="${level.key}">${level.label}</span>
                    <span class="row-trend">${this.trendHTML(reservoir)}</span>
                    <span class="row-time${stale ? ' is-stale' : ''}"><span class="visually-hidden">觀測時間</span>${timeText}${stale ? '<span class="stale-tag">較舊</span>' : ''}</span>
                    <svg class="row-chevron" aria-hidden="true"><use href="#i-chevron"/></svg>
                </summary>
                ${this.detailHTML(reservoir, observed, now)}
            </details>`;
    }

    detailHTML(reservoir, observed, now) {
        const items = [
            ['有效蓄水量', `${Utils.formatNumber(reservoir.effective_water_storage)} 萬&nbsp;m³`],
            ['有效容量', `${Utils.formatNumber(reservoir.effective_capacity)} 萬&nbsp;m³`]
        ];
        if (Number.isFinite(reservoir.water_level)) {
            let level = `${Utils.formatNumber(reservoir.water_level, 2)}&nbsp;m`;
            if (Number.isFinite(reservoir.full_water_level)) {
                const gap = reservoir.full_water_level - reservoir.water_level;
                level += gap > 0
                    ? `，距滿水位 ${Utils.formatNumber(gap, 1)}&nbsp;m`
                    : '，已達滿水位';
            }
            items.push(['水位', level]);
        }
        if (Number.isFinite(reservoir.basin_rainfall) && reservoir.daily_date) {
            const [, month, day] = reservoir.daily_date.split('-').map(Number);
            items.push([`${month}/${day} 集水區雨量`, `${Utils.formatNumber(reservoir.basin_rainfall, 1)}&nbsp;mm`]);
        }
        if (Number.isFinite(observed)) {
            items.push(['觀測時間', `${Utils.formatObservation(observed, now)}（${Utils.formatRelative(observed, now)}）`]);
        }

        const history = reservoir.history || [];
        let chart = '';
        if (history.length >= 2) {
            const values = history.map(point => point.percentage);
            const line = Utils.sparklinePoints(values, 300, 56);
            const first = history[0];
            const last = history[history.length - 1];
            const label = point => Utils.formatObservation(Utils.parseTaiwanTime(point.time), now);
            chart = `
                <figure class="detail-chart">
                    <figcaption>過去 ${history.length} 筆逐時觀測</figcaption>
                    <svg viewBox="-4 -6 308 68" preserveAspectRatio="none" aria-hidden="true"><polyline points="${line}" vector-effect="non-scaling-stroke"/></svg>
                    <div class="detail-chart-axis">
                        <span>${label(first)}　${first.percentage.toFixed(1)}%</span>
                        <span>${label(last)}　${last.percentage.toFixed(1)}%</span>
                    </div>
                </figure>`;
        }

        return `
            <div class="row-detail">
                <dl>${items.map(([term, value]) => `<div><dt>${term}</dt><dd>${value}</dd></div>`).join('')}</dl>
                ${chart}
            </div>`;
    }

    renderSide() {
        const reservoirs = this.reservoirs();
        const legend = this.elements.distributionLegend;
        const bar = this.elements.distributionBar;

        if (reservoirs.length === 0) {
            bar.innerHTML = '';
            legend.querySelectorAll('b').forEach(cell => { cell.textContent = '—'; });
            this.elements.totalStorage.textContent = '—';
            this.elements.totalCapacity.textContent = '—';
            this.elements.watchList.innerHTML = `<li class="watch-empty">${this.state.status === 'loading' ? '等待資料' : '資料無法驗證，暫不列出'}</li>`;
            return;
        }

        const counts = this.countLevels(reservoirs);
        bar.innerHTML = Utils.LEVELS
            .filter(level => counts[level.key] > 0)
            .map(level => `<span data-level="${level.key}" style="flex-grow: ${counts[level.key]}"></span>`)
            .join('');
        legend.querySelectorAll('li').forEach(item => {
            item.querySelector('b').textContent = `${counts[item.dataset.level]} 座`;
        });

        const { storage, capacity } = this.totals(reservoirs);
        // 萬立方公尺 ÷ 10,000 ＝ 億立方公尺
        this.elements.totalStorage.textContent = `${Utils.formatNumber(storage / 10000, 2)} 億 m³`;
        this.elements.totalCapacity.textContent = `${Utils.formatNumber(capacity / 10000, 2)} 億 m³`;

        const watch = reservoirs
            .filter(reservoir => reservoir.percentage < 50)
            .sort((a, b) => a.percentage - b.percentage);
        this.elements.watchList.innerHTML = watch.length === 0
            ? '<li class="watch-empty">目前沒有蓄水低於五成的水庫。</li>'
            : watch.map(reservoir => {
                const level = Utils.classify(reservoir.percentage);
                return `
                    <li>
                        <a href="#r-${reservoir.station_no}" data-station="${reservoir.station_no}">
                            <span class="watch-name">${Utils.escapeHTML(reservoir.name)}<small>${Utils.escapeHTML(reservoir.county)}</small></span>
                            <span class="watch-pct">${Utils.formatPercentage(reservoir.percentage)}<small>%</small></span>
                            <span class="pill" data-level="${level.key}">${level.label}</span>
                        </a>
                    </li>`;
            }).join('');
    }

    // 從「需要留意」跳到清單中的水庫並展開
    revealReservoir(stationNo) {
        let row = document.getElementById(`r-${stationNo}`);
        if (!row) {
            this.state.region = 'all';
            this.elements.regionFilter.querySelector('input[value="all"]').checked = true;
            this.renderList();
            row = document.getElementById(`r-${stationNo}`);
        }
        if (!row) return;
        row.open = true;
        this.state.open.add(stationNo);
        const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        row.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
        row.querySelector('summary').focus({ preventScroll: true });
    }

    // ---------- 計時 ----------

    startAutoRefresh() {
        if (this.state.refreshInterval) {
            clearInterval(this.state.refreshInterval);
        }

        if (this.state.autoRefresh) {
            this.state.refreshInterval = setInterval(() => {
                if (!this.state.isLoading) {
                    return this.loadData(true).catch(error => {
                        console.warn('自動刷新失敗:', error.message);
                    });
                }
            }, REFRESH_INTERVAL);
        }
    }

    // 「幾分鐘前取得」每分鐘更新一次
    startClock() {
        if (this.state.clockInterval) clearInterval(this.state.clockInterval);
        this.state.clockInterval = setInterval(() => this.renderFreshness(), 60 * 1000);
    }

    stopAutoRefresh() {
        clearInterval(this.state.refreshInterval);
        clearInterval(this.state.clockInterval);
        this.state.refreshInterval = null;
        this.state.clockInterval = null;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.app = new ReservoirApp();
});

window.ReservoirApp = ReservoirApp;
