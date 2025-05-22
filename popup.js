// Overhauled popup.js for simple stats and match history

const killsElement = document.getElementById('kills');
const deathsElement = document.getElementById('deaths');
const matchesElement = document.getElementById('matches');
const matchesList = document.getElementById('matches-list');

// Helper to format date/time
function formatDateTime(ts) {
    if (!ts) return '-';
    const d = new Date(ts);
    return d.toLocaleString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit', year: '2-digit', month: '2-digit', day: '2-digit' });
}

function formatKDR(kills, deaths) {
    if (deaths === 0) return kills > 0 ? kills.toFixed(2) : '0.00';
    return (kills / deaths).toFixed(2);
}

let currentSkid = null;
let currentMode = 'normal'; // 'normal', 'special', or 'custom'

function getModeKey(base, skid) {
    return `${base}_${skid}_${currentMode}`;
}

function updateModeSelector() {
    document.getElementById('normalModeBtn').classList.toggle('selected', currentMode === 'normal');
    document.getElementById('specialModeBtn').classList.toggle('selected', currentMode === 'special');
    document.getElementById('customModeBtn').classList.toggle('selected', currentMode === 'custom');
}

function loadStats() {
    chrome.storage.sync.get(['currentSkid'], (skidData) => {
        currentSkid = skidData.currentSkid || 'Default';
        document.getElementById('skidValue').textContent = currentSkid;
        const keys = [
            getModeKey('matchHistory', currentSkid),
            getModeKey('gamesJoined', currentSkid),
            getModeKey('gamesStarted', currentSkid),
            getModeKey('gamesQuit', currentSkid),
            getModeKey('matchesCompleted', currentSkid)
        ];
        console.log('[SKMT][LOAD] Loading stats for SKID:', currentSkid, 'Mode:', currentMode, 'Keys:', keys);
        chrome.storage.sync.get(keys, (data) => {
            console.log('[SKMT][LOAD] Data returned from chrome.storage.sync:', data);
            const history = data[getModeKey('matchHistory', currentSkid)] || [];
            let totalKills = 0, totalDeaths = 0;
            history.forEach(m => {
                totalKills += m.kills || 0;
                totalDeaths += m.deaths || 0;
            });
            document.getElementById('kills').textContent = totalKills;
            document.getElementById('deaths').textContent = totalDeaths;
            document.getElementById('kdr').textContent = formatKDR(totalKills, totalDeaths);
            document.getElementById('gamesJoined').textContent = data[getModeKey('gamesJoined', currentSkid)] || 0;
            document.getElementById('gamesStarted').textContent = data[getModeKey('gamesStarted', currentSkid)] || 0;
            document.getElementById('gamesQuit').textContent = data[getModeKey('gamesQuit', currentSkid)] || 0;
            document.getElementById('matchesCompleted').textContent = data[getModeKey('matchesCompleted', currentSkid)] || 0;

            // Render match history
            const matchesList = document.getElementById('matches-list');
            matchesList.innerHTML = '';
            history.slice().reverse().forEach((m, idx) => {
                const card = document.createElement('div');
                card.className = 'match-card';

                // Content container for meta, stats, flags
                const content = document.createElement('div');
                content.className = 'match-card-content';

                // Meta info
                const meta = document.createElement('div');
                meta.className = 'match-meta';
                meta.textContent = `#${history.length - idx} | ${formatDateTime(m.matchStartTime)} - ${formatDateTime(m.matchEndTime)}`;
                content.appendChild(meta);

                // Stats
                const stats = document.createElement('div');
                stats.className = 'match-stats';
                stats.innerHTML = `Kills: <b>${m.kills}</b> &nbsp; Deaths: <b>${m.deaths}</b> &nbsp; KDR: <b>${formatKDR(m.kills, m.deaths)}</b>`;
                content.appendChild(stats);

                // Flags
                const flags = document.createElement('div');
                flags.className = 'match-flags';
                let flagText = [];
                if (m.joined) flagText.push('Joined');
                if (m.started) flagText.push('Started');
                if (m.quit) flagText.push('Quit');
                if (m.isSpecialMode) flagText.push('Special Mode');
                if (m.isCustomMode) flagText.push('Custom Match');
                if (flagText.length > 0) flags.textContent = flagText.join(' | ');
                content.appendChild(flags);

                // Trash icon button
                const trashBtn = document.createElement('button');
                trashBtn.className = 'trash-btn';
                trashBtn.title = 'Delete this match';
                trashBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6 8V15M10 8V15M14 8V15M3 5H17M8 5V3H12V5M5 5V17C5 17.5523 5.44772 18 6 18H14C14.5523 18 15 17.5523 15 17V5" stroke="#e74c3c" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
                trashBtn.onclick = () => deleteMatch(history.length - 1 - idx);

                card.appendChild(content);
                card.appendChild(trashBtn);
                matchesList.appendChild(card);
            });
        });
    });
}

