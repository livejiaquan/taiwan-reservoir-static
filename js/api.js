// API 處理模組
class ReservoirAPI extends Utils.EventEmitter {
    constructor() {
        super();
        
        // API 端點
        this.endpoints = {
            primary: 'https://fhy.wra.gov.tw/WraApi/v1/Reservoir/RealTimeInfo',
            backup: 'https://fhy.wra.gov.tw/ReservoirPage_2011/StorageCapacity.aspx'
        };
        
        // 請求配置
        this.requestConfig = {
            timeout: 15000,
            retries: 3,
            retryDelay: 1000
        };
        
        // 快取配置
        this.cache = {
            key: 'reservoir_data_cache',
            duration: 5 * 60 * 1000, // 5分鐘
            data: null,
            timestamp: null
        };
        
        // 水庫站點對照表
        this.stationMapping = {
            "10201": { name: "石門水庫", county: "桃園市", region: "north" },
            "10203": { name: "新山水庫", county: "基隆市", region: "north" }, 
            "10204": { name: "翡翠水庫", county: "新北市", region: "north" },
            "10205": { name: "翡翠水庫", county: "新北市", region: "north" },
            "10211": { name: "寶山水庫", county: "新竹縣", region: "north" },
            "10212": { name: "寶山第二水庫", county: "新竹縣", region: "north" },
            "10401": { name: "永和山水庫", county: "苗栗縣", region: "central" },
            "10405": { name: "明德水庫", county: "苗栗縣", region: "central" },
            "10501": { name: "鯉魚潭水庫", county: "苗栗縣", region: "central" },
            "10503": { name: "德基水庫", county: "台中市", region: "central" },
            "10601": { name: "霧社水庫", county: "南投縣", region: "central" },
            "20101": { name: "日月潭水庫", county: "南投縣", region: "central" },
            "20201": { name: "德基水庫", county: "台中市", region: "central" },
            "20509": { name: "湖山水庫", county: "雲林縣", region: "central" },
            "30301": { name: "仁義潭水庫", county: "嘉義縣", region: "south" },
            "30302": { name: "蘭潭水庫", county: "嘉義市", region: "south" },
            "30501": { name: "白河水庫", county: "台南市", region: "south" },
            "30502": { name: "曾文水庫", county: "台南市", region: "south" },
            "30503": { name: "烏山頭水庫", county: "台南市", region: "south" },
            "30504": { name: "南化水庫", county: "台南市", region: "south" },
            "30801": { name: "阿公店水庫", county: "高雄市", region: "south" },
            "31201": { name: "牡丹水庫", county: "屏東縣", region: "south" }
        };
        
        // 載入快取的資料
        this.loadCache();
    }
    
    // 載入快取資料
    loadCache() {
        const cached = Utils.LocalStorage.get(this.cache.key);
        if (cached && cached.timestamp && cached.data) {
            const now = Date.now();
            const age = now - cached.timestamp;
            
            if (age < this.cache.duration) {
                this.cache.data = cached.data;
                this.cache.timestamp = cached.timestamp;
                console.log('已載入快取的水庫資料');
                return true;
            }
        }
        return false;
    }
    
    // 儲存快取資料
    saveCache(data) {
        const cacheData = {
            data,
            timestamp: Date.now()
        };
        
        Utils.LocalStorage.set(this.cache.key, cacheData);
        this.cache.data = data;
        this.cache.timestamp = cacheData.timestamp;
    }
    
    // 取得快取資料
    getCachedData() {
        if (this.cache.data && this.cache.timestamp) {
            const age = Date.now() - this.cache.timestamp;
            if (age < this.cache.duration) {
                return this.cache.data;
            }
        }
        return null;
    }
    
