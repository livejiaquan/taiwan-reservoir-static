// 模擬水庫資料
const MOCK_RESERVOIR_DATA = {
    '翡翠水庫': {
        name: '翡翠水庫',
        effective_capacity: 4060,
        effective_water_storage: 3250,
        percentage: 80.04,
        county: '新北市',
        region: 'north',
        update_time: '2025-01-27 14:30',
        station_no: '10204',
        description: '供應大台北地區用水的重要水庫',
        full_capacity: 4200
    },
    '石門水庫': {
        name: '石門水庫',
        effective_capacity: 3091.3,
        effective_water_storage: 1850,
        percentage: 59.84,
        county: '桃園市',
        region: 'north',
        update_time: '2025-01-27 14:30',
        station_no: '10201',
        description: '桃園地區重要水源，兼具發電功能',
        full_capacity: 3200
    },
    '德基水庫': {
        name: '德基水庫',
        effective_capacity: 1630,
        effective_water_storage: 980,
        percentage: 60.12,
        county: '台中市',
        region: 'central',
        update_time: '2025-01-27 14:30',
        station_no: '10503',
        description: '中部地區重要水庫，位於大甲溪上游',
        full_capacity: 1690
    },
    '曾文水庫': {
        name: '曾文水庫',
        effective_capacity: 6000,
        effective_water_storage: 4200,
        percentage: 70.00,
        county: '台南市',
        region: 'south',
        update_time: '2025-01-27 14:30',
        station_no: '30502',
        description: '台灣最大的水庫，供應嘉南地區用水',
        full_capacity: 6200
    },
    '阿公店水庫': {
        name: '阿公店水庫',
        effective_capacity: 210,
        effective_water_storage: 180,
        percentage: 85.71,
        county: '高雄市',
        region: 'south',
        update_time: '2025-01-27 14:30',
        station_no: '30801',
        description: '高雄地區重要水源之一',
        full_capacity: 220
    },
    '日月潭水庫': {
        name: '日月潭水庫',
        effective_capacity: 1500,
        effective_water_storage: 1200,
        percentage: 80.00,
        county: '南投縣',
        region: 'central',
        update_time: '2025-01-27 14:30',
        station_no: '20101',
        description: '兼具觀光與發電功能的高山湖泊水庫',
        full_capacity: 1550
    },
    '鯉魚潭水庫': {
        name: '鯉魚潭水庫',
        effective_capacity: 1180,
        effective_water_storage: 950,
        percentage: 80.51,
        county: '苗栗縣',
        region: 'central',
        update_time: '2025-01-27 14:30',
        station_no: '10501',
        description: '苗栗地區主要水源',
        full_capacity: 1220
    },
    '寶山第二水庫': {
        name: '寶山第二水庫',
        effective_capacity: 345,
        effective_water_storage: 280,
        percentage: 81.16,
        county: '新竹縣',
        region: 'north',
        update_time: '2025-01-27 14:30',
        station_no: '10212',
        description: '新竹科學園區重要供水來源',
        full_capacity: 360
    },
    '南化水庫': {
        name: '南化水庫',
        effective_capacity: 1580,
        effective_water_storage: 1264,
        percentage: 80.00,
        county: '台南市',
        region: 'south',
        update_time: '2025-01-27 14:30',
        station_no: '30504',
        description: '台南地區重要水源',
        full_capacity: 1630
    },
    '牡丹水庫': {
        name: '牡丹水庫',
        effective_capacity: 300,
        effective_water_storage: 195,
        percentage: 65.00,
        county: '屏東縣',
        region: 'south',
        update_time: '2025-01-27 14:30',
        station_no: '31201',
        description: '屏東恆春半島主要水源',
        full_capacity: 310
    },
    '湖山水庫': {
        name: '湖山水庫',
        effective_capacity: 550,
        effective_water_storage: 385,
        percentage: 70.00,
        county: '雲林縣',
        region: 'central',
        update_time: '2025-01-27 14:30',
        station_no: '20509',
        description: '雲林地區重要水源',
        full_capacity: 570
    },
    '白河水庫': {
        name: '白河水庫',
        effective_capacity: 127,
        effective_water_storage: 101.6,
        percentage: 80.00,
        county: '台南市',
        region: 'south',
        update_time: '2025-01-27 14:30',
        station_no: '30501',
        description: '台南地區輔助水源',
        full_capacity: 132
    },
    '蘭潭水庫': {
        name: '蘭潭水庫',
        effective_capacity: 46.4,
        effective_water_storage: 27.8,
        percentage: 60.00,
        county: '嘉義市',
        region: 'south',
        update_time: '2025-01-27 14:30',
        station_no: '30302',
        description: '嘉義市重要水源之一',
        full_capacity: 48
    },
    '仁義潭水庫': {
        name: '仁義潭水庫',
        effective_capacity: 280,
        effective_water_storage: 196,
        percentage: 70.00,
        county: '嘉義縣',
        region: 'south',
        update_time: '2025-01-27 14:30',
        station_no: '30301',
        description: '嘉義地區主要水源',
        full_capacity: 290
    },
    '霧社水庫': {
        name: '霧社水庫',
        effective_capacity: 1290,
        effective_water_storage: 1032,
        percentage: 80.00,
        county: '南投縣',
        region: 'central',
        update_time: '2025-01-27 14:30',
        station_no: '10601',
        description: '南投地區重要水源，兼具發電功能',
        full_capacity: 1330
    },
    '新山水庫': {
        name: '新山水庫',
        effective_capacity: 103.5,
        effective_water_storage: 82.8,
        percentage: 80.00,
        county: '基隆市',
        region: 'north',
        update_time: '2025-01-27 14:30',
        station_no: '10203',
        description: '基隆地區主要水源',
        full_capacity: 107
    },
    '明德水庫': {
        name: '明德水庫',
        effective_capacity: 168.7,
        effective_water_storage: 135,
        percentage: 80.00,
        county: '苗栗縣',
        region: 'central',
        update_time: '2025-01-27 14:30',
        station_no: '10405',
        description: '苗栗地區重要水源之一',
        full_capacity: 175
    },
    '寶山水庫': {
        name: '寶山水庫',
        effective_capacity: 300,
        effective_water_storage: 240,
        percentage: 80.00,
        county: '新竹縣',
        region: 'north',
        update_time: '2025-01-27 14:30',
        station_no: '10211',
        description: '新竹地區水源之一',
        full_capacity: 310
    },
    '永和山水庫': {
        name: '永和山水庫',
        effective_capacity: 340,
        effective_water_storage: 272,
        percentage: 80.00,
        county: '苗栗縣',
        region: 'central',
        update_time: '2025-01-27 14:30',
        station_no: '10401',
        description: '苗栗地區主要水源',
        full_capacity: 350
    },
    '烏山頭水庫': {
        name: '烏山頭水庫',
        effective_capacity: 1400,
        effective_water_storage: 980,
        percentage: 70.00,
        county: '台南市',
        region: 'south',
        update_time: '2025-01-27 14:30',
        station_no: '30503',
        description: '台南地區重要水源，又稱珊瑚潭',
        full_capacity: 1450
    }
};

