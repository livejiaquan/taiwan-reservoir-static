// 主應用程式
class ReservoirApp extends Utils.EventEmitter {
    constructor() {
        super();
        
        // 應用程式狀態
        this.state = {
            data: {},
            currentRegion: 'all',
            isLoading: false,
            lastUpdate: null,
            metadata: null,
            autoRefresh: true,
            refreshInterval: null
        };
        
        // DOM 元素引用
        this.elements = {
            loadingScreen: document.getElementById('loading-screen'),
            mainContainer: document.getElementById('main-container'),
            dataStatus: document.getElementById('data-status'),
            lastUpdateTime: document.getElementById('last-update-time'),
            observationRange: document.getElementById('observation-range'),
            coverageSummary: document.getElementById('coverage-summary'),
            missingStations: document.getElementById('missing-stations'),
            capacityTimeNote: document.getElementById('capacity-time-note'),
            refreshBtn: document.getElementById('refresh-btn'),
            refreshLabel: document.getElementById('refresh-label'),
            statsGrid: document.getElementById('stats-grid'),
            overviewChart: document.getElementById('overview-chart'),
            chartLibrary: document.getElementById('chart-library'),
            overviewDetail: document.getElementById('overview-detail'),
            overviewList: document.getElementById('overview-list'),
            chartFrame: document.getElementById('chart-frame'),
            chartStatus: document.getElementById('chart-status'),
            regionSummary: document.getElementById('region-summary'),
            reservoirsGrid: document.getElementById('reservoirs-grid'),
            alertsSection: document.getElementById('alerts-section'),
            alertsContainer: document.getElementById('alerts-container'),
            scrollToTop: document.getElementById('scroll-to-top'),
            regionBtns: document.querySelectorAll('.region-btn')
        };
        
        // 初始化應用程式
        this.init();
    }
    
    async init() {
        console.log('🌊 台灣水庫即時監控系統啟動中...');
        
        try {
            // 綁定事件監聽器
            this.bindEvents();

            // 即使初次請求失敗，仍保留後續自動恢復機會。
            this.startAutoRefresh();

            // 設置滾動監聽
            this.setupScrollListeners();
            
            // 初始載入資料
            await this.loadData();
            
            // 隱藏載入畫面
            this.hideLoadingScreen();
            
            console.log('✅ 應用程式初始化完成');
            
        } catch (error) {
            console.error('❌ 應用程式初始化失敗:', error);
            this.hideLoadingScreen();
            this.setDataStatus('unavailable', `目前無法確認官方資料：${error.message}。請以水利署公告為準。`);
            this.showError('應用程式初始化失敗，請重新整理頁面');
        }
    }
    
