// Stats view toggler - Player vs Team view (classic script, uses window.appController)

function getActiveStatsContainer() {
    const statsTabSelect = document.querySelector('#statsTabSelect');
    const activeTab = statsTabSelect ? statsTabSelect.value : 'overall';
    if (activeTab === 'today') return document.querySelector('#todayStatsDisplay');
    if (activeTab === 'season') return document.querySelector('#seasonStatsDisplay');
    if (activeTab === 'overall') return document.querySelector('#overallStatsDisplay');
    if (activeTab === 'custom') return document.querySelector('#customStatsDisplay');
    return document.querySelector('#overallStatsDisplay') || document.querySelector('#seasonStatsDisplay') || document.querySelector('#todayStatsDisplay') || document.querySelector('.stats-display');
}

function getMatchesForActiveTab() {
    const app = window.appController;
    if (!app || !app.statisticsTracker) return [];
    const tabSelect = document.querySelector('#statsTabSelect');
    const activeTab = tabSelect ? tabSelect.value : 'overall';
    if (activeTab === 'today') return app.statisticsTracker.getTodayMatches() || [];
    if (activeTab === 'season') {
        const season = app.seasonManager ? app.seasonManager.getCurrentSeason() : 1;
        return app.statisticsTracker.getSeasonMatches(season) || [];
    }
    if (activeTab === 'custom' && typeof app.getCustomMatches === 'function') return app.getCustomMatches() || [];
    return app.statisticsTracker.getAllMatches() || [];
}

function renderTeamTable() {
    const app = window.appController;
    if (!app || !app.statisticsTracker) return;
    const matches = getMatchesForActiveTab();
    const teamStats = app.statisticsTracker.getTeamStats(matches) || {};
    const statsContainer = getActiveStatsContainer();
    if (!statsContainer) return;

    statsContainer.innerHTML = '';
    statsContainer.style.display = 'block';

    if (Object.keys(teamStats).length === 0) {
        statsContainer.innerHTML = '<div class="empty-state"><p>No team data available. Play some matches first!</p></div>';
        return;
    }

    function formatTeamName(players) {
        if (!Array.isArray(players)) players = [players];
        if (players.length === 1) return players[0];
        if (players.length === 2) {
            const [p1, p2] = players;
            return p1.length <= p2.length ? p1 + ' &<br>' + p2 : p1 + '<br>& ' + p2;
        }
        return players.join(' &<br>');
    }

    const partnershipStats = Object.entries(teamStats).filter(function (entry) {
        const teamData = entry[1];
        const players = Array.isArray(teamData.players) ? teamData.players : [teamData.players];
        return players.length > 1;
    });
    const sortedTeams = partnershipStats.sort(function (a, b) {
        return (b[1].points - a[1].points) || (b[1].gd - a[1].gd) || (b[1].gf - a[1].gf);
    });

    var mode = (app.statisticsTracker.getStatsMode && app.statisticsTracker.getStatsMode()) || 'raw';
    var maxPlayed = 0;
    sortedTeams.forEach(function (entry) {
        var p = entry[1].played || 0;
        if (p > maxPlayed) maxPlayed = p;
    });
    function applyMode(stats) {
        var p = stats.played || 0;
        if (mode === 'raw') {
            return { pts: stats.points, gf: stats.gf, ga: stats.ga, gd: stats.gd };
        }
        if (p === 0) return { pts: 0, gf: 0, ga: 0, gd: 0 };
        if (mode === 'perGame') {
            return {
                pts: Math.round((stats.points / p) * 10) / 10,
                gf: Math.round((stats.gf / p) * 10) / 10,
                ga: Math.round((stats.ga / p) * 10) / 10,
                gd: Math.round((stats.gd / p) * 10) / 10
            };
        }
        if (mode === 'projected' && maxPlayed > 0) {
            var scale = maxPlayed / p;
            return {
                pts: Math.round(stats.points * scale * 10) / 10,
                gf: Math.round(stats.gf * scale * 10) / 10,
                ga: Math.round(stats.ga * scale * 10) / 10,
                gd: Math.round(stats.gd * scale * 10) / 10
            };
        }
        return { pts: stats.points, gf: stats.gf, ga: stats.ga, gd: stats.gd };
    }

    const table = document.createElement('table');
    table.style.cssText = 'width:100%;min-width:600px;border-collapse:collapse;font-size:14px;';
    table.innerHTML = '<thead><tr style="background:#4CAF50;color:white;">' +
        '<th style="padding:12px 8px;text-align:left;min-width:120px;">Team</th>' +
        '<th style="padding:12px 8px;text-align:center;min-width:50px;">Pts</th>' +
        '<th style="padding:12px 6px;text-align:center;min-width:35px;">P</th>' +
        '<th style="padding:12px 6px;text-align:center;min-width:35px;">W</th>' +
        '<th style="padding:12px 6px;text-align:center;min-width:35px;">D</th>' +
        '<th style="padding:12px 6px;text-align:center;min-width:35px;">L</th>' +
        '<th style="padding:12px 6px;text-align:center;min-width:40px;">GF</th>' +
        '<th style="padding:12px 6px;text-align:center;min-width:40px;">GA</th>' +
        '<th style="padding:12px 6px;text-align:center;min-width:45px;">GD</th></tr></thead><tbody>' +
        sortedTeams.map(function (entry, index) {
            const stats = entry[1];
            const players = Array.isArray(stats.players) ? stats.players : [stats.players];
            const d = applyMode(stats);
            var pDisplay = mode === 'projected' ? maxPlayed : (stats.played || 0);
            const bg = index % 2 === 0 ? '#fff' : '#f9f9f9';
            const gdStyle = d.gd > 0 ? 'color:#2e7d32' : d.gd < 0 ? 'color:#c62828' : 'color:#666';
            return '<tr style="border-bottom:1px solid #e0e0e0;background:' + bg + '">' +
                '<td style="font-weight:bold;padding:10px 8px;" title="' + players.join(' & ') + '">' +
                '<span class="team-name-clickable" data-team-players="' + players.join(',') + '" style="cursor:pointer;color:#2196F3;">' + formatTeamName(players) + '</span></td>' +
                '<td style="text-align:center;padding:10px;font-weight:bold;color:#4CAF50;">' + d.pts + '</td>' +
                '<td style="text-align:center;padding:10px;">' + pDisplay + '</td>' +
                '<td style="text-align:center;padding:10px;">' + stats.won + '</td>' +
                '<td style="text-align:center;padding:10px;">' + stats.drawn + '</td>' +
                '<td style="text-align:center;padding:10px;">' + stats.lost + '</td>' +
                '<td style="text-align:center;padding:10px;">' + d.gf + '</td>' +
                '<td style="text-align:center;padding:10px;">' + d.ga + '</td>' +
                '<td style="text-align:center;padding:10px;font-weight:bold;' + gdStyle + '">' + (d.gd > 0 ? '+' : '') + d.gd + '</td></tr>';
        }).join('') + '</tbody>';

    const tabSelect = document.querySelector('#statsTabSelect');
    const activeTab = tabSelect ? tabSelect.value : 'overall';
    const periodLabel = activeTab === 'today' ? ' (Today)' : activeTab === 'season' ? ' (Season)' : activeTab === 'custom' ? ' (Custom)' : ' (Overall)';
    const wrap = document.createElement('div');
    wrap.className = 'stat-card team-stats-card';
    wrap.style.cssText = 'background:#f8f9fa;border:2px solid #4CAF50;border-radius:12px;padding:15px;margin:20px 0;overflow-x:auto;';
    const h3 = document.createElement('h3');
    h3.style.cssText = 'color:#4CAF50;font-size:20px;margin-bottom:15px;text-align:center;';
    h3.textContent = 'TEAM LEAGUE STANDINGS' + periodLabel;
    wrap.appendChild(h3);
    wrap.appendChild(table);
    statsContainer.appendChild(wrap);

    setTimeout(function () {
        wrap.querySelectorAll('.team-name-clickable').forEach(function (el) {
            el.addEventListener('click', function () {
                var teamPlayers = (el.getAttribute('data-team-players') || '').split(',').filter(Boolean);
                if (window.appController && window.appController.showTeamDetails) {
                    window.appController.showTeamDetails(teamPlayers);
                }
            });
        });
    }, 100);
}

