// ============================================================================
// API Service - Football Data.org integration
// ============================================================================

import { push as debugPush } from './debug-log.js';

const API_BASE = 'https://api.football-data.org/v4';
const CORS_PROXY = 'https://corsproxy.io/?';
const CORS_SH_PROXY = 'https://proxy.cors.sh/';

/** Supported leagues for sync (code + display name). Free-tier only: football-data.org standings API. */
export const SUPPORTED_LEAGUES = [
    { code: 'CL', name: 'UEFA Champions League' },
    { code: 'BL1', name: 'Bundesliga' },
    { code: 'DED', name: 'Eredivisie' },
    { code: 'BSA', name: 'Campeonato Brasileiro Série A' },
    { code: 'PD', name: 'Primera Division' },
    { code: 'FL1', name: 'Ligue 1' },
    { code: 'ELC', name: 'Championship' },
    { code: 'PPL', name: 'Primeira Liga' },
    { code: 'EC', name: 'European Championship' },
    { code: 'SA', name: 'Serie A' },
    { code: 'PL', name: 'Premier League' }
];

const LEAGUE_CODES_DEFAULT = ['PL', 'PD', 'BL1', 'FL1'];
const LEAGUE_NAMES = Object.fromEntries(SUPPORTED_LEAGUES.map(l => [l.code, l.name]));
const DEFAULT_TEAMS_PER_LEAGUE = 5;

/** Presets: Top 4 (current), Top 6 Europe, World mix, International */
export const LEAGUE_PRESETS = {
    top4: ['PL', 'PD', 'BL1', 'FL1'],
    top6Europe: ['PL', 'PD', 'BL1', 'FL1', 'SA', 'DED'],
    worldMix: ['PL', 'PD', 'BL1', 'FL1', 'BSA'],
    international: ['CL', 'EC']
};

/** True when app is on phone or non-localhost (e.g. 192.168.x.x:3000); use proxy first to avoid API blocking. */
function shouldUseProxyFirst() {
    if (typeof location === 'undefined' || !location.origin) return false;
    const origin = location.origin;
    const hostname = location.hostname || '';
    // localhost or 127.0.0.1 on port 80 is often allowed by the API
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
        const port = (location.port || '80').toString();
        return port !== '80'; // e.g. 3000 -> use proxy first
    }
    // LAN IP (phone loading from PC) or other non-public origin
    return true;
}

function getCorsProxyKey() {
    try {
        return (typeof localStorage !== 'undefined' && localStorage.getItem('CORS_PROXY_API_KEY')) || '';
    } catch (e) {
        return '';
    }
}

function urlHost(urlStr) {
    try {
        return new URL(urlStr).host || '';
    } catch {
        return '';
    }
}

/** Ensure header value is ISO-8859-1 only; fetch() throws if value has non-Latin-1 (e.g. pasted smart quotes). */
function headerSafe(str) {
    if (typeof str !== 'string') return '';
    return Array.from(str).filter(c => c.codePointAt(0) <= 0xFF).join('');
}

async function fetchWithCorsFallback(url, headers) {
    const proxyUrl = CORS_PROXY + encodeURIComponent(url);
    const useProxyFirst = shouldUseProxyFirst();
    const corsShKey = headerSafe((getCorsProxyKey() || '').trim());

    // proxy.cors.sh forwards headers to the target (needed for X-Auth-Token on mobile)
    async function doFetchCorsSh() {
        return fetch(CORS_SH_PROXY + url, {
            headers: {
                'x-cors-api-key': corsShKey,
                'X-Auth-Token': headerSafe(headers['X-Auth-Token'] || '')
            }
        });
    }

    async function doFetch(useProxy) {
        const target = useProxy ? proxyUrl : url;
        return fetch(target, { headers });
    }

    if (useProxyFirst && corsShKey) {
        try {
            const res = await doFetchCorsSh();
            if (res.ok || res.status === 401 || res.status === 403) return res;
            debugPush('Sync: proxy.cors.sh returned error', { status: res.status, urlHost: urlHost(res.url) });
            throw new Error(`HTTP ${res.status}`);
        } catch (err) {
            const isCorsOrNetwork = !err.message || err.message.includes('Failed to fetch') ||
                err.message.includes('NetworkError') || err.name === 'TypeError' ||
                err.message.includes('Load failed');
            if (isCorsOrNetwork) {
                debugPush('Sync: proxy.cors.sh request failed, trying fallback', { error: err.message });
                return doFetch(true);
            }
            throw err;
        }
    }

    if (useProxyFirst) {
        // On phone/deployed: try corsproxy.io first; it often fails. Without a cors.sh key we throw a clear error.
        try {
            const res = await doFetch(true);
            if (res.ok || res.status === 401 || res.status === 403) return res;
            throw new Error(`HTTP ${res.status}`);
        } catch (err) {
            const isCorsOrNetwork = !err.message || err.message.includes('Failed to fetch') ||
                err.message.includes('NetworkError') || err.name === 'TypeError' ||
                err.message.includes('Load failed');
            if (isCorsOrNetwork) {
                try {
                    const res = await doFetch(false);
                    if (res.ok || res.status === 401 || res.status === 403) return res;
                    throw new Error(`HTTP ${res.status}`);
                } catch (err2) {
                    debugPush('Sync: CORS_PROXY_NEEDED (both proxy and direct failed)', { firstError: err.message });
                    throw new Error('CORS_PROXY_NEEDED');
                }
            }
            throw err;
        }
    }

    try {
        const res = await doFetch(false);
        if (res.ok || res.status === 401 || res.status === 403) return res;
        throw new Error(`HTTP ${res.status}`);
    } catch (err) {
        const isCorsOrNetwork = !err.message || err.message.includes('Failed to fetch') ||
            err.message.includes('NetworkError') || err.name === 'TypeError' ||
            err.message.includes('Load failed');
        if (isCorsOrNetwork) {
            return doFetch(true);
        }
        throw err;
    }
}

