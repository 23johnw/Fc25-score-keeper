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

async function fetchWithCorsFallback(url, headers) {
    const proxyUrl = CORS_PROXY + encodeURIComponent(url);
    try {
        const res = await fetch(url, { headers });
        if (res.ok || res.status === 401 || res.status === 403) return res;
        throw new Error(`HTTP ${res.status}`);
    } catch (err) {
        const isCorsOrNetwork = !err.message || err.message.includes('Failed to fetch') ||
            err.message.includes('NetworkError') || err.name === 'TypeError' ||
            err.message.includes('Load failed');
        if (isCorsOrNetwork) {
            return fetch(proxyUrl, { headers });
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
