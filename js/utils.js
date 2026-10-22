// 共用工具：事件、儲存，以及可在 Node 測試的純函式
(function (global) {
    const TAIWAN_OFFSET_HOURS = 8;
    const HOUR = 60 * 60 * 1000;

    // 蓄水狀態分級，門檻沿用專案既有定義
    const LEVELS = [
        { key: 'full', label: '充足', min: 80 },
        { key: 'normal', label: '正常', min: 50 },
        { key: 'low', label: '偏低', min: 30 },
        { key: 'critical', label: '嚴重', min: -Infinity }
    ];

    function classify(percentage) {
        return LEVELS.find(level => percentage >= level.min);
    }

    // 四捨五入；若進位會跨過分級門檻（如 29.96 → 30.0 卻標「嚴重」），改為捨去
    function formatPercentage(percentage, digits = 1) {
        const factor = 10 ** digits;
        let value = Math.round(percentage * factor) / factor;
        if (classify(value).key !== classify(percentage).key) {
            value = Math.floor(percentage * factor) / factor;
        }
        return value.toFixed(digits);
    }

    // 水利署時間為台灣當地時間且不帶時區，如 "2026-10-22T15:00:00" 或 "2026-10-22 15:00"
    function parseTaiwanTime(text) {
        if (typeof text !== 'string') return null;
        const match = text.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
        if (!match) return null;
        const [year, month, day, hour, minute] = match.slice(1).map(Number);
        return Date.UTC(year, month - 1, day, hour - TAIWAN_OFFSET_HOURS, minute);
    }

    function taiwanParts(timestamp) {
        const date = new Date(timestamp + TAIWAN_OFFSET_HOURS * HOUR);
        return {
            month: date.getUTCMonth() + 1,
            day: date.getUTCDate(),
            hour: date.getUTCHours(),
            minute: date.getUTCMinutes()
        };
    }

    const pad = value => String(value).padStart(2, '0');

    // 同一天只顯示時刻，否則加上月／日
    function formatObservation(timestamp, now = Date.now()) {
        const target = taiwanParts(timestamp);
        const today = taiwanParts(now);
        const clock = `${pad(target.hour)}:${pad(target.minute)}`;
        if (target.month === today.month && target.day === today.day) return clock;
        return `${target.month}/${target.day} ${clock}`;
    }

    function formatRelative(timestamp, now = Date.now()) {
        const minutes = Math.max(0, Math.round((now - timestamp) / 60000));
        if (minutes < 1) return '剛剛';
        if (minutes < 60) return `${minutes} 分鐘前`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours} 小時前`;
        return `${Math.floor(hours / 24)} 天前`;
    }

    function formatNumber(value, digits = 0) {
        if (!Number.isFinite(value)) return '—';
        return value.toLocaleString('zh-TW', {
            minimumFractionDigits: digits,
            maximumFractionDigits: digits
        });
    }

    // 迷你趨勢線。縱軸至少涵蓋 1 個百分點，避免把雜訊放大成趨勢。
    function sparklinePoints(values, width, height, minimumSpan = 1) {
        if (!Array.isArray(values) || values.length < 2) return '';
        const low = Math.min(...values);
        const high = Math.max(...values);
        const span = Math.max(high - low, minimumSpan);
        const base = (low + high) / 2 - span / 2;
        const step = width / (values.length - 1);
        return values
            .map((value, index) => {
                const x = index * step;
                const y = height - ((value - base) / span) * height;
                return `${x.toFixed(1)},${y.toFixed(1)}`;
            })
            .join(' ');
    }

    function escapeHTML(text) {
        return String(text).replace(/[&<>"']/g, char => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[char]));
    }

    const LocalStorage = {
        set(key, value) {
            try {
                localStorage.setItem(key, JSON.stringify(value));
                return true;
            } catch {
                return false;
            }
        },
        get(key, defaultValue = null) {
            try {
                const item = localStorage.getItem(key);
                return item ? JSON.parse(item) : defaultValue;
            } catch {
                return defaultValue;
            }
        },
        remove(key) {
            try {
                localStorage.removeItem(key);
            } catch {
                // 私密瀏覽或停用儲存時忽略
            }
        }
    };

    class EventEmitter {
        constructor() {
            this.events = {};
        }

        on(event, callback) {
            (this.events[event] = this.events[event] || []).push(callback);
            return () => this.off(event, callback);
        }

        off(event, callback) {
            if (!this.events[event]) return;
            this.events[event] = this.events[event].filter(listener => listener !== callback);
        }

        emit(event, ...args) {
            for (const callback of this.events[event] || []) {
                try {
                    callback(...args);
                } catch (error) {
                    console.error(`事件處理器錯誤 (${event}):`, error);
                }
            }
        }

        removeAllListeners() {
            this.events = {};
        }
    }

    function handleError(error, context = '') {
        console.error(`錯誤 ${context ? `(${context})` : ''}:`, error);
        return {
            message: error.message || '未知錯誤',
            context,
            timestamp: new Date().toISOString()
        };
    }

    global.Utils = {
        HOUR,
        LEVELS,
        classify,
        formatPercentage,
        parseTaiwanTime,
        formatObservation,
        formatRelative,
        formatNumber,
        sparklinePoints,
        escapeHTML,
        LocalStorage,
        EventEmitter,
        handleError
    };
})(typeof window !== 'undefined' ? window : globalThis);