    // HTTP 請求包裝器
    async makeRequest(url, options = {}) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.requestConfig.timeout);
        
        try {
            const response = await fetch(url, {
                ...options,
                signal: controller.signal,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; ReservoirMonitor/1.0)',
                    'Accept': 'application/json,text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    ...options.headers
                }
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            return response;
        } catch (error) {
            clearTimeout(timeoutId);
            
            if (error.name === 'AbortError') {
                throw new Error('請求超時');
            }
            
            throw error;
        }
    }
    
    // 重試包裝器
    async withRetry(fn, retries = this.requestConfig.retries) {
        let lastError;
        
        for (let i = 0; i <= retries; i++) {
            try {
                return await fn();
            } catch (error) {
                lastError = error;
                
                if (i < retries) {
                    const delay = this.requestConfig.retryDelay * (i + 1);
                    console.log(`請求失敗，${delay}ms 後重試 (${i + 1}/${retries})...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                } else {
                    console.error('重試次數已用盡');
                }
            }
        }
        
        throw lastError;
    }
    
    // 解析即時 API 資料
    parseRealtimeData(data) {
        if (!Array.isArray(data)) {
            throw new Error('無效的 API 資料格式');
        }
        
        const reservoirs = {};
        const processed = new Set();
        
        for (const item of data) {
            const stationNo = item.StationNo;
            const stationInfo = this.stationMapping[stationNo];
            
            if (!stationInfo) continue;
            
            const name = stationInfo.name;
            
            // 避免重複處理同一水庫
            if (processed.has(name)) continue;
            
            try {
                const percentage = parseFloat(item.PercentageOfStorage) || 0;
                const effectiveStorage = parseFloat(item.EffectiveStorage) || 0;
                
                // 只處理有效資料
                if (percentage <= 0 || effectiveStorage <= 0) continue;
                
                // 計算有效容量
                const effectiveCapacity = effectiveStorage / (percentage / 100);
                
                // 格式化時間
                let updateTime;
                try {
                    const dt = new Date(item.Time);
                    updateTime = dt.toLocaleString('zh-TW', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit'
                    });
                } catch {
                    updateTime = new Date().toLocaleString('zh-TW', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit'
                    });
                }
                
                reservoirs[name] = {
                    name,
                    effective_capacity: effectiveCapacity / 10000, // 轉換為萬立方公尺
                    effective_water_storage: effectiveStorage / 10000,
                    percentage: Math.round(percentage * 100) / 100,
                    county: stationInfo.county,
                    region: stationInfo.region,
                    update_time: updateTime,
                    station_no: stationNo
                };
                
                processed.add(name);
            } catch (error) {
                console.warn(`解析站點 ${stationNo} 時發生錯誤:`, error);
                continue;
            }
        }
        
        return reservoirs;
    }
    
    // 取得水庫資料
    async fetchReservoirData(forceRefresh = false) {
        this.emit('fetchStart');
        
        try {
            // 檢查快取
            if (!forceRefresh) {
                const cached = this.getCachedData();
                if (cached) {
                    console.log('使用快取的水庫資料');
                    this.emit('fetchSuccess', cached);
                    return cached;
                }
            }
            
            // 嘗試即時 API
            console.log('嘗試從即時 API 獲取資料...');
            
            try {
                const data = await this.withRetry(async () => {
                    const response = await this.makeRequest(this.endpoints.primary);
                    const jsonData = await response.json();
                    return this.parseRealtimeData(jsonData);
                });
                
                if (Object.keys(data).length > 0) {
                    console.log(`成功從即時 API 獲取 ${Object.keys(data).length} 座水庫資料`);
                    this.saveCache(data);
                    this.emit('fetchSuccess', data);
                    return data;
                }
            } catch (error) {
                console.warn('即時 API 失敗:', error.message);
            }
            
            // 降級到模擬資料
            console.log('使用模擬資料...');
            const mockData = await getMockReservoirData();
            this.saveCache(mockData);
            this.emit('fetchSuccess', mockData);
            return mockData;
            
        } catch (error) {
            const errorInfo = Utils.handleError(error, '獲取水庫資料');
            this.emit('fetchError', errorInfo);
            
            // 嘗試返回快取資料
            if (this.cache.data) {
                console.log('返回過期的快取資料');
                return this.cache.data;
            }
            
            throw error;
        }
    }
    
    // 取得特定地區的水庫資料
    async getReservoirsByRegion(region) {
        const data = await this.fetchReservoirData();
        
        if (region === 'all') return data;
        
        return Object.fromEntries(
            Object.entries(data).filter(([_, reservoir]) => reservoir.region === region)
        );
    }
    
    // 取得需要關注的水庫（蓄水率低於50%）
    async getAlertsData() {
        const data = await this.fetchReservoirData();
        
        return Object.fromEntries(
            Object.entries(data)
                .filter(([_, reservoir]) => reservoir.percentage < 50)
                .sort(([_, a], [__, b]) => a.percentage - b.percentage)
        );
    }
    
    // 取得統計資料
    async getStatistics() {
        const data = await this.fetchReservoirData();
        const reservoirs = Object.values(data);
        
        if (reservoirs.length === 0) {
            return {
                total: 0,
                average: 0,
                sufficient: 0,
                normal: 0,
                low: 0,
                critical: 0,
                totalCapacity: 0,
                totalStorage: 0
            };
        }
        
        return {
            total: reservoirs.length,
            average: reservoirs.reduce((sum, r) => sum + r.percentage, 0) / reservoirs.length,
            sufficient: reservoirs.filter(r => r.percentage >= 80).length,
            normal: reservoirs.filter(r => r.percentage >= 50 && r.percentage < 80).length,
            low: reservoirs.filter(r => r.percentage >= 30 && r.percentage < 50).length,
            critical: reservoirs.filter(r => r.percentage < 30).length,
            totalCapacity: reservoirs.reduce((sum, r) => sum + r.effective_capacity, 0),
            totalStorage: reservoirs.reduce((sum, r) => sum + r.effective_water_storage, 0)
        };
    }
    
    // 清除快取
    clearCache() {
        Utils.LocalStorage.remove(this.cache.key);
        this.cache.data = null;
        this.cache.timestamp = null;
        console.log('快取已清除');
    }
    
    // 檢查 API 狀態
    async checkApiStatus() {
        try {
            await this.makeRequest(this.endpoints.primary, { method: 'HEAD' });
            return { status: 'online', endpoint: 'primary' };
        } catch (error) {
            try {
                await this.makeRequest(this.endpoints.backup, { method: 'HEAD' });
                return { status: 'degraded', endpoint: 'backup' };
            } catch {
                return { status: 'offline', endpoint: null };
            }
        }
    }
}

// 建立全域 API 實例
window.ReservoirAPI = ReservoirAPI;
window.api = new ReservoirAPI();