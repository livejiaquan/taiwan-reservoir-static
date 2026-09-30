// API 處理模組
class ReservoirAPI extends Utils.EventEmitter {
    constructor() {
        super();
        
        // 水利署開放資料 API。這兩個端點允許瀏覽器跨網域 GET，
        // 適用於 GitHub Pages 之類的純靜態網站。
        this.endpoints = {
            realtime: 'https://opendata.wra.gov.tw/api/v2/2be9044c-6e44-4856-aad5-dd108c2e6679?format=JSON&size=1000',
            daily: 'https://opendata.wra.gov.tw/api/v2/51023e88-4c76-4dbc-bbb9-470da690d539?format=JSON&size=1000'
        };
        
        // 請求配置
        this.requestConfig = {
            timeout: 15000,
            retries: 2,
            retryDelay: 1000
        };
        
        // 快取配置
        this.cache = {
            // v4 preserves source timestamps and invalidates older incomplete metadata.
            key: 'reservoir_data_cache_v4',
            duration: 5 * 60 * 1000, // 5分鐘
            data: null,
            timestamp: null
        };
        
        // 水庫站點對照表
        this.stationMapping = {
            "10201": { name: "石門水庫", county: "桃園市", region: "north" },
            "10204": { name: "新山水庫", county: "基隆市", region: "north" },
            "10205": { name: "翡翠水庫", county: "新北市", region: "north" },
            "10401": { name: "寶山水庫", county: "新竹縣", region: "north" },
            "10405": { name: "寶山第二水庫", county: "新竹縣", region: "north" },
            "10501": { name: "永和山水庫", county: "苗栗縣", region: "central" },
            "10601": { name: "明德水庫", county: "苗栗縣", region: "central" },
            "20101": { name: "鯉魚潭水庫", county: "苗栗縣", region: "central" },
            "20201": { name: "德基水庫", county: "台中市", region: "central" },
            "20501": { name: "霧社水庫", county: "南投縣", region: "central" },
            "20502": { name: "日月潭水庫", county: "南投縣", region: "central" },
            "20509": { name: "湖山水庫", county: "雲林縣", region: "central" },
            "30301": { name: "仁義潭水庫", county: "嘉義縣", region: "south" },
            "30302": { name: "蘭潭水庫", county: "嘉義市", region: "south" },
            "30401": { name: "白河水庫", county: "台南市", region: "south" },
            "30501": { name: "烏山頭水庫", county: "台南市", region: "south" },
            "30502": { name: "曾文水庫", county: "台南市", region: "south" },
            "30503": { name: "南化水庫", county: "台南市", region: "south" },
            "30802": { name: "阿公店水庫", county: "高雄市", region: "south" },
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
            
            if (age >= 0 && age < this.cache.duration) {
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
            if (age >= 0 && age < this.cache.duration) {
                try {
                    this.validateSnapshot(this.cache.data);
                    return this.cache.data;
                } catch {
                    this.clearCache();
                }
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
                cache: 'no-store',
                headers: {
                    'Accept': 'application/json',
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
    
    // 合併每小時水情與每日有效容量資料
    parseOpenData(realtimeData, dailyData) {
        if (!Array.isArray(realtimeData) || !Array.isArray(dailyData)) {
            throw new Error('無效的 API 資料格式');
        }

        const capacities = new Map();
        const readNumber = value => (typeof value === 'number' || (typeof value === 'string' && value.trim()))
            ? Number(value) : NaN;
        for (const item of dailyData) {
            const stationNo = item.reservoiridentifier;
            const capacity = readNumber(item.capacity);
            const timestamp = Utils.parseSourceTime(item.datetime);
            const current = capacities.get(stationNo);
            if (this.stationMapping[stationNo] && Number.isFinite(capacity) && capacity > 0
                && (!current || (timestamp !== null && (current.timestamp === null || timestamp > current.timestamp)))) {
                capacities.set(stationNo, { capacity, timestamp });
            }
        }

        // 不按原始字串或回傳順序排序，以同一時基選取最新觀測。
        const latestReadings = new Map();
        for (const item of realtimeData) {
            const stationNo = item.reservoiridentifier;
            if (!this.stationMapping[stationNo]) continue;
            const timestamp = Utils.parseSourceTime(item.observationtime);
            if (timestamp === null) continue;
            const current = latestReadings.get(stationNo);
            if (!current || timestamp > current.timestamp) {
                latestReadings.set(stationNo, { item, timestamp });
            }
        }

        const reservoirs = {};
        for (const [stationNo, { item, timestamp }] of latestReadings) {
            const stationInfo = this.stationMapping[stationNo];
            const capacityRecord = capacities.get(stationNo);
            const effectiveStorage = readNumber(item.effectivewaterstoragecapacity);
            if (!capacityRecord || !Number.isFinite(effectiveStorage) || effectiveStorage < 0) continue;
            const effectiveCapacity = capacityRecord.capacity;
            const percentage = effectiveStorage / effectiveCapacity * 100;
            if (!Number.isFinite(percentage)) continue;
            reservoirs[stationInfo.name] = {
                name: stationInfo.name,
                effective_capacity: effectiveCapacity,
                effective_water_storage: effectiveStorage,
                percentage: Math.round(percentage * 100) / 100,
                county: stationInfo.county,
                region: stationInfo.region,
                observed_at: timestamp,
                capacity_recorded_at: capacityRecord.timestamp,
                update_time: Utils.formatTaipeiTime(timestamp),
                station_no: stationNo
            };
        }

        return reservoirs;
    }

    validateSnapshot(data, now = Date.now()) {
        const reservoirs = Object.values(data);
        const minimumCoverage = Math.ceil(Object.keys(this.stationMapping).length / 2);
        const mappedStationIds = new Set(
            reservoirs
                .map(reservoir => reservoir.station_no)
                .filter(stationNo => this.stationMapping[stationNo])
        );
        if (mappedStationIds.size < minimumCoverage) {
            throw new Error(`官方資料涵蓋不足：本站 20 座清單中僅 ${mappedStationIds.size} 座可用，至少需 ${minimumCoverage} 座`);
        }

        const maximumAge = 48 * 60 * 60 * 1000;
        const maximumFutureSkew = 60 * 60 * 1000;
        for (const reservoir of reservoirs) {
            const timestamp = reservoir.observed_at;
            if (!Number.isFinite(timestamp)) {
                throw new Error('官方資料缺少有效觀測時間');
            }
            if (!Number.isFinite(reservoir.effective_capacity) || reservoir.effective_capacity <= 0
                || !Number.isFinite(reservoir.effective_water_storage) || reservoir.effective_water_storage < 0
                || !Number.isFinite(reservoir.percentage) || reservoir.percentage < 0) {
                throw new Error('官方資料缺少有效容量或蓄水量');
            }
            if (now - timestamp > maximumAge) {
                throw new Error('官方資料過期，無法作為目前水情');
            }
            if (timestamp - now > maximumFutureSkew) {
                throw new Error('官方資料觀測時間異常');
            }
        }
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
            
            // 同時取得即時蓄水量與有效容量
            console.log('嘗試從水利署開放資料 API 獲取資料...');
            
            try {
                const data = await this.withRetry(async () => {
                    const [realtimeResponse, dailyResponse] = await Promise.all([
                        this.makeRequest(this.endpoints.realtime),
                        this.makeRequest(this.endpoints.daily)
                    ]);
                    const [realtimeData, dailyData] = await Promise.all([
                        realtimeResponse.json(),
                        dailyResponse.json()
                    ]);
                    const parsedData = this.parseOpenData(realtimeData, dailyData);

                    // HTTP 200 仍可能是 WAF、殘缺或過期內容；通過信任檢查才顯示。
                    this.validateSnapshot(parsedData);

                    return parsedData;
                });

                console.log(`成功從水利署開放資料 API 獲取 ${Object.keys(data).length} 座水庫資料`);
                this.saveCache(data);
                this.emit('fetchSuccess', data);
                return data;
            } catch (error) {
                console.warn('水利署開放資料 API 失敗:', error.message);
                throw new Error(`水利署資料目前無法取得：${error.message}`);
            }

        } catch (error) {
            this.clearCache();
            const errorInfo = Utils.handleError(error, '獲取水庫資料');
            this.emit('fetchError', errorInfo);

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
        
        return {
            total: reservoirs.length,
            ...Utils.getStorageSummary(reservoirs),
            sufficient: reservoirs.filter(r => r.percentage >= 80).length,
            normal: reservoirs.filter(r => r.percentage >= 50 && r.percentage < 80).length,
            low: reservoirs.filter(r => r.percentage >= 30 && r.percentage < 50).length,
            critical: reservoirs.filter(r => r.percentage < 30).length
        };
    }

    // 擷取時間來自成功網路回應的快取記錄，讀取快取不會改寫時間。
    getSnapshotMetadata(data = this.cache.data) {
        const reservoirs = Object.values(data || {});
        const ids = new Set(reservoirs.map(r => r.station_no));
        const observedTimes = reservoirs.map(r => r.observed_at).filter(Number.isFinite);
        return {
            fetchedAt: this.cache.timestamp,
            observedFrom: observedTimes.length ? Math.min(...observedTimes) : null,
            observedTo: observedTimes.length ? Math.max(...observedTimes) : null,
            covered: ids.size,
            expected: Object.keys(this.stationMapping).length,
            missing: Object.entries(this.stationMapping).filter(([id]) => !ids.has(id)).map(([, station]) => station.name),
            unknownCapacityTimes: reservoirs.filter(r => !Number.isFinite(r.capacity_recorded_at)).length
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
            await Promise.all([
                this.makeRequest(this.endpoints.realtime),
                this.makeRequest(this.endpoints.daily)
            ]);
            return { status: 'online', endpoint: 'wra-open-data' };
        } catch {
            return { status: 'offline', endpoint: null };
        }
    }
}

// 建立全域 API 實例
window.ReservoirAPI = ReservoirAPI;
window.api = new ReservoirAPI();