// 地區對照表
const REGION_MAP = {
    'north': {
        name: '北部',
        counties: ['基隆市', '台北市', '新北市', '桃園市', '新竹市', '新竹縣']
    },
    'central': {
        name: '中部',
        counties: ['苗栗縣', '台中市', '南投縣', '彰化縣', '雲林縣']
    },
    'south': {
        name: '南部',
        counties: ['嘉義市', '嘉義縣', '台南市', '高雄市', '屏東縣']
    },
    'east': {
        name: '東部',
        counties: ['宜蘭縣', '花蓮縣', '台東縣']
    }
};

// 水位狀態分類
const WATER_LEVEL_STATUS = {
    critical: { min: 0, max: 30, label: '嚴重缺水', color: '#dc2626', bgColor: '#fef2f2' },
    low: { min: 30, max: 50, label: '蓄水偏低', color: '#d97706', bgColor: '#fffbeb' },
    normal: { min: 50, max: 80, label: '水位正常', color: '#059669', bgColor: '#f0fdf4' },
    sufficient: { min: 80, max: 100, label: '水位充足', color: '#0284c7', bgColor: '#f0f9ff' }
};

// 取得水位狀態
function getWaterLevelStatus(percentage) {
    for (const [key, status] of Object.entries(WATER_LEVEL_STATUS)) {
        if (percentage >= status.min && percentage < status.max) {
            return { key, ...status };
        }
    }
    // 如果是 100%，歸類為充足
    return { key: 'sufficient', ...WATER_LEVEL_STATUS.sufficient };
}

// 模擬API延遲
function simulateApiDelay(ms = 1000) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// 取得模擬資料的函數
async function getMockReservoirData() {
    await simulateApiDelay(800); // 模擬網路延遲
    
    // 隨機調整部分水庫的蓄水率（模擬即時變化）
    const data = JSON.parse(JSON.stringify(MOCK_RESERVOIR_DATA)); // 深拷貝
    
    Object.keys(data).forEach(name => {
        // 隨機調整 ±2% 的蓄水率
        const variation = (Math.random() - 0.5) * 4; // -2 到 +2
        let newPercentage = data[name].percentage + variation;
        
        // 確保在合理範圍內
        newPercentage = Math.max(0, Math.min(100, newPercentage));
        
        // 更新相關數值
        data[name].percentage = Math.round(newPercentage * 100) / 100; // 保留兩位小數
        data[name].effective_water_storage = Math.round(
            (data[name].effective_capacity * newPercentage / 100) * 100
        ) / 100;
        
        // 更新時間
        data[name].update_time = new Date().toLocaleString('zh-TW', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    });
    
    return data;
}

// 匯出供其他模組使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        MOCK_RESERVOIR_DATA,
        REGION_MAP,
        WATER_LEVEL_STATUS,
        getWaterLevelStatus,
        getMockReservoirData
    };
}