/** Parse wait seconds from 429 response (body or Retry-After header). Minimum 60s. */
function parse429WaitSeconds(errText, retryAfterHeader) {
    const minWait = 60;
    if (retryAfterHeader) {
        const n = parseInt(retryAfterHeader.trim(), 10);
        if (!isNaN(n) && n > 0) return Math.max(minWait, n);
    }
    if (!errText) return minWait;
    try {
        const m = errText.match(/Wait\s+(\d+)\s+seconds?/i) || (typeof errText === 'string' && errText.includes('"message"') ? errText.match(/(\d+)\s+seconds?/i) : null);
        if (m && m[1]) return Math.max(minWait, parseInt(m[1], 10));
    } catch (e) {}
    return minWait;
}

function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

/**
 * Fetches top N teams from each selected league. 403 leagues skipped; 429 triggers wait + retry (with optional countdown).
 * @param {string[]} [leagueCodes] - League codes to fetch.
 * @param {{ onRateLimitWait?: (secondsRemaining: number, leagueName: string) => void, teamsPerLeague?: number }} [opts] - Optional: countdown callback; teamsPerLeague (default 5).
 * @returns {Promise<{ entries: Array<{ league: string, name: string }>, skipped: Array<{ code: string, name: string }> }>}
 */
export async function fetchTopTeams(leagueCodes, opts = {}) {
    const apiKey = localStorage.getItem('FOOTBALL_API_KEY');
    if (!apiKey || !apiKey.trim()) {
        debugPush('Sync: No Football Data API key', {});
        throw new Error('No API key found');
    }

    const requested = Array.isArray(leagueCodes) && leagueCodes.length > 0 ? leagueCodes : LEAGUE_CODES_DEFAULT;
    const codes = requested.filter(code => LEAGUE_NAMES[code]);
    const teamsPerLeague = Math.max(1, Math.min(20, parseInt(opts.teamsPerLeague, 10) || DEFAULT_TEAMS_PER_LEAGUE));
    const headers = { 'X-Auth-Token': apiKey.trim() };
    const allEntries = [];
    const skipped = [];

    for (const code of codes) {
        const url = `${API_BASE}/competitions/${code}/standings`;
        const res = await fetchWithCorsFallback(url, headers);

        if (!res.ok) {
            const errText = await res.text();
            if (res.status === 403) {
                debugPush('Sync: league skipped (not in API plan)', { leagueCode: code, status: 403 });
                skipped.push({ code, name: LEAGUE_NAMES[code] || code, reason: 'plan' });
                continue;
            }
            if (res.status === 429) {
                const leagueName = LEAGUE_NAMES[code] || code;
                const waitSeconds = parse429WaitSeconds(errText, res.headers.get('Retry-After'));
                debugPush('Sync: rate limited, waiting then retry', { leagueCode: code, waitSeconds });
                const onTick = opts.onRateLimitWait;
                for (let s = waitSeconds; s >= 0; s--) {
                    if (onTick) onTick(s, leagueName);
                    if (s > 0) await sleep(1000);
                }
                const retryRes = await fetchWithCorsFallback(url, headers);
                if (!retryRes.ok) {
                    const retryText = await retryRes.text();
                    if (retryRes.status === 429) {
                        debugPush('Sync: league skipped (rate limit after retry)', { leagueCode: code });
                        skipped.push({ code, name: leagueName, reason: 'rate_limit' });
                        continue;
                    }
                    debugPush('Sync: API error after retry', { leagueCode: code, status: retryRes.status });
                    throw new Error(`API error (${code}): ${retryRes.status} ${retryText || retryRes.statusText}`);
                }
                const data = await retryRes.json();
                const table = data.standings?.[0]?.table ?? data.table ?? [];
                const topTeams = table.slice(0, teamsPerLeague);
                for (const row of topTeams) {
                    const team = row.team ?? row;
                    const name = team.name ?? team.shortName ?? String(team);
                    if (name) allEntries.push({ league: leagueName, name });
                }
                continue;
            }
            debugPush('Sync: API error', { leagueCode: code, status: res.status, responseHost: urlHost(res.url), bodyPreview: (errText || '').slice(0, 80) });
            throw new Error(`API error (${code}): ${res.status} ${errText || res.statusText}`);
        }

        const data = await res.json();
        const leagueName = LEAGUE_NAMES[code] || code;
        const table = data.standings?.[0]?.table ?? data.table ?? [];

        const topTeams = table.slice(0, teamsPerLeague);
        for (const row of topTeams) {
            const team = row.team ?? row;
            const name = team.name ?? team.shortName ?? String(team);
            if (name) {
                allEntries.push({ league: leagueName, name });
            }
        }
    }

    return { entries: allEntries, skipped };
}
