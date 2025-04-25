/**
 * Utility functions for the MCQ Generator extension
 */

const DEBUG = true;

/**
 * Logger function that only logs when DEBUG is true
 * @param {string} context - The context/component where the log is coming from
 * @param {string} message - The message to log
 * @param {any} data - Optional data to log
 */
function debugLog(context, message, data = null) {
    if (!DEBUG) return;
    
    const timestamp = new Date().toISOString().substring(11, 23); // HH:MM:SS.sss
    
    if (data) {
        console.log(`[${timestamp}] [${context}] ${message}`, data);
    } else {
        console.log(`[${timestamp}] [${context}] ${message}`);
    }
}

/**
 * Checks if the current browser context is Chrome
 * @returns {boolean} True if the browser is Chrome
 */
function isChrome() {
    return !!window.chrome && (!!window.chrome.webstore || !!window.chrome.runtime);
}

/**
 * Truncates text to specified length
 * @param {string} text - The text to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} Truncated text
 */
function truncateText(text, maxLength = 100) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}

// Export utilities
window.MCQUtils = {
    debugLog,
    isChrome,
    truncateText
}; 