function setupToggleUI() {
    if (document.querySelector('#stats-view-toggle')) return;
    var btn = document.createElement('button');
    btn.id = 'stats-view-toggle';
    btn.textContent = 'Team view';
    btn.className = 'btn btn-secondary';
    btn.style.cssText = 'margin-left:0.5rem;';
    btn.title = 'Switch between Player stats and Team (partnership) league table';

    btn.onclick = function () {
        var app = window.appController;
        if (!app || !app.statisticsDisplay) return;
        var container = getActiveStatsContainer();
        if (!container) return;

        if (window.currentStatsView === 'team') {
            window.currentStatsView = 'player';
            btn.textContent = 'Team view';
            var tab = (document.querySelector('#statsTabSelect') || {}).value || 'overall';
            var season = app.seasonManager.getCurrentSeason();
            if (tab === 'today') app.statisticsDisplay.displayTodayStats(container);
            else if (tab === 'season') app.statisticsDisplay.displaySeasonStats(season, container);
            else if (tab === 'overall') app.statisticsDisplay.displayOverallStats(container);
            else if (tab === 'custom') app.statisticsDisplay.displayCustomStats(app.getCustomMatches ? app.getCustomMatches() : [], container);
            else app.statisticsDisplay.displayOverallStats(container);
        } else {
            window.currentStatsView = 'team';
            btn.textContent = 'Player view';
            renderTeamTable();
        }
    };

    function inject() {
        var tabs = document.querySelector('.stats-tabs');
        if (tabs && !document.querySelector('#stats-view-toggle')) {
            tabs.appendChild(btn);
        }
    }
    if (document.querySelector('#statsTabSelect')) {
        inject();
    } else {
        setTimeout(inject, 500);
        setTimeout(inject, 1500);
    }
}

window.renderTeamTable = renderTeamTable;
window.setupToggleUI = setupToggleUI;

export { renderTeamTable, setupToggleUI };
