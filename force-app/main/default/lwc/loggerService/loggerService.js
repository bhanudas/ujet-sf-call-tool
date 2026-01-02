/**
 * LoggerService - Centralized logging utility for LWC components
 * 
 * Features:
 * - Visually distinctive, color-coded console output
 * - Grouped logging for related operations
 * - Performance timing utilities
 * - Configurable log levels
 * - Component context tracking
 * 
 * Usage:
 *   import Logger from 'c/loggerService';
 *   const log = Logger.create('MyComponent');
 *   log.info('Something happened', { details: 'here' });
 */

// =============================================================================
// Configuration
// =============================================================================

const CONFIG = {
    // Set to false in production to disable all logging
    ENABLED: true,
    
    // Minimum log level: 'debug' | 'info' | 'warn' | 'error' | 'none'
    MIN_LEVEL: 'debug',
    
    // Application prefix for all logs
    APP_PREFIX: 'UJET-CallTool',
    
    // Enable performance timing
    ENABLE_TIMING: true,
    
    // Enable grouped logs (collapsible in console)
    ENABLE_GROUPING: true
};

// Log level hierarchy
const LOG_LEVELS = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
    none: 99
};

// =============================================================================
// Styling - Visual formatting for console output
// =============================================================================

const STYLES = {
    // Component badge styles
    badge: {
        debug: 'background: #6366f1; color: white; padding: 2px 6px; border-radius: 3px; font-weight: 600;',
        info: 'background: #0ea5e9; color: white; padding: 2px 6px; border-radius: 3px; font-weight: 600;',
        warn: 'background: #f59e0b; color: white; padding: 2px 6px; border-radius: 3px; font-weight: 600;',
        error: 'background: #ef4444; color: white; padding: 2px 6px; border-radius: 3px; font-weight: 600;',
        success: 'background: #10b981; color: white; padding: 2px 6px; border-radius: 3px; font-weight: 600;'
    },
    
    // Component name styles
    component: 'background: #1e293b; color: #e2e8f0; padding: 2px 6px; border-radius: 3px; font-weight: 500;',
    
    // Timestamp style
    timestamp: 'color: #64748b; font-size: 10px;',
    
    // Message styles
    message: {
        debug: 'color: #a5b4fc;',
        info: 'color: #38bdf8;',
        warn: 'color: #fbbf24;',
        error: 'color: #f87171; font-weight: 600;'
    },
    
    // Data styles
    data: 'color: #94a3b8;',
    
    // Separator
    separator: 'color: #475569;'
};

// Level icons
const ICONS = {
    debug: '🔍',
    info: 'ℹ️',
    warn: '⚠️',
    error: '❌',
    success: '✅',
    start: '▶️',
    end: '⏹️',
    timer: '⏱️'
};

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Unwrap Salesforce Proxy objects for proper console display
 * Salesforce LWC uses Proxy objects for reactivity, which don't display
 * well in the console. This function converts them to plain objects.
 * 
 * @param {any} data - The data to unwrap
 * @returns {any} - Plain JavaScript object/array
 */
function unwrapProxy(data) {
    if (data === null || data === undefined) {
        return data;
    }
    
    // Handle Error objects specially - preserve the stack trace
    if (data instanceof Error) {
        return {
            name: data.name,
            message: data.message,
            stack: data.stack,
            // Include Salesforce-specific error properties
            ...(data.body && { body: unwrapProxy(data.body) })
        };
    }
    
    // Handle Date objects
    if (data instanceof Date) {
        return data;
    }
    
    // Handle arrays
    if (Array.isArray(data)) {
        return data.map(item => unwrapProxy(item));
    }
    
    // Handle objects (including Proxy objects)
    if (typeof data === 'object') {
        try {
            // JSON parse/stringify is the most reliable way to unwrap Proxy
            return JSON.parse(JSON.stringify(data));
        } catch (e) {
            // If JSON conversion fails, try manual property copying
            const result = {};
            for (const key in data) {
                if (Object.prototype.hasOwnProperty.call(data, key)) {
                    try {
                        result[key] = unwrapProxy(data[key]);
                    } catch (innerErr) {
                        result[key] = '[Unable to unwrap]';
                    }
                }
            }
            return result;
        }
    }
    
    // Primitives pass through unchanged
    return data;
}

// =============================================================================
// Logger Class
// =============================================================================

class ComponentLogger {
    constructor(componentName) {
        this.componentName = componentName;
        this.timers = new Map();
    }
    
