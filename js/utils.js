// 工具函數集合

// 格式化數字，添加千位分隔符
function formatNumber(num) {
    if (typeof num !== 'number') return '0';
    return num.toLocaleString('zh-TW', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 1
    });
}

// 格式化百分比
function formatPercentage(num) {
    if (typeof num !== 'number') return '0%';
    return `${num.toFixed(1)}%`;
}

// 水利署未附時區的時間按台北時間解讀；含時區時保留其實際時刻。
// 不交給瀏覽器猜測日期格式，避免使用者所在時區改變觀測時間。
function parseSourceTime(value) {
    if (typeof value !== 'string') return null;
    const compact = value.trim().replace(
        /^(\d{4})(\d{2})(\d{2})[Tt](\d{2})(\d{2})(\d{2})$/,
        '$1-$2-$3T$4:$5:$6'
    );
    const match = compact.match(/^(\d{4})-(\d{2})-(\d{2})[Tt ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z|[+-]\d{2}:\d{2})?$/i);
    if (!match) return null;
    const [year, month, day, hour, minute, second] = match.slice(1, 7).map(value => Number(value || 0));
    const calendar = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
    if (calendar.getUTCFullYear() !== year || calendar.getUTCMonth() !== month - 1
        || calendar.getUTCDate() !== day || calendar.getUTCHours() !== hour
        || calendar.getUTCMinutes() !== minute || calendar.getUTCSeconds() !== second) return null;
    const milliseconds = Number((match[7] || '').padEnd(3, '0'));
    const zone = match[8];
    let offset = 8 * 60;
    if (zone && zone.toUpperCase() === 'Z') offset = 0;
    else if (zone) {
        const [zoneHour, zoneMinute] = zone.slice(1).split(':').map(Number);
        if (zoneHour > 14 || zoneMinute > 59 || (zoneHour === 14 && zoneMinute !== 0)) return null;
        offset = (zoneHour * 60 + zoneMinute) * (zone[0] === '-' ? -1 : 1);
    }
    return calendar.getTime() + milliseconds - offset * 60 * 1000;
}

function formatTaipeiTime(timestamp) {
    if (typeof timestamp !== 'number' || !Number.isFinite(timestamp)) return '時間未知';
    return new Intl.DateTimeFormat('zh-TW', {
        timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    }).format(new Date(timestamp)) + '（台北 UTC+8）';
}

function getStorageSummary(reservoirs) {
    const valid = reservoirs.filter(r => Number.isFinite(r.effective_capacity) && r.effective_capacity > 0
        && Number.isFinite(r.effective_water_storage) && r.effective_water_storage >= 0);
    const totalCapacity = valid.reduce((sum, r) => sum + r.effective_capacity, 0);
    const totalStorage = valid.reduce((sum, r) => sum + r.effective_water_storage, 0);
    return {
        totalCapacity, totalStorage,
        weightedPercentage: totalCapacity > 0 ? totalStorage / totalCapacity * 100 : null
    };
}

function getObservationStatus(timestamp, now = Date.now()) {
    if (!Number.isFinite(timestamp)) return '觀測時間未知';
    if (timestamp - now > 60 * 60 * 1000) return '觀測時間異常';
    if (now - timestamp > 48 * 60 * 60 * 1000) return '觀測已過期';
    if (now - timestamp > 6 * 60 * 60 * 1000) return '觀測距今已逾 6 小時';
    return '6 小時內觀測';
}

// 取得水位顏色
function getWaterLevelColor(percentage) {
    if (percentage >= 80) return '#059669'; // 綠色 - 充足
    if (percentage >= 50) return '#0284c7'; // 藍色 - 正常
    if (percentage >= 30) return '#d97706'; // 橙色 - 偏低
    return '#dc2626'; // 紅色 - 缺水
}

// 取得水位狀態文字
function getWaterLevelText(percentage) {
    if (percentage >= 80) return '蓄水率 ≥80%';
    if (percentage >= 50) return '蓄水率 50–80%';
    if (percentage >= 30) return '蓄水率 30–50%';
    return '蓄水率 <30%';
}

// 取得水位圖標
function getWaterLevelIcon(percentage) {
    if (percentage >= 80) return 'bi-droplet-fill';
    if (percentage >= 50) return 'bi-droplet-half';
    if (percentage >= 30) return 'bi-droplet';
    return 'bi-exclamation-triangle-fill';
}

