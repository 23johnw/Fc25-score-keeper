// src/history-viewer.js
import { LocalStorageManager } from './persistence.js';
import { StatisticsTracker } from './statistics-tracker.js';

const storage = new LocalStorageManager();
const statisticsTracker = new StatisticsTracker(storage);

export const historyViewer = {
    currentByDateFilter: { from: null, to: null, selectedDate: null },
    playedDates: [],

    initializeByDatePanel() {
        const closeBtn = document.getElementById('closeByDatePanel');
        const applyBtn = document.getElementById('applyByDateBtn');
        const clearBtn = document.getElementById('clearByDateBtn');
        const listContainer = document.getElementById('byDateList');
        const fromInput = document.getElementById('byDateFrom');
        const toInput = document.getElementById('byDateTo');

        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.toggleByDatePanel(false));
        }
        if (applyBtn) {
            applyBtn.addEventListener('click', () => this.applyByDateFilter());
        }
        if (clearBtn) {
            clearBtn.addEventListener('click', () => this.clearByDateFilter());
        }

        if (listContainer) {
            this.renderByDateList(listContainer);
        }

        if (fromInput) {
            fromInput.addEventListener('change', (e) => {
                this.currentByDateFilter.from = e.target.value || null;
            });
        }
        if (toInput) {
            toInput.addEventListener('change', (e) => {
                this.currentByDateFilter.to = e.target.value || null;
            });
        }
    },

    toggleByDatePanel(show = false) {
        const panel = document.getElementById('byDatePanel');
        if (!panel) return;
        panel.style.display = show ? 'flex' : 'none';
        if (show) {
            const listContainer = document.getElementById('byDateList');
            if (listContainer) {
                this.updatePlayedDates();
                this.renderByDateList(listContainer);
            }
        }
    },

    updatePlayedDates() {
        const allMatches = statisticsTracker.getAllMatches(); // Use the imported statisticsTracker
        const dateSet = new Set();
        allMatches.forEach(match => {
            if (match.timestamp) {
                const dateKey = new Date(match.timestamp).toISOString().split('T')[0];
                dateSet.add(dateKey);
            }
        });
        this.playedDates = Array.from(dateSet).sort((a, b) => new Date(b) - new Date(a));
    },

    renderByDateList(container) {
        const dates = this.playedDates || [];
        if (dates.length === 0) {
            container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📅</div><h4>No Dates</h4><p>Play some matches to enable date filtering.</p></div>';
            return;
        }
        container.innerHTML = dates.map(dateStr => {
            const isSelected = this.currentByDateFilter.selectedDate === dateStr;
            return `
                <button class="by-date-pill ${isSelected ? 'selected' : ''}" data-date="${dateStr}">
                    ${dateStr}
                </button>
            `;
        }).join('');

        container.querySelectorAll('.by-date-pill').forEach(btn => {
            btn.addEventListener('click', () => {
                const chosen = btn.dataset.date;
                this.currentByDateFilter.selectedDate = chosen;
                this.currentByDateFilter.from = null;
                this.currentByDateFilter.to = null;
                const fromInput = document.getElementById('byDateFrom');
                const toInput = document.getElementById('byDateTo');
                if (fromInput) fromInput.value = '';
                if (toInput) toInput.value = '';
                this.renderByDateList(container);
            });
        });
    },

    clearByDateFilter() {
        this.currentByDateFilter = { from: null, to: null, selectedDate: null };
        const fromInput = document.getElementById('byDateFrom');
        const toInput = document.getElementById('byDateTo');
        if (fromInput) fromInput.value = '';
        if (toInput) toInput.value = '';
        const listContainer = document.getElementById('byDateList');
        if (listContainer) this.renderByDateList(listContainer);
        this.applyByDateFilter();
    },

    applyByDateFilter() {
        const { selectedDate, from, to } = this.currentByDateFilter || {};
        let rangeFrom = null;
        let rangeTo = null;

        if (selectedDate) {
            rangeFrom = selectedDate;
            rangeTo = selectedDate;
        } else {
            rangeFrom = from || null;
            rangeTo = to || null;
        }

        this.currentByDateFilter = { selectedDate: null, from: rangeFrom, to: rangeTo };
        // The refreshCurrentStatsWithDateFilter method will be handled by AppController
        // or the statistics-display module, as it triggers a stats re-render.
        console.log('Applied date filter:', this.currentByDateFilter);
    }
};