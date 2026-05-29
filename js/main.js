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
            autoRefresh: true,
            refreshInterval: null
        };
        
        // DOM 元素引用
        this.elements = {
            loadingScreen: document.getElementById('loading-screen'),
            mainContainer: document.getElementById('main-container'),
            lastUpdateTime: document.getElementById('last-update-time'),
            refreshBtn: document.getElementById('refresh-btn'),
            statsGrid: document.getElementById('stats-grid'),
            overviewChart: document.getElementById('overview-chart'),
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
            
            // 初始載入資料
            await this.loadData();
            
            // 隱藏載入畫面
            this.hideLoadingScreen();
            
            // 啟動自動刷新
            this.startAutoRefresh();
            
            // 設置滾動監聽
            this.setupScrollListeners();
            
            console.log('✅ 應用程式初始化完成');
            
        } catch (error) {
            console.error('❌ 應用程式初始化失敗:', error);
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
        this.elements.regionBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const region = e.target.dataset.region;
                this.setCurrentRegion(region);
            });
        });
        
        // 回到頂部按鈕
        if (this.elements.scrollToTop) {
            this.elements.scrollToTop.addEventListener('click', () => {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });
        }
        
        // API 事件監聽
        window.api.on('fetchStart', () => {
            this.setLoading(true);
        });
        
        window.api.on('fetchSuccess', (data) => {
            this.state.data = data;
            this.state.lastUpdate = new Date();
            this.setLoading(false);
            this.renderAll();
        });
        
        window.api.on('fetchError', (error) => {
            this.setLoading(false);
            this.showError(`載入資料失敗: ${error.message}`);
        });
        
        // 視窗事件
        window.addEventListener('beforeunload', () => {
            this.cleanup();
        });
        
        // 鍵盤事件
        document.addEventListener('keydown', (e) => {
            if (e.key === 'F5' || (e.ctrlKey && e.key === 'r')) {
                e.preventDefault();
                this.refreshData();
            }
        });
    }
    
    // 載入資料
    async loadData(forceRefresh = false) {
        try {
            this.state.data = await window.api.fetchReservoirData(forceRefresh);
            this.state.lastUpdate = new Date();
            this.renderAll();
        } catch (error) {
            throw new Error(`載入資料失敗: ${error.message}`);
        }
    }
    
    // 刷新資料
    async refreshData() {
        if (this.state.isLoading) return;
        
        try {
            await this.loadData(true);
            Utils.showNotification('資料已更新', 'success', 2000);
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
        
        this.emit('loadingStateChange', isLoading);
    }
    
    // 隱藏載入畫面
    hideLoadingScreen() {
        if (this.elements.loadingScreen && this.elements.mainContainer) {
            Utils.fadeOut(this.elements.loadingScreen, 500);
            this.elements.mainContainer.classList.remove('hidden');
            
            setTimeout(() => {
                this.elements.loadingScreen.style.display = 'none';
            }, 500);
        }
    }
    
    // 設置當前地區
    setCurrentRegion(region) {
        this.state.currentRegion = region;
        
        // 更新按鈕狀態
        this.elements.regionBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.region === region);
        });
        
        // 重新渲染水庫網格
        this.renderReservoirGrid();
        
        this.emit('regionChange', region);
    }
    
    // 渲染所有組件
    renderAll() {
        this.updateLastUpdateTime();
        this.renderStats();
        this.renderOverviewChart();
        this.renderReservoirGrid();
        this.renderAlerts();
    }
    
    // 更新最後更新時間
    updateLastUpdateTime() {
        if (this.elements.lastUpdateTime && this.state.lastUpdate) {
            this.elements.lastUpdateTime.textContent = this.state.lastUpdate.toLocaleString('zh-TW', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
        }
    }
    
    // 渲染統計卡片
    renderStats() {
        if (!this.elements.statsGrid) return;
        
        const reservoirs = Object.values(this.state.data);
        
        if (reservoirs.length === 0) {
            this.elements.statsGrid.innerHTML = '<div class="empty-state">暫無統計資料</div>';
            return;
        }
        
        const stats = {
            total: reservoirs.length,
            average: reservoirs.reduce((sum, r) => sum + r.percentage, 0) / reservoirs.length,
            sufficient: reservoirs.filter(r => r.percentage >= 80).length,
            normal: reservoirs.filter(r => r.percentage >= 50 && r.percentage < 80).length,
            attention: reservoirs.filter(r => r.percentage < 50).length
        };
        
        const statsData = [
            {
                icon: 'bi-droplet-fill',
                value: stats.total,
                unit: '座',
                label: '水庫總數',
                type: 'info'
            },
            {
                icon: 'bi-graph-up',
                value: stats.average.toFixed(1),
                unit: '%',
                label: '平均蓄水率',
                type: 'primary'
            },
            {
                icon: 'bi-check-circle-fill',
                value: stats.sufficient,
                unit: '座',
                label: '水位充足',
                type: 'success'
            },
            {
                icon: 'bi-dash-circle',
                value: stats.normal,
                unit: '座',
                label: '水位正常',
                type: 'info'
            },
            {
                icon: 'bi-exclamation-triangle-fill',
                value: stats.attention,
                unit: '座',
                label: '需要關注',
                type: stats.attention > 0 ? 'warning' : 'success'
            }
        ];
        
        this.elements.statsGrid.innerHTML = statsData.map((stat, index) => `
            <div class="stat-card ${stat.type} animate-slide-up" style="animation-delay: ${index * 0.1}s">
                <i class="stat-card-icon bi ${stat.icon}"></i>
                <div class="stat-card-value">
                    ${stat.value}
                    <span class="stat-card-unit">${stat.unit}</span>
                </div>
                <div class="stat-card-label">${stat.label}</div>
            </div>
        `).join('');
    }
    
    // 渲染總覽圖表
    renderOverviewChart() {
        if (!this.elements.overviewChart || Object.keys(this.state.data).length === 0) return;
        
        // 使用圖表管理器創建圖表
        window.chartManager.createOverviewChart('overview-chart', this.state.data);
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
        
        if (reservoirs.length === 0) {
            this.elements.reservoirsGrid.innerHTML = `
                <div class="empty-state">
                    <i class="empty-state-icon bi bi-droplet"></i>
                    <h3 class="empty-state-title">暫無水庫資料</h3>
                    <p class="empty-state-description">目前沒有符合條件的水庫資料</p>
                </div>
            `;
            return;
        }
        
        // 按蓄水率排序
        reservoirs.sort((a, b) => b.percentage - a.percentage);
        
        this.elements.reservoirsGrid.innerHTML = reservoirs.map((reservoir, index) => {
            const color = Utils.getWaterLevelColor(reservoir.percentage);
            const status = Utils.getWaterLevelText(reservoir.percentage);
            
            // 計算進度條樣式
            const progressWidth = Math.max(2, reservoir.percentage); // 最少顯示2%避免看不見
            
            // 計算水位指示器
            const maxDrops = 5;
            const activeDrops = Math.ceil((reservoir.percentage / 100) * maxDrops);
            const waterDrops = Array.from({length: maxDrops}, (_, i) => 
                `<div class="water-drop ${i < activeDrops ? 'active' : ''}" style="background-color: ${color}"></div>`
            ).join('');
            
            // 狀態樣式
            let statusBgColor, statusTextColor;
            if (reservoir.percentage >= 80) {
                statusBgColor = 'rgba(16, 185, 129, 0.1)';
                statusTextColor = '#059669';
            } else if (reservoir.percentage >= 50) {
                statusBgColor = 'rgba(59, 130, 246, 0.1)';
                statusTextColor = '#3b82f6';
            } else if (reservoir.percentage >= 30) {
                statusBgColor = 'rgba(245, 158, 11, 0.1)';
                statusTextColor = '#f59e0b';
            } else {
                statusBgColor = 'rgba(239, 68, 68, 0.1)';
                statusTextColor = '#ef4444';
            }
            
            return `
                <div class="reservoir-card animate-slide-up" 
                     data-reservoir="${reservoir.name}"
                     style="animation-delay: ${index * 0.1}s">
                    <div class="reservoir-card-header">
                        <div class="reservoir-name">
                            <i class="bi bi-droplet-fill"></i>
                            ${reservoir.name}
                        </div>
                        <div class="reservoir-location">
                            <i class="bi bi-geo-alt"></i>
                            ${reservoir.county}
                        </div>
                    </div>
                    <div class="reservoir-card-body">
                        <!-- 進度條區域 -->
                        <div class="progress-section">
                            <div class="water-bar" style="--progress-width: ${progressWidth}%; --progress-color: ${color}; --progress-soft: ${statusBgColor};">
                                <div class="water-bar-fill"></div>
                                <div class="water-bar-wave"></div>
                                <div class="water-bar-shine"></div>
                                <div class="water-bar-content">
                                    <strong>${reservoir.percentage.toFixed(1)}<span>%</span></strong>
                                    <small>${status}</small>
                                </div>
                            </div>
                        </div>
                        
                        <!-- 詳細資訊 -->
                        <div class="reservoir-details">
                            <div class="detail-item">
                                <i class="detail-icon bi bi-bucket-fill"></i>
                                <div class="detail-label">有效容量</div>
                                <div class="detail-value">
                                    ${Utils.formatNumber(reservoir.effective_capacity)}
                                    <span class="detail-unit">萬m³</span>
                                </div>
                            </div>
                            <div class="detail-item">
                                <i class="detail-icon bi bi-droplet-half"></i>
                                <div class="detail-label">目前水量</div>
                                <div class="detail-value">
                                    ${Utils.formatNumber(reservoir.effective_water_storage)}
                                    <span class="detail-unit">萬m³</span>
                                </div>
                            </div>
                            <div class="detail-item">
                                <i class="detail-icon bi bi-speedometer2"></i>
                                <div class="detail-label">蓄水率</div>
                                <div class="detail-value" style="color: ${color}">
                                    ${Utils.formatPercentage(reservoir.percentage)}
                                </div>
                            </div>
                            <div class="detail-item">
                                <i class="detail-icon bi bi-activity"></i>
                                <div class="detail-label">水位狀態</div>
                                <div class="detail-value" style="color: ${color}">
                                    ${status}
                                </div>
                            </div>
                        </div>
                        
                        <!-- 更新時間 -->
                        <div class="reservoir-update-time">
                            <i class="bi bi-clock"></i>
                            最後更新：${reservoir.update_time}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }
    
    // 渲染預警資訊
    renderAlerts() {
        if (!this.elements.alertsContainer) return;
        
        const alertReservoirs = Object.values(this.state.data)
            .filter(reservoir => reservoir.percentage < 50)
            .sort((a, b) => a.percentage - b.percentage);
        
        if (alertReservoirs.length === 0) {
            this.elements.alertsSection.style.display = 'none';
            return;
        }
        
        this.elements.alertsSection.style.display = 'block';
        
        this.elements.alertsContainer.innerHTML = alertReservoirs.map((reservoir, index) => {
            const isCritical = reservoir.percentage < 30;
            const alertType = isCritical ? 'critical' : 'warning';
            const alertLevel = isCritical ? '嚴重缺水' : '水位偏低';
            const alertColor = isCritical ? 'var(--danger-color)' : 'var(--warning-color)';
            
            return `
                <div class="alert-card ${alertType} animate-slide-left" 
                     style="animation-delay: ${index * 0.1}s">
                    <div class="alert-header">
                        <div class="alert-icon ${alertType}">
                            <i class="bi ${isCritical ? 'bi-exclamation-triangle-fill' : 'bi-exclamation-circle-fill'}"></i>
                        </div>
                        <div>
                            <div class="alert-title">${reservoir.name}</div>
                            <div class="alert-level">${alertLevel}</div>
                        </div>
                    </div>
                    <div class="alert-content">
                        <div class="alert-reservoir">${reservoir.county} ${reservoir.name}</div>
                        <div class="alert-percentage ${alertType}">
                            蓄水率：${reservoir.percentage.toFixed(1)}%
                        </div>
                        <div class="alert-description">
                            ${isCritical 
                                ? '水位嚴重偏低，請密切關注水情發展，並做好節水準備。'
                                : '水位低於正常標準，建議關注後續水情變化。'
                            }
                        </div>
                    </div>
                    <div class="alert-footer">
                        <span>更新：${reservoir.update_time}</span>
                        <a href="#" class="alert-action" onclick="app.scrollToReservoir('${reservoir.name}')">
                            <i class="bi bi-arrow-right"></i>
                            查看詳情
                        </a>
                    </div>
                </div>
            `;
        }).join('');
    }
    
    // 滾動到指定水庫
    scrollToReservoir(reservoirName) {
        const card = document.querySelector(`[data-reservoir="${reservoirName}"]`);
        if (card) {
            Utils.scrollToElement(card, 600);
            
            // 高亮效果
            card.style.outline = '3px solid var(--primary-color)';
            card.style.outlineOffset = '4px';
            
            setTimeout(() => {
                card.style.outline = '';
                card.style.outlineOffset = '';
            }, 3000);
        }
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
                    this.loadData(true);
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
        this.removeAllListeners();
    }
}

// 在 DOM 載入完成後初始化應用程式
document.addEventListener('DOMContentLoaded', () => {
    window.app = new ReservoirApp();
});

// 匯出給全域使用
window.ReservoirApp = ReservoirApp;