// 防抖函數
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// 節流函數
function throttle(func, limit) {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    }
}

// 動畫函數 - 淡入效果
function fadeIn(element, duration = 300) {
    element.style.opacity = 0;
    element.style.display = 'block';
    
    const start = performance.now();
    
    function animate(currentTime) {
        const elapsedTime = currentTime - start;
        const progress = Math.min(elapsedTime / duration, 1);
        
        element.style.opacity = progress;
        
        if (progress < 1) {
            requestAnimationFrame(animate);
        }
    }
    
    requestAnimationFrame(animate);
}

// 動畫函數 - 淡出效果
function fadeOut(element, duration = 300) {
    const start = performance.now();
    const startOpacity = parseFloat(getComputedStyle(element).opacity);
    
    function animate(currentTime) {
        const elapsedTime = currentTime - start;
        const progress = Math.min(elapsedTime / duration, 1);
        
        element.style.opacity = startOpacity * (1 - progress);
        
        if (progress === 1) {
            element.style.display = 'none';
        } else {
            requestAnimationFrame(animate);
        }
    }
    
    requestAnimationFrame(animate);
}

// 滑動到指定元素
function scrollToElement(element, duration = 800) {
    const targetPosition = element.offsetTop - 80; // 預留一些空間
    const startPosition = window.pageYOffset;
    const distance = targetPosition - startPosition;
    const startTime = performance.now();
    
    function animation(currentTime) {
        const timeElapsed = currentTime - startTime;
        const progress = Math.min(timeElapsed / duration, 1);
        
        // 使用緩動函數
        const easeInOutQuad = progress => 
            progress < 0.5 ? 2 * progress * progress : 1 - 2 * (1 - progress) * (1 - progress);
        
        window.scrollTo(0, startPosition + distance * easeInOutQuad(progress));
        
        if (progress < 1) {
            requestAnimationFrame(animation);
        }
    }
    
    requestAnimationFrame(animation);
}

// 創建圓形進度條SVG
function createCircularProgress(percentage, size = 120) {
    const radius = (size - 16) / 2;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (percentage / 100) * circumference;
    const color = getWaterLevelColor(percentage);
    
    return `
        <svg class="progress-ring" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
            <circle
                class="progress-ring-bg"
                cx="${size / 2}"
                cy="${size / 2}"
                r="${radius}"
            />
            <circle
                class="progress-ring-fill"
                cx="${size / 2}"
                cy="${size / 2}"
                r="${radius}"
                stroke="${color}"
                stroke-dasharray="${circumference}"
                stroke-dashoffset="${strokeDashoffset}"
            />
        </svg>
    `;
}

// 檢查元素是否在視窗中
function isElementInViewport(element) {
    const rect = element.getBoundingClientRect();
    return (
        rect.top >= 0 &&
        rect.left >= 0 &&
        rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
        rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    );
}

// 觀察元素進入視窗的交集觀察器
function createIntersectionObserver(callback, options = {}) {
    const defaultOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.1
    };
    
    const mergedOptions = { ...defaultOptions, ...options };
    
    if ('IntersectionObserver' in window) {
        return new IntersectionObserver(callback, mergedOptions);
    }
    
    // 降級處理（舊瀏覽器）
    return {
        observe: (element) => {
            // 簡單的降級處理
            setTimeout(() => callback([{ target: element, isIntersecting: true }]), 100);
        },
        unobserve: () => {},
        disconnect: () => {}
    };
}

// 本地存儲工具
const LocalStorage = {
    set(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (e) {
            console.warn('無法寫入本地存儲:', e);
            return false;
        }
    },
    
    get(key, defaultValue = null) {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : defaultValue;
        } catch (e) {
            console.warn('無法讀取本地存儲:', e);
            return defaultValue;
        }
    },
    
    remove(key) {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (e) {
            console.warn('無法刪除本地存儲:', e);
            return false;
        }
    },
    
    clear() {
        try {
            localStorage.clear();
            return true;
        } catch (e) {
            console.warn('無法清空本地存儲:', e);
            return false;
        }
    }
};

// 事件發射器
class EventEmitter {
    constructor() {
        this.events = {};
    }
    
