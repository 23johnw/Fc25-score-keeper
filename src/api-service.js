// ============================================================================
// API Service - Football Data.org integration
// ============================================================================

import { push as debugPush } from './debug-log.js';

const API_BASE = 'https://api.football-data.org/v4';
const CORS_PROXY = 'https://corsproxy.io/?';
const CORS_SH_PROXY = 'https://proxy.cors.sh/';
const LEAGUE_CODES = ['PL', 'PD', 'BL1', 'FL1'];
const LEAGUE_NAMES = {
    PL: 'Premier League',
    PD: 'La Liga',
    BL1: 'Bundesliga',
    FL1: 'Ligue 1'
};
const TOP_TEAMS_COUNT = 5;

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

async function fetchWithCorsFallback(url, headers) {
    const proxyUrl = CORS_PROXY + encodeURIComponent(url);
    const useProxyFirst = shouldUseProxyFirst();
    const corsShKey = (getCorsProxyKey() || '').trim();

    // proxy.cors.sh forwards headers to the target (needed for X-Auth-Token on mobile)
    async function doFetchCorsSh() {
        return fetch(CORS_SH_PROXY + url, {
            headers: {
                'x-cors-api-key': corsShKey,
                'X-Auth-Token': headers['X-Auth-Token'] || ''
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

/**
 * Fetches top 5 teams from each of 4 leagues (PL, PD, BL1, FL1).
 * Uses CORS proxy fallback when direct request is blocked.
 * @returns {Promise<Array<{ league: string, name: string }>>} Team entries with league and name
 * @throws {Error} If no API key exists
 */
export async function fetchTopTeams() {
    const apiKey = localStorage.getItem('FOOTBALL_API_KEY');
    if (!apiKey || !apiKey.trim()) {
        debugPush('Sync: No Football Data API key', {});
        throw new Error('No API key found');
    }

    const headers = { 'X-Auth-Token': apiKey.trim() };
    const allEntries = [];

    for (const code of LEAGUE_CODES) {
        const url = `${API_BASE}/competitions/${code}/standings`;
        const res = await fetchWithCorsFallback(url, headers);

        if (!res.ok) {
            const errText = await res.text();
            debugPush('Sync: API error', { leagueCode: code, status: res.status, responseHost: urlHost(res.url), bodyPreview: (errText || '').slice(0, 80) });
            throw new Error(`API error (${code}): ${res.status} ${errText || res.statusText}`);
        }

        const data = await res.json();
        const leagueName = LEAGUE_NAMES[code] || code;
        const table = data.standings?.[0]?.table ?? data.table ?? [];

        const topTeams = table.slice(0, TOP_TEAMS_COUNT);
        for (const row of topTeams) {
            const team = row.team ?? row;
            const name = team.name ?? team.shortName ?? String(team);
            if (name) {
                allEntries.push({ league: leagueName, name });
            }
        }
    }

    return allEntries;
}