function deleteMatch(index) {
    // Remove the match at the given index from the current mode's history
    chrome.storage.sync.get(['currentSkid'], (skidData) => {
        const skid = skidData.currentSkid || 'Default';
        const key = getModeKey('matchHistory', skid);
        chrome.storage.sync.get([key], (data) => {
            let history = data[key] || [];
            if (index < 0 || index >= history.length) return;
            const removed = history.splice(index, 1)[0];
            // Recalculate stats
            let totalKills = 0, totalDeaths = 0, gamesJoined = 0, gamesStarted = 0, gamesQuit = 0, matchesCompleted = 0;
            history.forEach(m => {
                totalKills += m.kills || 0;
                totalDeaths += m.deaths || 0;
                if (m.joined) gamesJoined++;
                if (m.started) gamesStarted++;
                if (m.quit) gamesQuit++;
                if (currentMode === 'special' && m.isSpecialMode && !m.quit) matchesCompleted++;
                if (currentMode === 'normal' && !m.isSpecialMode && !m.quit) matchesCompleted++;
                if (currentMode === 'custom' && m.isCustomMode && !m.quit) matchesCompleted++;
            });
            const setObj = {};
            setObj[getModeKey('matchHistory', skid)] = history;
            setObj[getModeKey('gamesJoined', skid)] = gamesJoined;
            setObj[getModeKey('gamesStarted', skid)] = gamesStarted;
            setObj[getModeKey('gamesQuit', skid)] = gamesQuit;
            setObj[getModeKey('matchesCompleted', skid)] = matchesCompleted;
            chrome.storage.sync.set(setObj, loadStats);
        });
    });
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('normalModeBtn').addEventListener('click', () => {
        currentMode = 'normal';
        updateModeSelector();
        loadStats();
    });
    document.getElementById('specialModeBtn').addEventListener('click', () => {
        currentMode = 'special';
        updateModeSelector();
        loadStats();
    });
    document.getElementById('customModeBtn').addEventListener('click', () => {
        currentMode = 'custom';
        updateModeSelector();
        loadStats();
    });
    updateModeSelector();
    loadStats();
});

chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync') {
        loadStats();
    }
});

document.getElementById('resetStatsBtn').addEventListener('click', function() {
    if (!currentSkid) return;
    if (confirm('Are you sure you want to reset all stats and match history for this SKID and mode?')) {
        const setObj = {};
        setObj[getModeKey('matchHistory', currentSkid)] = [];
        setObj[getModeKey('gamesJoined', currentSkid)] = 0;
        setObj[getModeKey('gamesStarted', currentSkid)] = 0;
        setObj[getModeKey('gamesQuit', currentSkid)] = 0;
        setObj[getModeKey('matchesCompleted', currentSkid)] = 0;
        chrome.storage.sync.set(setObj, loadStats);
    }
});

window.addEventListener('message', function(event) {
    if (event.data && event.data.type === 'SKMT_SKID_UPDATED') {
        loadStats();
    }
}); 