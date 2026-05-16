/**
 * @module Logger
 * @description Centralized telemetry and logging system for QBank PWA.
 * Provides formatted console output with timestamps and module context.
 */

export const Logger = {
    _formatTimestamp() {
        return new Date().toISOString().split('T')[1].split('Z')[0]; // HH:mm:ss.sss
    },

    /**
     * Prints an informational message.
     * @param {string} module - Name of the originating module.
     * @param {string} message - Information to log.
     */
    info(module, message) {
        console.log(
            `%c[ℹ️ INFO] [%c${this._formatTimestamp()}%c] [%c${module}%c]: ${message}`,
            "color: #4361ee; font-weight: bold;",
            "color: #888;",
            "color: #4361ee; font-weight: bold;",
            "color: #3f37c9; font-weight: bold;",
            "color: inherit;"
        );
    },

    /**
     * Prints a warning message with an optional data payload.
     * @param {string} module - Name of the originating module.
     * @param {string} message - Warning message.
     * @param {any} [data] - Optional payload for debugging.
     */
    warn(module, message, data = null) {
        console.warn(
            `%c[⚠️ WARN] [%c${this._formatTimestamp()}%c] [%c${module}%c]: ${message}`,
            "color: #f4a261; font-weight: bold;",
            "color: #888;",
            "color: #f4a261; font-weight: bold;",
            "color: #e76f51; font-weight: bold;",
            "color: inherit;",
            data || ""
        );
    },

    /**
     * Prints a critical error message with a stack trace.
     * @param {string} module - Name of the originating module.
     * @param {string} message - Error description.
     * @param {Error|any} [err] - The error object or exception.
     */
    error(module, message, err = null) {
        console.error(
            `%c[🚨 CRITICAL] [%c${this._formatTimestamp()}%c] [%c${module}%c]: ${message}`,
            "color: #e63946; font-weight: bold;",
            "color: #888;",
            "color: #e63946; font-weight: bold;",
            "color: #b91c1c; font-weight: bold;",
            "color: inherit;",
            err || ""
        );
    }
};