    /**
     * Check if logging is enabled for the given level
     */
    _shouldLog(level) {
        if (!CONFIG.ENABLED) return false;
        return LOG_LEVELS[level] >= LOG_LEVELS[CONFIG.MIN_LEVEL];
    }
    
    /**
     * Format timestamp
     */
    _getTimestamp() {
        const now = new Date();
        return now.toLocaleTimeString('en-US', { 
            hour12: false, 
            hour: '2-digit', 
            minute: '2-digit', 
            second: '2-digit',
            fractionalSecondDigits: 3
        });
    }
    
    /**
     * Prepare data for logging by unwrapping Salesforce Proxy objects
     */
    _prepareData(data) {
        if (data === null || data === undefined) {
            return data;
        }
        return unwrapProxy(data);
    }
    
    /**
     * Core logging method
     */
    _log(level, message, data = null) {
        if (!this._shouldLog(level)) return;
        
        const timestamp = this._getTimestamp();
        const icon = ICONS[level];
        const consoleFn = level === 'error' ? console.error : 
                         level === 'warn' ? console.warn : 
                         level === 'debug' ? console.debug : console.log;
        
        // Unwrap Proxy objects for proper display
        const unwrappedData = this._prepareData(data);
        
        // Build the styled console output
        const parts = [
            `%c${CONFIG.APP_PREFIX}%c %c${this.componentName}%c ${icon} %c${message}`,
            STYLES.badge[level],
            STYLES.separator,
            STYLES.component,
            STYLES.separator,
            STYLES.message[level]
        ];
        
        if (unwrappedData !== null && unwrappedData !== undefined) {
            consoleFn(...parts, unwrappedData);
        } else {
            consoleFn(...parts);
        }
    }
    
    // -------------------------------------------------------------------------
    // Public Logging Methods
    // -------------------------------------------------------------------------
    
    /**
     * Debug level - for development details
     */
    debug(message, data) {
        this._log('debug', message, data);
    }
    
    /**
     * Info level - general information
     */
    info(message, data) {
        this._log('info', message, data);
    }
    
    /**
     * Warning level - potential issues
     */
    warn(message, data) {
        this._log('warn', message, data);
    }
    
    /**
     * Error level - errors and failures
     */
    error(message, data) {
        this._log('error', message, data);
    }
    
    /**
     * Success - operation completed successfully
     */
    success(message, data) {
        if (!this._shouldLog('info')) return;
        
        const unwrappedData = this._prepareData(data);
        console.log(
            `%c${CONFIG.APP_PREFIX}%c %c${this.componentName}%c ${ICONS.success} %c${message}`,
            STYLES.badge.success,
            STYLES.separator,
            STYLES.component,
            STYLES.separator,
            'color: #34d399;',
            unwrappedData !== undefined ? unwrappedData : ''
        );
    }
    
    // -------------------------------------------------------------------------
    // Grouping Methods
    // -------------------------------------------------------------------------
    
    /**
     * Start a collapsed group
     */
    group(label) {
        if (!CONFIG.ENABLED || !CONFIG.ENABLE_GROUPING) return;
        
        console.groupCollapsed(
            `%c${CONFIG.APP_PREFIX}%c %c${this.componentName}%c ${ICONS.start} ${label}`,
            STYLES.badge.info,
            STYLES.separator,
            STYLES.component,
            STYLES.separator
        );
    }
    
    /**
     * Start an expanded group
     */
    groupOpen(label) {
        if (!CONFIG.ENABLED || !CONFIG.ENABLE_GROUPING) return;
        
        console.group(
            `%c${CONFIG.APP_PREFIX}%c %c${this.componentName}%c ${ICONS.start} ${label}`,
            STYLES.badge.info,
            STYLES.separator,
            STYLES.component,
            STYLES.separator
        );
    }
    
    /**
     * End current group
     */
    groupEnd() {
        if (!CONFIG.ENABLED || !CONFIG.ENABLE_GROUPING) return;
        console.groupEnd();
    }
    
    // -------------------------------------------------------------------------
    // Performance Timing Methods
    // -------------------------------------------------------------------------
    
    /**
     * Start a timer
     */
    time(label) {
        if (!CONFIG.ENABLED || !CONFIG.ENABLE_TIMING) return;
        
        this.timers.set(label, performance.now());
        this.debug(`${ICONS.timer} Timer started: ${label}`);
    }
    
