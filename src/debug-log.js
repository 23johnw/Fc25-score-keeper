// ============================================================================
// Debug log - captures errors and key events for export (no secrets)
// ============================================================================

const MAX_ENTRIES = 200;
const STORAGE_KEY = 'fc25_debug_log';

let entries = [];

function loadFromStorage() {
    try {
        if (typeof localStorage !== 'undefined') {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) entries = JSON.parse(raw);
        }
    } catch (e) {
        entries = [];
    }
}

function saveToStorage() {
    try {
        if (typeof localStorage !== 'undefined')
            localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    } catch (e) {}
}

/**
 * Append an entry. data must not contain secrets (tokens, keys, PII).
 * @param {string} message - Short label (e.g. "Sync error")
 * @param {Object} [data] - Optional safe key/value (e.g. { status: 401, host: "proxy.cors.sh" })
 */
export function push(message, data = {}) {
    const entry = {
        ts: new Date().toISOString(),
        message: String(message),
        data: typeof data === 'object' && data !== null ? data : {}
    };
    entries.push(entry);
    if (entries.length > MAX_ENTRIES) entries = entries.slice(-MAX_ENTRIES);
    saveToStorage();
}

/**
 * @returns {Array<{ ts: string, message: string, data: Object }>}
 */
export function getEntries() {
    if (entries.length === 0) loadFromStorage();
    return [...entries];
}

/**
 * Plain text for copy/export (one line per entry).
 */
export function getLogText() {
    const list = getEntries();
    if (list.length === 0) return 'No debug entries yet. Try Sync Top Teams or other actions that may fail.';
    return list.map(e => {
        const dataStr = Object.keys(e.data).length ? ' ' + JSON.stringify(e.data) : '';
        return `[${e.ts}] ${e.message}${dataStr}`;
    }).join('\n');
}

/**
 * Clear all entries.
 */
export function clear() {
    entries = [];
    try {
        if (typeof localStorage !== 'undefined') localStorage.removeItem(STORAGE_KEY);
    } catch (e) {}
}

loadFromStorage();
