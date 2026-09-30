// 圖表處理模組
class ChartManager {
    constructor() {
        this.charts = new Map();
        this.defaultOptions = {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    titleColor: '#ffffff',
                    bodyColor: '#ffffff',
                    borderColor: '#3b82f6',
                    borderWidth: 1,
                    cornerRadius: 8,
                    titleFont: {
                        size: 14,
                        weight: 'bold'
                    },
                    bodyFont: {
                        size: 14
                    }
                }
            }
        };
    }
    
    // 創建總覽橫條圖
    createOverviewChart(canvasId, data) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) {
            console.error(`找不到 canvas 元素: ${canvasId}`);
            return null;
        }
        
        // 銷毀現有圖表
        this.destroyChart(canvasId);
        
        // 準備資料
        const reservoirs = Object.values(data).sort((a, b) => a.percentage - b.percentage);
        
        const chartData = {
            labels: reservoirs.map(r => r.name),
            datasets: [{
                data: reservoirs.map(r => r.percentage),
                backgroundColor: reservoirs.map(r => Utils.getWaterLevelColor(r.percentage)),
                borderColor: reservoirs.map(r => Utils.getWaterLevelColor(r.percentage)),
                borderWidth: 2,
                borderRadius: 6,
                borderSkipped: false
            }]
        };
        
        const config = {
            type: 'bar',
            data: chartData,
            options: {
                ...this.defaultOptions,
                indexAxis: 'y',
                layout: {
                    padding: {
                        left: 10,
                        right: 20,
                        top: 20,
                        bottom: 10
                    }
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        suggestedMax: 100,
                        grid: {
                            color: 'rgba(0, 0, 0, 0.1)',
                            drawBorder: false
                        },
                        ticks: {
                            callback: function(value) {
                                return value + '%';
                            },
                            color: '#64748b',
                            font: {
                                size: 14
                            }
                        }
                    },
                    y: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            color: '#1e293b',
                            font: {
                                size: 14,
                                weight: '500'
                            }
                        }
                    }
                },
                plugins: {
                    ...this.defaultOptions.plugins,
                    tooltip: {
                        ...this.defaultOptions.plugins.tooltip,
                        callbacks: {
                            title: function(context) {
                                const reservoir = reservoirs[context[0].dataIndex];
                                return `${reservoir.name} (${reservoir.county})`;
                            },
                            label: function(context) {
                                const reservoir = reservoirs[context.dataIndex];
                                return [
                                    `蓄水率: ${reservoir.percentage.toFixed(1)}%`,
                                    `有效容量: ${Utils.formatNumber(reservoir.effective_capacity)} 萬立方公尺`,
                                    `觀測蓄水量: ${Utils.formatNumber(reservoir.effective_water_storage)} 萬立方公尺`,
                                    `水量觀測: ${Utils.formatTaipeiTime(reservoir.observed_at)}`,
                                    `容量資料: ${Utils.formatTaipeiTime(reservoir.capacity_recorded_at)}`
                                ];
                            }
                        }
                    }
                },
                onHover: (event, activeElements) => {
                    canvas.style.cursor = activeElements.length > 0 ? 'pointer' : 'default';
                }
            }
        };
        
        try {
            const chart = new Chart(canvas.getContext('2d'), config);
            this.charts.set(canvasId, chart);
            
            // 添加點擊事件
            canvas.onclick = (event) => {
                const points = chart.getElementsAtEventForMode(event, 'nearest', { intersect: true }, true);
                if (points.length) {
                    const reservoir = reservoirs[points[0].index];
                    this.onChartClick(reservoir);
                }
            };
            
            return chart;
        } catch (error) {
            console.error('創建總覽圖表時發生錯誤:', error);
            return null;
        }
    }
    
    // 創建圓餅圖
    createDonutChart(canvasId, data) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return null;
        
        this.destroyChart(canvasId);
        
        // 統計各狀態的水庫數量
        const reservoirs = Object.values(data);
        const stats = {
            sufficient: reservoirs.filter(r => r.percentage >= 80).length,
            normal: reservoirs.filter(r => r.percentage >= 50 && r.percentage < 80).length,
            low: reservoirs.filter(r => r.percentage >= 30 && r.percentage < 50).length,
            critical: reservoirs.filter(r => r.percentage < 30).length
        };
        
        const chartData = {
            labels: ['≥80%', '50–80%', '30–50%', '<30%'],
            datasets: [{
                data: [stats.sufficient, stats.normal, stats.low, stats.critical],
                backgroundColor: ['#10b981', '#3b82f6', '#f59e0b', '#ef4444'],
                borderColor: '#ffffff',
                borderWidth: 3,
                hoverBorderWidth: 4
            }]
        };
        
        const config = {
            type: 'doughnut',
            data: chartData,
            options: {
                ...this.defaultOptions,
                cutout: '70%',
                plugins: {
                    legend: {
                        display: true,
                        position: 'bottom',
                        labels: {
                            padding: 20,
                            font: {
                                size: 14,
                                weight: '500'
                            },
                            color: '#1e293b'
                        }
                    },
                    tooltip: {
                        ...this.defaultOptions.plugins.tooltip,
                        callbacks: {
                            label: function(context) {
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = ((context.parsed / total) * 100).toFixed(1);
                                return `${context.label}: ${context.parsed} 座 (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        };
        
        try {
            const chart = new Chart(canvas.getContext('2d'), config);
            this.charts.set(canvasId, chart);
            return chart;
        } catch (error) {
            console.error('創建圓餅圖時發生錯誤:', error);
            return null;
        }
    }
    
    // 尚未接入經驗證的歷史資料，不能以隨機數生成水情趨勢。
    createTrendChart(canvasId) {
        this.destroyChart(canvasId);
        return null;
    }

    // 創建地區對比圖
    createRegionComparisonChart(canvasId, data) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return null;
        
        this.destroyChart(canvasId);
        
        // 按地區統計資料
        const regionStats = {};
        Object.values(data).forEach(reservoir => {
            const region = reservoir.region;
            if (!regionStats[region]) {
                regionStats[region] = {
                    reservoirs: [],
                    total: 0,
                    average: 0
                };
            }
            regionStats[region].reservoirs.push(reservoir);
        });
        
        // 計算各地區合計蓄水率（容量加權）
        Object.keys(regionStats).forEach(region => {
            const reservoirs = regionStats[region].reservoirs;
            regionStats[region].total = reservoirs.length;
            regionStats[region].average = Utils.getStorageSummary(reservoirs).weightedPercentage;
        });
        
        const regionNames = {
            north: '北部',
            central: '中部',
            south: '南部',
            east: '東部'
        };
        
        const labels = Object.keys(regionStats).map(region => regionNames[region] || region);
        const averages = Object.values(regionStats).map(stat => stat.average);
        const colors = averages.map(avg => Utils.getWaterLevelColor(avg));
        
        const chartData = {
            labels,
            datasets: [{
                label: '合計蓄水率（容量加權）',
                data: averages,
                backgroundColor: colors,
                borderColor: colors,
                borderWidth: 2,
                borderRadius: 8,
                borderSkipped: false
            }]
        };
        
        const config = {
            type: 'bar',
            data: chartData,
            options: {
                ...this.defaultOptions,
                scales: {
                    x: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            color: '#1e293b',
                            font: {
                                size: 14,
                                weight: '500'
                            }
                        }
                    },
                    y: {
                        beginAtZero: true,
                        suggestedMax: 100,
                        grid: {
                            color: 'rgba(0, 0, 0, 0.1)',
                            drawBorder: false
                        },
                        ticks: {
                            callback: function(value) {
                                return value + '%';
                            },
                            color: '#64748b',
                            font: { size: 14 }
                        }
                    }
                },
                plugins: {
                    tooltip: {
                        ...this.defaultOptions.plugins.tooltip,
                        callbacks: {
                            title: function(context) {
                                const region = Object.keys(regionStats)[context[0].dataIndex];
                                const stat = regionStats[region];
                                return `${labels[context[0].dataIndex]} (${stat.total}座水庫)`;
                            },
                            label: function(context) {
                                return `合計蓄水率（容量加權）: ${context.parsed.y.toFixed(1)}%`;
                            }
                        }
                    }
                }
            }
        };
        
        try {
            const chart = new Chart(canvas.getContext('2d'), config);
            this.charts.set(canvasId, chart);
            return chart;
        } catch (error) {
            console.error('創建地區對比圖時發生錯誤:', error);
            return null;
        }
    }
    
    // 銷毀指定圖表
    destroyChart(canvasId) {
        const canvas = document.getElementById(canvasId);
        if (canvas) canvas.onclick = null;
        if (this.charts.has(canvasId)) {
            this.charts.get(canvasId).destroy();
            this.charts.delete(canvasId);
        }
    }
    
    // 銷毀所有圖表
    destroyAllCharts() {
        for (const canvasId of [...this.charts.keys()]) {
            this.destroyChart(canvasId);
        }
    }
    
    // 圖表點擊事件處理
    onChartClick(reservoir) {
        // 可以在這裡添加點擊水庫時的行為
        console.log('點擊了水庫:', reservoir.name);
        
        // 例如：滾動到對應的水庫卡片
        const reservoirCard = document.querySelector(`[data-reservoir="${reservoir.name}"]`);
        if (reservoirCard) {
            Utils.scrollToElement(reservoirCard, 600);
            
            // 添加高亮效果
            reservoirCard.style.outline = '3px solid #3b82f6';
            reservoirCard.style.outlineOffset = '4px';
            
            setTimeout(() => {
                reservoirCard.style.outline = '';
                reservoirCard.style.outlineOffset = '';
            }, 2000);
        }
    }
    
    // 響應式調整
    resizeCharts() {
        this.charts.forEach(chart => {
            if (chart && typeof chart.resize === 'function') {
                chart.resize();
            }
        });
    }
    
    // 更新圖表資料
    updateChart(canvasId, newData) {
        const chart = this.charts.get(canvasId);
        if (!chart) return;
        
        try {
            // 根據圖表類型更新資料
            if (canvasId === 'overview-chart') {
                this.createOverviewChart(canvasId, newData);
            } else {
                // 其他圖表的更新邏輯
                chart.update('active');
            }
        } catch (error) {
            console.error(`更新圖表 ${canvasId} 時發生錯誤:`, error);
        }
    }
}

// 監聽視窗大小變化
window.addEventListener('resize', Utils.debounce(() => {
    if (window.chartManager) {
        window.chartManager.resizeCharts();
    }
}, 250));

// 建立全域圖表管理器
window.chartManager = new ChartManager();