    on(event, callback) {
        if (!this.events[event]) {
            this.events[event] = [];
        }
        this.events[event].push(callback);
        
        // 返回取消訂閱函數
        return () => {
            this.off(event, callback);
        };
    }
    
    off(event, callback) {
        if (!this.events[event]) return;
        
        const index = this.events[event].indexOf(callback);
        if (index > -1) {
            this.events[event].splice(index, 1);
        }
    }
    
    emit(event, ...args) {
        if (!this.events[event]) return;
        
        this.events[event].forEach(callback => {
            try {
                callback(...args);
            } catch (e) {
                console.error(`事件處理器錯誤 (${event}):`, e);
            }
        });
    }
    
    once(event, callback) {
        const onceCallback = (...args) => {
            this.off(event, onceCallback);
            callback(...args);
        };
        this.on(event, onceCallback);
    }
}

// 錯誤處理工具
function handleError(error, context = '') {
    console.error(`錯誤 ${context}:`, error);
    
    // 可以在這裡添加錯誤報告邏輯
    // 例如發送到錯誤追蹤服務
    
    return {
        message: error.message || '未知錯誤',
        context,
        timestamp: new Date().toISOString()
    };
}

// 創建載入指示器
function createLoadingSpinner(size = 'medium') {
    const sizeMap = {
        small: '20px',
        medium: '40px',
        large: '60px'
    };
    
    const spinnerSize = sizeMap[size] || sizeMap.medium;
    
    const spinner = document.createElement('div');
    spinner.innerHTML = `
        <div style="
            width: ${spinnerSize};
            height: ${spinnerSize};
            border: 3px solid #f3f3f3;
            border-top: 3px solid #2563eb;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin: 0 auto;
        "></div>
    `;
    
    // 添加旋轉動畫
    if (!document.querySelector('#spinner-animation-style')) {
        const style = document.createElement('style');
        style.id = 'spinner-animation-style';
        style.textContent = `
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        `;
        document.head.appendChild(style);
    }
    
    return spinner;
}

// 顯示通知
function showNotification(message, type = 'info', duration = 3000) {
    // 創建通知容器（如果不存在）
    let container = document.querySelector('#notification-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'notification-container';
        container.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 10000;
            pointer-events: none;
        `;
        document.body.appendChild(container);
    }
    
    // 創建通知元素
    const notification = document.createElement('div');
    const colors = {
        info: { bg: '#3b82f6', text: '#ffffff' },
        success: { bg: '#10b981', text: '#ffffff' },
        warning: { bg: '#f59e0b', text: '#ffffff' },
        error: { bg: '#ef4444', text: '#ffffff' }
    };
    
    const color = colors[type] || colors.info;
    
    notification.style.cssText = `
        background: ${color.bg};
        color: ${color.text};
        padding: 12px 16px;
        border-radius: 8px;
        margin-bottom: 8px;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        transform: translateX(100%);
        transition: transform 0.3s ease-in-out;
        pointer-events: auto;
        cursor: pointer;
        max-width: 300px;
        word-wrap: break-word;
    `;
    
    notification.textContent = message;
    
    // 點擊關閉
    notification.addEventListener('click', () => {
        removeNotification(notification);
    });
    
    container.appendChild(notification);
    
    // 滑入動畫
    requestAnimationFrame(() => {
        notification.style.transform = 'translateX(0)';
    });
    
    // 自動關閉
    if (duration > 0) {
        setTimeout(() => {
            removeNotification(notification);
        }, duration);
    }
    
    function removeNotification(element) {
        element.style.transform = 'translateX(100%)';
        setTimeout(() => {
            if (element.parentNode) {
                element.parentNode.removeChild(element);
            }
        }, 300);
    }
    
    return {
        element: notification,
        close: () => removeNotification(notification)
    };
}

// 匯出所有工具函數
window.Utils = {
    formatNumber,
    formatPercentage,
    parseSourceTime,
    formatTaipeiTime,
    getStorageSummary,
    getObservationStatus,
    getWaterLevelColor,
    getWaterLevelText,
    getWaterLevelIcon,
    debounce,
    throttle,
    fadeIn,
    fadeOut,
    scrollToElement,
    createCircularProgress,
    isElementInViewport,
    createIntersectionObserver,
    LocalStorage,
    EventEmitter,
    handleError,
    createLoadingSpinner,
    showNotification
};