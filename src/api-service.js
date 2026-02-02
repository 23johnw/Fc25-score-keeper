// ============================================================================
// API Service - Football Data.org integration
// ============================================================================

const API_BASE = 'https://api.football-data.org/v4';
const CORS_PROXY = 'https://corsproxy.io/?';
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

async function fetchWithCorsFallback(url, headers) {
    const proxyUrl = CORS_PROXY + encodeURIComponent(url);
    const useProxyFirst = shouldUseProxyFirst();

    async function doFetch(useProxy) {
        const target = useProxy ? proxyUrl : url;
        return fetch(target, { headers });
    }

    if (useProxyFirst) {
        try {
            const res = await doFetch(true);
            if (res.ok || res.status === 401 || res.status === 403) return res;
            throw new Error(`HTTP ${res.status}`);
        } catch (err) {
            const isCorsOrNetwork = !err.message || err.message.includes('Failed to fetch') ||
                err.message.includes('NetworkError') || err.name === 'TypeError' ||
                err.message.includes('Load failed');
            if (isCorsOrNetwork) {
                return doFetch(false);
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
        throw new Error('No API key found');
    }

    const headers = { 'X-Auth-Token': apiKey.trim() };
    const allEntries = [];

    for (const code of LEAGUE_CODES) {
        const url = `${API_BASE}/competitions/${code}/standings`;
        const res = await fetchWithCorsFallback(url, headers);

        if (!res.ok) {
            const errText = await res.text();
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