    /**
     * End a timer and log duration
     */
    timeEnd(label) {
        if (!CONFIG.ENABLED || !CONFIG.ENABLE_TIMING) return;
        
        const start = this.timers.get(label);
        if (!start) {
            this.warn(`Timer "${label}" not found`);
            return;
        }
        
        const duration = (performance.now() - start).toFixed(2);
        this.timers.delete(label);
        
        console.log(
            `%c${CONFIG.APP_PREFIX}%c %c${this.componentName}%c ${ICONS.timer} %c${label}%c completed in %c${duration}ms`,
            STYLES.badge.info,
            STYLES.separator,
            STYLES.component,
            STYLES.separator,
            'color: #94a3b8;',
            STYLES.separator,
            duration < 100 ? 'color: #34d399; font-weight: 600;' : 
            duration < 500 ? 'color: #fbbf24; font-weight: 600;' : 
            'color: #f87171; font-weight: 600;'
        );
    }
    
    // -------------------------------------------------------------------------
    // Table Logging
    // -------------------------------------------------------------------------
    
    /**
     * Log data as a table
     */
    table(label, data) {
        if (!this._shouldLog('debug')) return;
        
        const unwrappedData = this._prepareData(data);
        console.log(
            `%c${CONFIG.APP_PREFIX}%c %c${this.componentName}%c 📊 ${label}`,
            STYLES.badge.debug,
            STYLES.separator,
            STYLES.component,
            STYLES.separator
        );
        console.table(unwrappedData);
    }
    
    // -------------------------------------------------------------------------
    // Lifecycle Logging
    // -------------------------------------------------------------------------
    
    /**
     * Log component lifecycle events
     */
    lifecycle(event, details) {
        if (!this._shouldLog('debug')) return;
        
        const lifecycleIcons = {
            'connectedCallback': '🔌',
            'disconnectedCallback': '🔌❌',
            'renderedCallback': '🎨',
            'errorCallback': '💥',
            'wire': '⚡'
        };
        
        const icon = lifecycleIcons[event] || '📌';
        const unwrappedDetails = this._prepareData(details);
        
        console.log(
            `%c${CONFIG.APP_PREFIX}%c %c${this.componentName}%c ${icon} %c${event}`,
            'background: #7c3aed; color: white; padding: 2px 6px; border-radius: 3px; font-weight: 600;',
            STYLES.separator,
            STYLES.component,
            STYLES.separator,
            'color: #c4b5fd;',
            unwrappedDetails !== undefined ? unwrappedDetails : ''
        );
    }
    
    // -------------------------------------------------------------------------
    // API/Apex Call Logging
    // -------------------------------------------------------------------------
    
    /**
     * Log Apex method calls
     */
    apex(methodName, params, result) {
        if (!this._shouldLog('info')) return;
        
        this.group(`⚡ Apex: ${methodName}`);
        
        if (params !== undefined) {
            const unwrappedParams = this._prepareData(params);
            console.log('%cParameters:', 'color: #64748b; font-weight: 600;', unwrappedParams);
        }
        
        if (result !== undefined) {
            const unwrappedResult = this._prepareData(result);
            if (result instanceof Error) {
                console.log('%cError:', 'color: #f87171; font-weight: 600;', unwrappedResult);
            } else {
                console.log('%cResult:', 'color: #34d399; font-weight: 600;', unwrappedResult);
            }
        }
        
        this.groupEnd();
    }
}

// =============================================================================
// Factory Export
// =============================================================================

const Logger = {
    /**
     * Create a new logger instance for a component
     * @param {string} componentName - Name of the component
     * @returns {ComponentLogger} Logger instance
     */
    create(componentName) {
        return new ComponentLogger(componentName);
    },
    
    /**
     * Update logger configuration at runtime
     * @param {Object} newConfig - Configuration overrides
     */
    configure(newConfig) {
        Object.assign(CONFIG, newConfig);
    },
    
    /**
     * Enable all logging
     */
    enable() {
        CONFIG.ENABLED = true;
    },
    
    /**
     * Disable all logging
     */
    disable() {
        CONFIG.ENABLED = false;
    },
    
    /**
     * Set minimum log level
     * @param {'debug'|'info'|'warn'|'error'|'none'} level
     */
    setLevel(level) {
        if (LOG_LEVELS[level] !== undefined) {
            CONFIG.MIN_LEVEL = level;
        }
    }
};

export default Logger;