    // 綁定事件監聽器
    bindEvents() {
        // 刷新按鈕
        if (this.elements.refreshBtn) {
            this.elements.refreshBtn.addEventListener('click', () => {
                this.refreshData();
            });
        }
        
        // 地區選擇按鈕
        this.elements.regionBtns.forEach((btn, index) => {
            btn.addEventListener('keydown', (event) => {
                const keys = ['ArrowLeft', 'ArrowRight', 'Home', 'End'];
                if (!keys.includes(event.key)) return;
                event.preventDefault();
                const buttons = this.elements.regionBtns;
                const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1
                    : (index + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length;
                buttons[next].focus();
                this.setCurrentRegion(buttons[next].dataset.region);
            });
            btn.addEventListener('click', (e) => {
                const region = e.currentTarget.dataset.region;
                this.setCurrentRegion(region);
            });
        });
        
        // 回到頂部按鈕
        if (this.elements.scrollToTop) {
            this.elements.scrollToTop.addEventListener('click', () => {
                window.scrollTo({ top: 0, behavior: Utils.prefersReducedMotion() ? 'auto' : 'smooth' });
            });
        }
        
        // API 事件監聽
        window.api.on('fetchStart', () => {
            this.setLoading(true);
        });
        
        window.api.on('fetchSuccess', (data) => {
            this.state.data = data;
            this.state.metadata = window.api.getSnapshotMetadata(data);
            this.state.lastUpdate = this.state.metadata.fetchedAt;
            this.setLoading(false);
            const delayed = Date.now() - this.state.metadata.observedFrom > 6 * 60 * 60 * 1000;
            const partial = this.state.metadata.covered < this.state.metadata.expected;
            this.setDataStatus(delayed || partial ? 'warning' : 'verified',
                `已載入水利署資料：${this.state.metadata.covered}/${this.state.metadata.expected} 座。`
                + (partial ? ' 部分水庫缺少可用資料。' : '')
                + (delayed ? ' 部分觀測距今已逾 6 小時，請留意觀測時間。' : '')
                + ' 擷取成功不代表來源剛更新。');
            this.renderAll();
        });
        
        window.api.on('fetchError', (error) => {
            this.setLoading(false);
            this.clearDisplayedData(window.chartManager);
            this.setDataStatus('unavailable', `目前無法確認官方資料：${error.message}。未顯示任何水情數值，請以水利署公告為準。`);
            this.showError(`載入資料失敗: ${error.message}`);
        });
        
        // 視窗事件
        window.addEventListener('beforeunload', () => {
            this.cleanup();
        });
        
        // A delegated button works with pointer, Enter and Space, including after rerenders.
        [this.elements.overviewList, this.elements.alertsContainer, this.elements.reservoirsGrid].forEach(container => {
            if (!container) return;
            container.addEventListener('click', event => {
                const target = event.target.closest('button[data-reservoir-target], button[data-reset-region]');
                if (!target || !container.contains(target)) return;
                if (target.hasAttribute('data-reset-region')) {
                    this.setCurrentRegion('all');
                    this.elements.regionBtns[0]?.focus();
                } else this.scrollToReservoir(target.dataset.reservoirTarget);
            });
        });
        if (this.elements.chartLibrary) {
            this.elements.chartLibrary.addEventListener('load', () => this.renderOverviewChart());
        }
        if (this.elements.overviewDetail) {
            this.elements.overviewDetail.addEventListener('toggle', () => {
                if (this.elements.overviewDetail.open) this.renderOverviewChart();
            });
        }
    }
    
    // 載入資料
    async loadData(forceRefresh = false) {
        try {
            await window.api.fetchReservoirData(forceRefresh);
        } catch (error) {
            throw new Error(`載入資料失敗: ${error.message}`);
        }
    }

    setDataStatus(status, message) {
        if (!this.elements.dataStatus) return;

        this.elements.dataStatus.classList.toggle('verified', status === 'verified');
        this.elements.dataStatus.classList.toggle('unavailable', status === 'unavailable');
        this.elements.dataStatus.classList.toggle('warning', status === 'warning');
        const icon = status === 'verified' ? 'bi-check-circle-fill' : 'bi-exclamation-triangle-fill';
        this.elements.dataStatus.querySelector('i').className = `bi ${icon}`;
        this.elements.dataStatus.querySelector('span').textContent = message;
    }

    clearDisplayedData(chartManager) {
        this.state.data = {};
        this.state.lastUpdate = null;
        this.state.metadata = null;
        if (this.elements.lastUpdateTime) {
            this.elements.lastUpdateTime.textContent = '--';
        }
        chartManager.destroyChart('overview-chart');
        this.renderAll();
    }
    
    // 刷新資料
    async refreshData() {
        if (this.state.isLoading) return;
        
        try {
            await this.loadData(true);
            Utils.showNotification('已重新擷取；請確認水量觀測時間', 'info', 3000);
        } catch (error) {
            Utils.showNotification('更新失敗', 'error', 3000);
        }
    }
    
    // 設置載入狀態
    setLoading(isLoading) {
        this.state.isLoading = isLoading;
        
        if (this.elements.refreshBtn) {
            this.elements.refreshBtn.disabled = isLoading;
            this.elements.refreshBtn.classList.toggle('loading', isLoading);
        }
        
        if (this.elements.refreshLabel) this.elements.refreshLabel.textContent = isLoading ? '擷取中…' : '重新擷取資料';
        this.emit('loadingStateChange', isLoading);
    }
    
    // Remove the normal-flow loader before revealing content, without an artificial layout jump.
    hideLoadingScreen() {
        if (this.elements.loadingScreen) this.elements.loadingScreen.hidden = true;
        if (this.elements.mainContainer) this.elements.mainContainer.classList.remove('hidden');
    }

    // Retain a keyboard user's station target across background refreshes.
    replaceContent(element, html) {
        const active = document.activeElement;
        const target = active && element.contains?.(active)
            ? active.dataset?.reservoirTarget || active.dataset?.reservoir : null;
        const resetFocused = active && element.contains?.(active) && active.hasAttribute?.('data-reset-region');
        element.innerHTML = html;
        if (!target && !resetFocused) return;
        const replacement = [...element.querySelectorAll('[data-reservoir-target], [data-reservoir], [data-reset-region]')]
            .find(node => resetFocused ? node.hasAttribute?.('data-reset-region')
                : (node.dataset.reservoirTarget || node.dataset.reservoir) === target);
        if (replacement) replacement.focus({ preventScroll: true });
        else this.elements.refreshBtn?.focus({ preventScroll: true });
    }

    // 設置當前地區
    setCurrentRegion(region) {
        this.state.currentRegion = region;
        
        // 更新按鈕狀態
        this.elements.regionBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.region === region);
            btn.setAttribute('aria-pressed', String(btn.dataset.region === region));
        });
        
        // 重新渲染水庫網格
        this.renderReservoirGrid();
        
        this.emit('regionChange', region);
    }
    
    // 渲染所有組件
    renderAll() {
        this.updateLastUpdateTime();
        this.renderSourceContext();
        this.renderStats();
        this.renderOverviewChart();
        this.renderReservoirGrid();
        this.renderAlerts();
    }
    
    // 網路擷取時間與來源觀測時間分開，統一顯示台北時區。
    updateLastUpdateTime() {
        if (this.elements.lastUpdateTime) {
            this.elements.lastUpdateTime.textContent = Number.isFinite(this.state.lastUpdate)
                ? Utils.formatTaipeiTime(this.state.lastUpdate) : '--';
        }
    }

    renderSourceContext() {
        const metadata = this.state.metadata;
        if (this.elements.observationRange) {
            this.elements.observationRange.textContent = metadata
                ? Utils.formatTaipeiTime(metadata.observedFrom)
                    + (metadata.observedFrom === metadata.observedTo ? '' : ` 至 ${Utils.formatTaipeiTime(metadata.observedTo)}`)
                : '未知，尚無可用快照';
        }
        if (this.elements.coverageSummary) {
            this.elements.coverageSummary.textContent = metadata
                ? `本次顯示 ${metadata.covered}/${metadata.expected} 座清單內水庫；統計僅包含這些水庫。`
                : '尚無可用快照，涵蓋狀況未知。';
        }
        if (this.elements.missingStations) {
            this.elements.missingStations.textContent = metadata && metadata.missing.length
                ? `本次未顯示：${metadata.missing.join('、')}。可能缺少蓄水量、容量或有效觀測時間；不代表蓄水量為零。`
                : '';
        }
        if (this.elements.capacityTimeNote) {
            this.elements.capacityTimeNote.textContent = metadata && metadata.unknownCapacityTimes
                ? `${metadata.unknownCapacityTimes} 座水庫的容量資料時間未知，詳見各卡片。` : '';
        }
    }

    // A volume-weighted focal point; the numerator and denominator remain inspectable.
    renderStats() {
        if (!this.elements.statsGrid) return;
        const reservoirs = Object.values(this.state.data);
        if (!reservoirs.length) {
            this.elements.statsGrid.innerHTML = '<div class="empty-state"><h3 class="empty-state-title">暫無統計資料</h3><p class="empty-state-description">資料未通過檢查前，不推算蓄水量或合計蓄水率。可使用頁首按鈕重新擷取。</p></div>';
            return;
        }
        const summary = Utils.getStorageSummary(reservoirs);
        const value = summary.weightedPercentage;
        const width = value === null ? 0 : Math.min(100, Math.max(0, value));
        const ranges = [
            { label: '蓄水率 ≥80%', count: reservoirs.filter(r => r.percentage >= 80).length, color: '#176b59' },
            { label: '蓄水率 50–未滿80%', count: reservoirs.filter(r => r.percentage >= 50 && r.percentage < 80).length, color: '#176170' },
            { label: '蓄水率 <50%', count: reservoirs.filter(r => r.percentage < 50).length, color: '#955000' }
        ];
        const expected = this.state.metadata?.expected || 20;
        this.elements.statsGrid.innerHTML = `
            <div class="storage-summary">
                <h3>合計蓄水率（容量加權）</h3>
                <p class="storage-value">${value === null ? '--' : value.toFixed(1)}<span>%</span></p>
                <div class="storage-scale" aria-hidden="true" style="--progress-width: ${width}%"><span></span></div>
                <div class="storage-scale-labels" aria-hidden="true"><span>0</span><span>有效容量 100%</span></div>
                <dl class="storage-volumes">
                    <div><dt>觀測蓄水量合計</dt><dd>${Utils.formatNumber(summary.totalStorage)}<span>萬立方公尺</span></dd></div>
                    <div><dt>有效容量合計</dt><dd>${Utils.formatNumber(summary.totalCapacity)}<span>萬立方公尺</span></dd></div>
                </dl>
                <p class="storage-caption">${reservoirs.length}/${expected} 座清單內水庫的水量 ÷ 容量；非全台總量、非同時刻觀測。${value > 100 ? '合計超過 100%，數值如實保留，水量尺僅畫至 100%。' : ''}</p>
            </div>
            <div class="distribution-summary">
                <h3>同一份快照，涵蓋哪些水庫？</h3>
                <p>本次顯示 <span class="coverage-count">${reservoirs.length}/${expected} 座</span>清單內水庫${reservoirs.length < expected ? '；部分資料缺漏，詳見上方未顯示清單' : ''}。</p>
                <dl class="distribution-list">${ranges.map(range => `
                    <div class="distribution-row" style="--range-color: ${range.color}"><dt>${range.label}</dt><dd>${range.count} <span>座</span></dd></div>
                `).join('')}</dl>
                <p>僅按百分比分組，不能單獨判定乾旱、限水或供水安全。</p>
            </div>`;
    }

    renderOverviewChart() {
        const reservoirs = Object.values(this.state.data).sort((a, b) => a.percentage - b.percentage);
        // Native text is always present, independent of Chart.js, fonts or a pointing device.
        if (this.elements.overviewList) {
            this.replaceContent(this.elements.overviewList, reservoirs.length ? reservoirs.map(reservoir => `
                <button type="button" class="overview-row" data-reservoir-target="${Utils.escapeHTML(reservoir.name)}" aria-label="查看${Utils.escapeHTML(reservoir.name)}，蓄水率 ${reservoir.percentage.toFixed(1)}%">
                    <span>${Utils.escapeHTML(reservoir.name)}</span><strong>${reservoir.percentage.toFixed(1)}% <span aria-hidden="true">↗</span></strong>
                </button>`).join('') : '<p class="chart-note">尚無可用資料，未繪製比較圖。</p>');
        }
        if (this.elements.chartFrame) this.elements.chartFrame.hidden = !reservoirs.length;
        if (!reservoirs.length) {
            if (this.elements.chartStatus) this.elements.chartStatus.textContent = '尚無可用資料，未繪製比較圖。';
            return;
        }
        if (!this.elements.overviewChart || (this.elements.overviewDetail && !this.elements.overviewDetail.open)) return;
        if (this.elements.chartFrame) {
            this.elements.chartFrame.hidden = false;
            this.elements.chartFrame.style.height = `${Math.max(320, reservoirs.length * 32 + 70)}px`;
        }
        const chart = window.chartManager.createOverviewChart('overview-chart', this.state.data);
        if (this.elements.chartFrame) this.elements.chartFrame.hidden = !chart;
        if (this.elements.chartStatus) this.elements.chartStatus.textContent = chart
            ? '依蓄水率由低至高排列；圖表可點選，下方數值清單也可用鍵盤跳至完整觀測記錄。'
            : '圖表暫時無法載入。下方仍保留完整數值與水庫跳轉，資料判讀不受影響。';
    }

    // 渲染水庫網格
    renderReservoirGrid() {
        if (!this.elements.reservoirsGrid) return;
        
        // 根據當前地區篩選資料
        let filteredData = this.state.data;
        if (this.state.currentRegion !== 'all') {
            filteredData = Object.fromEntries(
                Object.entries(this.state.data).filter(
                    ([_, reservoir]) => reservoir.region === this.state.currentRegion
                )
            );
        }
        
        const reservoirs = Object.values(filteredData);
        if (this.elements.regionSummary) {
            const labels = { all: '全部', north: '北部', central: '中部', south: '南部', east: '東部' };
            const expected = { all: 20, north: 5, central: 7, south: 8 };
            this.elements.regionSummary.textContent = this.state.currentRegion === 'east'
                ? '東部尚未納入本站清單，無法由此判斷東部水情。'
                : `${labels[this.state.currentRegion]} · ${Object.keys(this.state.data).length ? `本次顯示 ${reservoirs.length}/${expected[this.state.currentRegion]} 座清單內水庫` : '尚無可用快照'}。各庫水量與容量時間分開列示。`;
        }
        if (!reservoirs.length) {
            this.replaceContent(this.elements.reservoirsGrid, `
                <div class="empty-state">
                    <h3 class="empty-state-title">${this.state.currentRegion === 'east' ? '本站尚未納入東部水庫' : '暫無可用水庫資料'}</h3>
                    <p class="empty-state-description">${this.state.currentRegion === 'east'
                        ? '東部不在本站目前的 20 座水庫對照清單內；這不代表東部沒有水庫、蓄水量為零或官方 API 故障。'
                        : Object.keys(this.state.data).length
                            ? '本次快照未包含此地區的可用水庫記錄；缺資料不代表蓄水量為零。其他地區資料仍可查看。'
                            : '目前沒有通過資料檢查的水庫快照，不能據此判斷水情。請查看上方資料狀態。'}</p>
                    ${this.state.currentRegion !== 'all' ? '<button type="button" class="empty-reset" data-reset-region>查看全部清單</button>' : ''}
                </div>`);
            return;
        }
        reservoirs.sort((a, b) => b.percentage - a.percentage);
        this.replaceContent(this.elements.reservoirsGrid, reservoirs.map(reservoir => {
            const color = Utils.getWaterLevelColor(reservoir.percentage);
            const status = Utils.getWaterLevelText(reservoir.percentage);
            const progressWidth = Math.min(100, Math.max(0, reservoir.percentage)); // Only clamp the drawing, never the reading.
            const age = Utils.getObservationStatus(reservoir.observed_at);
            return `
                <article class="reservoir-card" data-reservoir="${Utils.escapeHTML(reservoir.name)}" tabindex="-1" aria-label="${Utils.escapeHTML(reservoir.name)}觀測記錄">
                    <div class="reservoir-card-header">
                        <h3 class="reservoir-name">${Utils.escapeHTML(reservoir.name)}</h3>
                        <p class="reservoir-location">${Utils.escapeHTML(reservoir.county)}</p>
                    </div>
                    <div class="reservoir-card-body">
                        <div class="progress-section">
                            <div class="water-bar-content"><strong><span class="sr-only">蓄水率 </span>${reservoir.percentage.toFixed(1)}<span>%</span></strong><small>${status}</small></div>
                            <div class="water-bar" aria-hidden="true" style="--progress-width: ${progressWidth}%; --progress-color: ${color}"><div class="water-bar-fill"></div></div>
                            ${reservoir.percentage > 100 ? '<p class="over-capacity-note">超過有效容量；數值如實保留，水量尺僅畫至 100%。</p>' : ''}
                        </div>
                        <dl class="reservoir-details">
                            <div><dt class="detail-label">觀測蓄水量</dt><dd class="detail-value">${Utils.formatNumber(reservoir.effective_water_storage)}<span class="detail-unit">萬立方公尺</span></dd></div>
                            <div><dt class="detail-label">有效容量</dt><dd class="detail-value">${Utils.formatNumber(reservoir.effective_capacity)}<span class="detail-unit">萬立方公尺</span></dd></div>
                        </dl>
                        <div class="reservoir-update-time">
                            <p>水量觀測：${Utils.formatTaipeiTime(reservoir.observed_at)}<br><span class="observation-age${age === '6 小時內觀測' ? '' : ' delayed'}">${age}</span></p>
                            <p>容量資料：${Utils.formatTaipeiTime(reservoir.capacity_recorded_at)}</p>
                        </div>
                    </div>
                </article>`;
        }).join(''));
    }

    // 渲染預警資訊
    renderAlerts() {
        if (!this.elements.alertsContainer) return;
        
        const alertReservoirs = Object.values(this.state.data)
            .filter(reservoir => reservoir.percentage < 50)
            .sort((a, b) => a.percentage - b.percentage);
        
        if (alertReservoirs.length === 0) {
            this.replaceContent(this.elements.alertsContainer, '');
            this.elements.alertsSection.style.display = 'none';
            return;
        }
        
        this.elements.alertsSection.style.display = 'block';
        
        this.replaceContent(this.elements.alertsContainer, alertReservoirs.map(reservoir => {
            const isCritical = reservoir.percentage < 30;
            const alertType = isCritical ? 'critical' : 'warning';
            const alertLevel = isCritical ? '蓄水率低於 30%' : '蓄水率 30–未滿50%';
            
            return `
                <article class="alert-card ${alertType}">
                    <div class="alert-header">
                        <div class="alert-icon ${alertType}">
                            <i class="bi ${isCritical ? 'bi-exclamation-triangle-fill' : 'bi-exclamation-circle-fill'}"></i>
                        </div>
                        <div>
                            <h3 class="alert-title">${Utils.escapeHTML(reservoir.name)}</h3>
                            <div class="alert-level">${alertLevel}</div>
                        </div>
                    </div>
                    <div class="alert-content">
                        <div class="alert-percentage ${alertType}">
                            蓄水率：${reservoir.percentage.toFixed(1)}%
                        </div>
                        <div class="alert-description">
                            這是本站依蓄水率分組的提醒，不是官方限水或停水警報；需配合季節與供水調度判讀。
                        </div>
                    </div>
                    <div class="alert-footer">
                        <span>水量觀測：${Utils.formatTaipeiTime(reservoir.observed_at)}</span>
                        <button type="button" class="alert-action" data-reservoir-target="${Utils.escapeHTML(reservoir.name)}" aria-label="查看${Utils.escapeHTML(reservoir.name)}詳情">查看詳情 ↗</button>
                    </div>
                </article>
            `;
        }).join(''));
    }
    
    // Reveal a hidden target, then move focus as well as the viewport.
    scrollToReservoir(reservoirName) {
        const reservoir = Object.values(this.state.data).find(row => row.name === reservoirName);
        if (!reservoir) return false;
        if (this.state.currentRegion !== 'all' && this.state.currentRegion !== reservoir.region) {
            this.setCurrentRegion(reservoir.region);
        }
        const card = [...document.querySelectorAll('[data-reservoir]')].find(element => element.dataset.reservoir === reservoirName);
        if (!card) return false;
        card.focus({ preventScroll: true });
        Utils.scrollToElement(card, 350);
        return true;
    }

    // 設置滾動監聽
    setupScrollListeners() {
        const scrollToTop = this.elements.scrollToTop;
        if (!scrollToTop) return;
        
        const handleScroll = Utils.throttle(() => {
            const scrollY = window.pageYOffset;
            
            if (scrollY > 500) {
                scrollToTop.classList.add('visible');
            } else {
                scrollToTop.classList.remove('visible');
            }
        }, 100);
        
        window.addEventListener('scroll', handleScroll);
    }
    
    // 啟動自動刷新
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
            }, 5 * 60 * 1000); // 每5分鐘刷新
        }
    }
    
    // 停止自動刷新
    stopAutoRefresh() {
        if (this.state.refreshInterval) {
            clearInterval(this.state.refreshInterval);
            this.state.refreshInterval = null;
        }
    }
    
    // 切換自動刷新
    toggleAutoRefresh() {
        this.state.autoRefresh = !this.state.autoRefresh;
        
        if (this.state.autoRefresh) {
            this.startAutoRefresh();
            Utils.showNotification('已開啟自動刷新', 'info', 2000);
        } else {
            this.stopAutoRefresh();
            Utils.showNotification('已關閉自動刷新', 'info', 2000);
        }
    }
    
    // 顯示錯誤訊息
    showError(message) {
        Utils.showNotification(message, 'error', 5000);
    }
    
    // 清理資源
    cleanup() {
        this.stopAutoRefresh();
        window.chartManager.destroyAllCharts();
        this.events = {};
    }
}

// 在 DOM 載入完成後初始化應用程式
document.addEventListener('DOMContentLoaded', () => {
    window.app = new ReservoirApp();
});

// 匯出給全域使用
window.ReservoirApp = ReservoirApp;
