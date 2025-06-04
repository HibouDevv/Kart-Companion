// Overhauled popup.js for simple stats and match history

const killsElement = document.getElementById('kills');
const deathsElement = document.getElementById('deaths');
const matchesElement = document.getElementById('matches');
const matchesList = document.getElementById('matches-list');

// Section switching functionality
const statsBtn = document.getElementById('statsBtn');
const hudBtn = document.getElementById('hudBtn');
const statsSection = document.getElementById('statsSection');
const hudSection = document.getElementById('hudSection');

// Initialize sections
statsSection.classList.add('active');

// Handle section switching
statsBtn.addEventListener('click', () => {
    statsBtn.classList.add('selected');
    hudBtn.classList.remove('selected');
    statsSection.style.display = 'block';
    hudSection.style.display = 'none';
});

hudBtn.addEventListener('click', () => {
    hudBtn.classList.add('selected');
    statsBtn.classList.remove('selected');
    statsSection.style.display = 'none';
    hudSection.style.display = 'block';
});

// Add event listeners for the new buttons
document.getElementById('playerCardBtn').addEventListener('click', () => {
    chrome.tabs.create({ url: 'player-card.html' });
});

document.getElementById('statsNumbersBtn').addEventListener('click', () => {
    chrome.tabs.create({ url: 'stats-numbers.html' });
});

const toggleDeathsHud = document.getElementById('toggleDeathsHud');
const toggleKillStreakHud = document.getElementById('toggleKillStreakHud');
const toggleKdrHud = document.getElementById('toggleKdrHud');

toggleDeathsHud.addEventListener('change', function() {
    const enabled = this.checked;
    chrome.storage.sync.set({ deathsHudEnabled: enabled });
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
        chrome.tabs.sendMessage(tabs[0].id, {type: 'toggle-deaths-hud', enabled});
    });
});

toggleKillStreakHud.addEventListener('change', function() {
    const enabled = this.checked;
    chrome.storage.sync.set({ killStreakHudEnabled: enabled });
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
        chrome.tabs.sendMessage(tabs[0].id, {type: 'toggle-killstreak-hud', enabled});
    });
});

toggleKdrHud.addEventListener('change', function() {
    const enabled = this.checked;
    chrome.storage.sync.set({ kdrHudEnabled: enabled });
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
        chrome.tabs.sendMessage(tabs[0].id, {type: 'toggle-kdr-hud', enabled});
    });
});

// Restore toggle state on popup load
chrome.storage.sync.get(['deathsHudEnabled', 'killStreakHudEnabled', 'kdrHudEnabled'], (result) => {
    toggleDeathsHud.checked = result.deathsHudEnabled !== false; // default ON
    toggleKillStreakHud.checked = result.killStreakHudEnabled !== false; // default ON
    toggleKdrHud.checked = result.kdrHudEnabled !== false; // default ON

    // Send the correct state to the content script
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
        chrome.tabs.sendMessage(tabs[0].id, {type: 'toggle-deaths-hud', enabled: toggleDeathsHud.checked});
        chrome.tabs.sendMessage(tabs[0].id, {type: 'toggle-killstreak-hud', enabled: toggleKillStreakHud.checked});
        chrome.tabs.sendMessage(tabs[0].id, {type: 'toggle-kdr-hud', enabled: toggleKdrHud.checked});
    });
});

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

function formatTimeSpent(milliseconds) {
    const seconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    
    if (hours > 0) {
        return `${hours}h ${minutes}m ${remainingSeconds}s`;
    } else if (minutes > 0) {
        return `${minutes}m ${remainingSeconds}s`;
    } else {
        return `${remainingSeconds}s`;
    }
}

let currentSkid = 'Default';
let currentMode = 'normal';
let selectedMap = 'all';

// Add state for tracking open sections
let openSections = {
    primaryStats: false,
    secondaryStats: false,
    averageStats: false,
    streaks: false,
    quickKills: false
};

// Get reference to the dynamic graphics button
const modeGraphicsBtn = document.getElementById('modeGraphicsBtn');

// Function to update the text and URL of the dynamic graphics button
function updateModeGraphicsButton() {
    let buttonText = '';
    let targetUrl = '';
    switch(currentMode) {
        case 'normal':
            buttonText = '3 Minute Mode Graphics';
            targetUrl = '3min-mode.html';
            break;
        case 'special':
            buttonText = 'Special Mode Graphics';
            targetUrl = 'special-mode.html';
            break;
        case 'custom':
            buttonText = 'Custom Match Graphics';
            targetUrl = 'custom-mode.html';
            break;
        case 'all':
            buttonText = 'All Stats Graphics';
            targetUrl = 'visualizers.html';
            break;
        default:
            buttonText = 'Graphics'; // Default text
            targetUrl = '';
    }
    modeGraphicsBtn.textContent = buttonText;
    // Store the target URL as a data attribute on the button
    modeGraphicsBtn.dataset.targetUrl = targetUrl;
}

function getModeKey(base, skid, mode) {
    // Use provided mode or currentMode if mode is not specified
    const targetMode = mode || currentMode;
    if (targetMode === 'all') return null; // No mode key for all stats
    return `${base}_${skid}_${targetMode}`;
}

function updateModeSelector() {
    document.getElementById('normalModeBtn').classList.toggle('selected', currentMode === 'normal');
    document.getElementById('specialModeBtn').classList.toggle('selected', currentMode === 'special');
    document.getElementById('customModeBtn').classList.toggle('selected', currentMode === 'custom');
    document.getElementById('allStatsBtn').classList.toggle('selected', currentMode === 'all');

    // Update header text
    document.getElementById('primaryStatsHeader').textContent = currentMode === 'all' ? 'All Modes Primary Stats' : 'Primary Stats';
    document.getElementById('secondaryStatsHeader').textContent = currentMode === 'all' ? 'All Modes Secondary Stats' : 'Secondary Stats';

    // Update the dynamic graphics button
    updateModeGraphicsButton();
}

function displayStats(data, mode) {
    let history = [];
    let mapStats = new Map();

    if (mode === 'all') {
        // Combine history and map stats from all modes
        const modes = ['normal', 'special', 'custom'];
        modes.forEach(m => {
            const modeHistory = data[getModeKey('matchHistory', currentSkid, m)] || [];
            history = history.concat(modeHistory);
            modeHistory.forEach(match => {
                if (match.map) {
                    const count = mapStats.get(match.map) || 0;
                    mapStats.set(match.map, count + 1);
                }
            });
        });
    } else {
        // Current mode only
        history = data[getModeKey('matchHistory', currentSkid, mode)] || [];
        history.forEach(match => {
            if (match.map) {
                const count = mapStats.get(match.map) || 0;
                mapStats.set(match.map, count + 1);
            }
        });
    }

    // Update map filter options
    const mapFilter = document.getElementById('mapFilter');
    const previousSelection = mapFilter.value || 'all';
    mapFilter.innerHTML = '<option value="all">All Maps</option>';
    const sortedMapsForFilter = Array.from(mapStats.entries())
        .sort((a, b) => b[1] - a[1]);
    sortedMapsForFilter.forEach(([mapName, count]) => {
        const option = document.createElement('option');
        option.value = mapName;
        option.textContent = mapName;
        mapFilter.appendChild(option);
    });
    if ([...mapFilter.options].some(opt => opt.value === previousSelection)) {
        mapFilter.value = previousSelection;
        selectedMap = previousSelection;
    } else {
        mapFilter.value = 'all';
        selectedMap = 'all';
    }

    // Filter history based on selected map
    const filteredHistory = selectedMap === 'all'
        ? history
        : history.filter(match => match.map === selectedMap);

    // Calculate stats using filtered history
    let totalKills = 0, totalDeaths = 0, totalTimeSpent = 0;
    filteredHistory.forEach(m => {
        totalKills += m.kills || 0;
        totalDeaths += m.deaths || 0;
        totalTimeSpent += m.duration || (m.matchEndTime && m.matchStartTime ? m.matchEndTime - m.matchStartTime : 0);
    });

    // Get gamesQuit from storage for the current mode
    let gamesQuit = 0;
    if (mode === 'all') {
        // Sum up quit counts from all modes
        const modes = ['normal', 'special', 'custom'];
        modes.forEach(m => {
            gamesQuit += data[getModeKey('gamesQuit', currentSkid, m)] || 0;
        });
    } else {
        gamesQuit = data[getModeKey('gamesQuit', currentSkid, mode)] || 0;
    }

    console.log('[SKMT][DISPLAY] Current gamesQuit value:', gamesQuit, 'Mode:', mode);

    // Update the gamesQuit display
    document.getElementById('gamesQuit').textContent = gamesQuit;

    // Update maps section to show only maps played in current mode
    const mapsList = document.getElementById('mapsList');
    mapsList.innerHTML = ''; // Clear existing content

    // Sort maps by count (descending)
    const sortedMapsForDisplay = Array.from(mapStats.entries())
        .sort((a, b) => b[1] - a[1]);

    // Create stat cards for each map played in current mode
    sortedMapsForDisplay.forEach(([mapName, count]) => {
        const card = document.createElement('div');
        card.className = 'stat-card';
        card.innerHTML = `
            <span class="stat-label">${mapName}</span>
            <span class="stat-value">${count}</span>
        `;
        mapsList.appendChild(card);
    });

    // If no maps played in current mode, show a message
    if (sortedMapsForDisplay.length === 0) {
        const noMaps = document.createElement('div');
        noMaps.className = 'no-maps';
        noMaps.textContent = 'No maps played yet in this mode';
        mapsList.appendChild(noMaps);
    }

    let gamesJoined = 0;
    let gamesStarted = 0;
    let matchesCompleted = 0;

    // Initialize record tracking
    let highestKillsRecord = 0;
    let highestDeathsRecord = 0;
    let highestKillStreakRecord = 0;
    let highestKDRRecord = 0;
    let longestTimePlayedRecord = 0;

    // Initialize streak counters
    let smashStreak = 0;
    let smashtacularStreak = 0;
    let smashosaurusStreak = 0;
    let smashlvaniaStreak = 0;
    let monsterSmashStreak = 0;
    let potatoStreak = 0;
    let smashSmashStreak = 0;
    let potoatachioStreak = 0;

    // Initialize quick kills streak counters
    let doubleSmash = 0;
    let multiSmash = 0;
    let multiMegaSmash = 0;
    let multiMegaUltraSmash = 0;
    let gooseySmash = 0;
    let crazyMultiMegaUltraSmash = 0;

    // Calculate stats for the current mode
    filteredHistory.forEach(m => {
        // Update records
        if (m.kills > highestKillsRecord) highestKillsRecord = m.kills;
        if (m.deaths > highestDeathsRecord) highestDeathsRecord = m.deaths;
        
        // Calculate KDR for this match
        const matchKDR = m.deaths > 0 ? m.kills / m.deaths : m.kills;
        if (matchKDR > highestKDRRecord) highestKDRRecord = matchKDR;

        // Calculate longest time played in a match
        const matchDuration = m.duration || (m.matchEndTime && m.matchStartTime ? m.matchEndTime - m.matchStartTime : 0);
        if (matchDuration > longestTimePlayedRecord) longestTimePlayedRecord = matchDuration;

        // Calculate highest kill streak for this match
        if (m.killTimestamps && m.killTimestamps.length > 0) {
            let currentStreak = 0;
            let maxStreak = 0;
            
            // Create a combined timeline of kills and deaths
            const timeline = [];
            if (m.killTimestamps) {
                m.killTimestamps.forEach(time => timeline.push({ type: 'kill', time }));
            }
            if (m.deathTimestamps) {
                m.deathTimestamps.forEach(time => timeline.push({ type: 'death', time }));
            }
            // Sort timeline by timestamp
            timeline.sort((a, b) => a.time - b.time);

            // Process events in chronological order
            timeline.forEach(event => {
                if (event.type === 'death') {
                    if (currentStreak > maxStreak) maxStreak = currentStreak;
                    currentStreak = 0; // Reset streak on death
                } else if (event.type === 'kill') {
                    currentStreak++;
                    if (currentStreak > maxStreak) maxStreak = currentStreak;
                }
            });
            if (maxStreak > highestKillStreakRecord) highestKillStreakRecord = maxStreak;
        }

        // Calculate streaks for this match
        let currentStreak = 0;
        let lastKillTime = null;
        let quickKillStreak = 0;
        let achievedMilestones = {}; // Track milestones achieved in the current life

        // Create a combined timeline of kills and deaths
        const timeline = [];
        if (m.killTimestamps) {
            m.killTimestamps.forEach(time => timeline.push({ type: 'kill', time }));
        }
        if (m.deathTimestamps) {
            m.deathTimestamps.forEach(time => timeline.push({ type: 'death', time }));
        }
        // Sort timeline by timestamp
        timeline.sort((a, b) => a.time - b.time);

        // Process events in chronological order
        timeline.forEach(event => {
            if (event.type === 'death') {
                currentStreak = 0; // Reset streak immediately on death
                achievedMilestones = {}; // Reset achieved milestones for the new life
                quickKillStreak = 0; // Reset quick kill streak on death
                lastKillTime = null; // Reset last kill time on death
            } else if (event.type === 'kill') {
                currentStreak++;
                // Check for streak milestones only once per life
                if (currentStreak >= 3 && !achievedMilestones[3]) {
                    smashStreak++;
                    achievedMilestones[3] = true;
                }
                if (currentStreak >= 5 && !achievedMilestones[5]) {
                    smashtacularStreak++;
                    achievedMilestones[5] = true;
                }
                if (currentStreak >= 7 && !achievedMilestones[7]) {
                    smashosaurusStreak++;
                    achievedMilestones[7] = true;
                }
                if (currentStreak >= 10 && !achievedMilestones[10]) {
                    smashlvaniaStreak++;
                    achievedMilestones[10] = true;
                }
                if (currentStreak >= 15 && !achievedMilestones[15]) {
                    monsterSmashStreak++;
                    achievedMilestones[15] = true;
                }
                if (currentStreak >= 20 && !achievedMilestones[20]) {
                    potatoStreak++;
                    achievedMilestones[20] = true;
                }
                if (currentStreak >= 25 && !achievedMilestones[25]) {
                    smashSmashStreak++;
                    achievedMilestones[25] = true;
                }
                if (currentStreak >= 30 && !achievedMilestones[30]) {
                    potoatachioStreak++;
                    achievedMilestones[30] = true;
                }

                // Handle quick kills streak
                if (lastKillTime === null) {
                    // First kill after death
                    quickKillStreak = 1;
                    lastKillTime = event.time;
                } else {
                    const timeSinceLastKill = event.time - lastKillTime;
                    if (timeSinceLastKill <= 4000) {
                        // Kill within 4 seconds of last kill - INCREASE STREAK
                        quickKillStreak++;
                        if (quickKillStreak === 2) doubleSmash++;
                        if (quickKillStreak === 3) multiSmash++;
                        if (quickKillStreak === 4) multiMegaSmash++;
                        if (quickKillStreak === 5) multiMegaUltraSmash++;
                        if (quickKillStreak === 6) gooseySmash++;
                        if (quickKillStreak === 7) crazyMultiMegaUltraSmash++;
                    } else {
                        // Kill after more than 4 seconds - RESET STREAK
                        quickKillStreak = 1;
                    }
                    lastKillTime = event.time;
                }
            }
        });

        // Update game stats
        if (m.joined) gamesJoined++;
        if (m.started) gamesStarted++;
        if (m.quit) gamesQuit++;
        if (!m.quit) matchesCompleted++;
    });

    // Update record displays
    document.getElementById('highestKillsRecord').textContent = highestKillsRecord;
    document.getElementById('highestDeathsRecord').textContent = highestDeathsRecord;
    document.getElementById('highestKillStreakRecord').textContent = highestKillStreakRecord;
    document.getElementById('highestKDRRecord').textContent = highestKDRRecord.toFixed(2);
    document.getElementById('longestTimePlayedRecord').textContent = formatTimeSpent(longestTimePlayedRecord);

    // Update streak displays
    document.getElementById('smashStreak').textContent = smashStreak;
    document.getElementById('smashtacularStreak').textContent = smashtacularStreak;
    document.getElementById('smashosaurusStreak').textContent = smashosaurusStreak;
    document.getElementById('smashlvaniaStreak').textContent = smashlvaniaStreak;
    document.getElementById('monsterSmashStreak').textContent = monsterSmashStreak;
    document.getElementById('potatoStreak').textContent = potatoStreak;
    document.getElementById('smashSmashStreak').textContent = smashSmashStreak;
    document.getElementById('potoatachioStreak').textContent = potoatachioStreak;

    // Update quick kills streak displays
    document.getElementById('doubleSmash').textContent = doubleSmash;
    document.getElementById('multiSmash').textContent = multiSmash;
    document.getElementById('multiMegaSmash').textContent = multiMegaSmash;
    document.getElementById('multiMegaUltraSmash').textContent = multiMegaUltraSmash;
    document.getElementById('gooseySmash').textContent = gooseySmash;
    document.getElementById('crazyMultiMegaUltraSmash').textContent = crazyMultiMegaUltraSmash;

    // Update streak header based on mode
    document.getElementById('streaksHeader').textContent = mode === 'all' ? 'All Modes Streaks (Without Dying)' : 'Streaks (Without Dying)';
    document.getElementById('quickKillsHeader').textContent = mode === 'all' ? 'All Modes Streaks (Quick Kills)' : 'Streaks (Quick Kills)';

    // Calculate Total Matches (Completed + Quit)
    const totalMatchesCount = (matchesCompleted || 0) + (gamesQuit || 0);

    // Update labels based on mode
    document.getElementById('killsLabel').textContent = mode === 'all' ? 'Total Kills' : 'Kills';
    document.getElementById('deathsLabel').textContent = mode === 'all' ? 'Total Deaths' : 'Deaths';
    document.getElementById('kdrLabel').textContent = mode === 'all' ? 'Overall KDR' : 'KDR';
    
    // Updated label for Matches Completed
    document.getElementById('matchesCompletedLabel').textContent = mode === 'all' ? 'Total Matches Completed' : 'Matches Completed';
    
    // Updated label for Time Played
    document.getElementById('totalTimeSpentLabel').textContent = mode === 'all' ? 'Total Time Played' : 'Time Played';
    
    // Updated label for Matches Joined
    document.getElementById('gamesJoinedLabel').textContent = mode === 'all' ? 'Total Matches Joined' : 'Matches Joined';
    
    // Updated label for Total Matches (Completed + Quit)
    document.getElementById('totalMatchesLabel').textContent = mode === 'all' ? 'Total Matches (Completed + Quit)' : 'Total Matches (Completed + Quit)';

    console.log('[SKMT][POPUP][DISPLAY] Updating gamesQuit display. Value:', gamesQuit, 'Element:', document.getElementById('gamesQuit'));
    document.getElementById('kills').textContent = totalKills;
    document.getElementById('deaths').textContent = totalDeaths;
    document.getElementById('kdr').textContent = formatKDR(totalKills, totalDeaths);
    document.getElementById('totalTimeSpent').textContent = formatTimeSpent(totalTimeSpent);

    document.getElementById('gamesJoined').textContent = gamesJoined;
    document.getElementById('gamesStarted').textContent = gamesStarted;
    document.getElementById('gamesQuit').textContent = gamesQuit;
    document.getElementById('matchesCompleted').textContent = matchesCompleted;
    document.getElementById('totalMatches').textContent = totalMatchesCount;

    // Calculate and display rates for both individual and all modes
    const totalMatches = totalMatchesCount;
    const completedRate = totalMatches > 0 ? ((matchesCompleted || 0) / totalMatches) * 100 : 0;
    const quitRate = totalMatches > 0 ? ((gamesQuit || 0) / totalMatches) * 100 : 0;

    document.getElementById('matchesCompletedRate').textContent = `${completedRate.toFixed(2)}%`;
    document.getElementById('matchesQuitRate').textContent = `${quitRate.toFixed(2)}%`;

    // Calculate and display average stats
    const completedMatches = filteredHistory.filter(m => !m.quit).length;
    const avgKills = completedMatches > 0 ? totalKills / completedMatches : 0;
    const avgDeaths = completedMatches > 0 ? totalDeaths / completedMatches : 0;
    const avgTimeSpent = completedMatches > 0 ? totalTimeSpent / completedMatches : 0;

    document.getElementById('avgKills').textContent = avgKills.toFixed(2);
    document.getElementById('avgDeaths').textContent = avgDeaths.toFixed(2);
    document.getElementById('avgTimeSpent').textContent = formatTimeSpent(avgTimeSpent);

    // Update average stats header label
    document.getElementById('averageStatsHeader').textContent = mode === 'all' ? 'All Modes Average Stats' : 'Average Stats';

    // Render match history only for individual modes
    const matchesList = document.getElementById('matches-list');
    matchesList.innerHTML = '';
    
    let matchesToRender = [];
    if (mode === 'all') {
        // Combine and sort match history from all modes
        const allHistory = [];
        const modes = ['normal', 'special', 'custom'];
        modes.forEach(mode => {
            const modeHistory = data[getModeKey('matchHistory', currentSkid, mode)] || [];
            modeHistory.forEach(match => {
                allHistory.push({
                    ...match,
                    mode: mode // Add mode information to each match
                });
            });
        });
        matchesToRender = allHistory;
    } else {
        matchesToRender = history.slice().reverse();
    }

    // Sorting logic
    const sortValue = document.getElementById('matchSortSelect') ? document.getElementById('matchSortSelect').value : 'recent';
    if (sortValue === 'recent') {
        matchesToRender.sort((a, b) => (b.matchStartTime || 0) - (a.matchStartTime || 0));
    } else if (sortValue === 'oldest') {
        matchesToRender.sort((a, b) => (a.matchStartTime || 0) - (b.matchStartTime || 0));
    } else if (sortValue === 'kills') {
        matchesToRender.sort((a, b) => (b.kills || 0) - (a.kills || 0));
    } else if (sortValue === 'favorites') {
        matchesToRender = matchesToRender.filter(m => favoriteMatches[m.matchStartTime]);
        matchesToRender.sort((a, b) => (b.matchStartTime || 0) - (a.matchStartTime || 0));
    }

    renderMatches(matchesToRender, mode);
}

function loadStats() {
    chrome.storage.sync.get(['currentSkid'], (skidData) => {
        currentSkid = skidData.currentSkid || 'Default';
        document.getElementById('skidValue').textContent = currentSkid;

        const keysToFetch = ['currentSkid']; // Always fetch currentSkid
        const modes = ['normal', 'special', 'custom'];

        // Also fetch favorite matches for the current SKID
        keysToFetch.push(`favoriteMatches_${currentSkid}`);

        if (currentMode === 'all') {
            // Fetch all data for all modes
            modes.forEach(mode => {
                keysToFetch.push(getModeKey('matchHistory', currentSkid, mode));
                keysToFetch.push(getModeKey('gamesJoined', currentSkid, mode));
                keysToFetch.push(getModeKey('gamesStarted', currentSkid, mode));
                keysToFetch.push(getModeKey('gamesQuit', currentSkid, mode));
                keysToFetch.push(getModeKey('matchesCompleted', currentSkid, mode));
            });
        } else {
            // Fetch data only for the current mode
            keysToFetch.push(getModeKey('matchHistory', currentSkid, currentMode));
            keysToFetch.push(getModeKey('gamesJoined', currentSkid, currentMode));
            keysToFetch.push(getModeKey('gamesStarted', currentSkid, currentMode));
            keysToFetch.push(getModeKey('gamesQuit', currentSkid, currentMode));
            keysToFetch.push(getModeKey('matchesCompleted', currentSkid, currentMode));
        }

        console.log('[SKMT][LOAD] Loading stats for SKID:', currentSkid, 'Mode:', currentMode, 'Keys:', keysToFetch);

        chrome.storage.sync.get(keysToFetch, (data) => {
            console.log('[SKMT][LOAD] Data returned from chrome.storage.sync:', data);

            // Load favorite matches into the global object
            favoriteMatches = data[`favoriteMatches_${currentSkid}`] || {};
            console.log('[SKMT][POPUP] Loaded favorite matches:', favoriteMatches);

            // Inject favorite state into match history objects
            const modesToProcess = currentMode === 'all' ? modes : [currentMode];
            modesToProcess.forEach(m => {
                 const matchHistoryKey = getModeKey('matchHistory', currentSkid, m);
                 if (data[matchHistoryKey]) {
                     data[matchHistoryKey].forEach(match => {
                          // Use matchStartTime as the key, consistent with web page
                          match.favorite = favoriteMatches[match.matchStartTime] === true;
                     });
                 }
            });

            // Show match history section for both all and individual modes
            document.querySelector('.match-history').style.display = 'block';

            // Pass the data directly to displayStats for both all and individual modes
            displayStats(data, currentMode);
        });
    });
}

function deleteMatch(index, mode) {
    // Add confirmation prompt
    if (!confirm('Are you sure you want to delete this match? This action cannot be undone.')) {
        return;
    }
    
    // Remove the match at the given index from the current mode's history
    chrome.storage.sync.get(['currentSkid'], (skidData) => {
        const skid = skidData.currentSkid || 'Default';
        // If mode is provided, use it; otherwise use currentMode
        const targetMode = mode || currentMode;
        // Ensure we are not in 'all' mode when deleting a match
        if (currentMode === 'all' && !mode) {
            console.warn('[SKMT][DELETE] Cannot delete individual match in All Stats mode without mode specified.');
            return;
        }
        const key = getModeKey('matchHistory', skid, targetMode);
        chrome.storage.sync.get([key], (data) => {
            let history = data[key] || [];
            if (index < 0 || index >= history.length) return;
            const removed = history.splice(index, 1)[0];
            // Recalculate stats for the specific mode
            let totalKills = 0, totalDeaths = 0, gamesJoined = 0, gamesStarted = 0, gamesQuit = 0, matchesCompleted = 0;
            history.forEach(m => {
                totalKills += m.kills || 0;
                totalDeaths += m.deaths || 0;
                if (m.joined) gamesJoined++;
                if (m.started) gamesStarted++;
                if (m.quit) gamesQuit++;
                if (targetMode === 'special' && m.isSpecialMode && !m.quit) matchesCompleted++;
                if (targetMode === 'normal' && !m.isSpecialMode && !m.isCustomMode && !m.quit) matchesCompleted++;
                if (targetMode === 'custom' && m.isCustomMode && !m.quit) matchesCompleted++;
            });
            const setObj = {};
            setObj[getModeKey('matchHistory', skid, targetMode)] = history;
            setObj[getModeKey('gamesJoined', skid, targetMode)] = gamesJoined;
            setObj[getModeKey('gamesStarted', skid, targetMode)] = gamesStarted;
            setObj[getModeKey('gamesQuit', skid, targetMode)] = gamesQuit;
            setObj[getModeKey('matchesCompleted', skid, targetMode)] = matchesCompleted;
            chrome.storage.sync.set(setObj, loadStats); // Reload stats for the current mode
        });
    });
}

document.addEventListener('DOMContentLoaded', () => {
    // Add SKID toggle and copy functionality
    const skidValue = document.getElementById('skidValue');
    const toggleSkidBtn = document.getElementById('toggleSkidBtn');
    const copySkidBtn = document.getElementById('copySkidBtn');

    // Load saved blur state
    chrome.storage.sync.get(['skidBlurred'], (result) => {
        if (result.skidBlurred) {
            skidValue.classList.add('skid-blurred');
            const icon = toggleSkidBtn.querySelector('i');
            icon.classList.remove('fa-eye');
            icon.classList.add('fa-eye-slash');
        }
    });

    toggleSkidBtn.addEventListener('click', () => {
        skidValue.classList.toggle('skid-blurred');
        const icon = toggleSkidBtn.querySelector('i');
        if (skidValue.classList.contains('skid-blurred')) {
            icon.classList.remove('fa-eye');
            icon.classList.add('fa-eye-slash');
            // Save blur state
            chrome.storage.sync.set({ skidBlurred: true });
        } else {
            icon.classList.remove('fa-eye-slash');
            icon.classList.add('fa-eye');
            // Save blur state
            chrome.storage.sync.set({ skidBlurred: false });
        }
    });

    copySkidBtn.addEventListener('click', () => {
        const skid = skidValue.textContent;
        if (skid && skid !== '-') {
            navigator.clipboard.writeText(skid).then(() => {
                // Show a temporary tooltip or feedback
                const originalTitle = copySkidBtn.getAttribute('title');
                copySkidBtn.setAttribute('title', 'Copied!');
                // Add a visual indicator
                const icon = copySkidBtn.querySelector('i');
                icon.classList.remove('fa-copy');
                icon.classList.add('fa-check');
                // Reset after 2 seconds
                setTimeout(() => {
                    copySkidBtn.setAttribute('title', originalTitle);
                    icon.classList.remove('fa-check');
                    icon.classList.add('fa-copy');
                }, 2000);
            });
        }
    });

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
    document.getElementById('allStatsBtn').addEventListener('click', () => {
        currentMode = 'all';
        updateModeSelector(); // This now calls updateModeGraphicsButton()
        loadStats();
    });

    // Add event listener for the dynamic graphics button
    if (modeGraphicsBtn) {
        modeGraphicsBtn.addEventListener('click', () => {
            const targetUrl = modeGraphicsBtn.dataset.targetUrl;
            if (targetUrl) {
                chrome.tabs.create({ url: targetUrl });
            }
        });
    }

    // Add event listeners for section toggles
    document.querySelectorAll('.stats-details').forEach(section => {
        section.addEventListener('toggle', () => {
            saveSectionStates();
        });
    });

    // Add event listeners for export/import buttons
    document.getElementById('exportStatsBtn').addEventListener('click', exportStats);
    document.getElementById('importStatsBtn').addEventListener('click', () => {
        document.getElementById('importStatsInput').click();
    });
    document.getElementById('importStatsInput').addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            importStats(e.target.files[0]);
            e.target.value = ''; // Reset input
        }
    });

    // Add event listener for visualize stats button
    document.getElementById('visualizeStatsBtn').addEventListener('click', () => {
        console.log('[SKMT] Visualize Stats button clicked');
        const button = document.getElementById('visualizeStatsBtn');
        button.disabled = true; // Disable button while processing
        
        try {
            chrome.runtime.sendMessage({ type: 'OPEN_VISUALIZERS' }, (response) => {
                button.disabled = false; // Re-enable button
                
                if (chrome.runtime.lastError) {
                    console.error('[SKMT] Error opening visualizers:', chrome.runtime.lastError);
                    alert('Failed to open visualizers: ' + chrome.runtime.lastError.message);
                    return;
                }
                
                if (!response) {
                    console.error('[SKMT] No response received from background script');
                    alert('Failed to open visualizers: No response received');
                    return;
                }
                
                if (!response.success) {
                    console.error('[SKMT] Failed to open visualizers:', response.error);
                    alert('Failed to open visualizers: ' + (response.error || 'Unknown error'));
                    return;
                }
                
                console.log('[SKMT] Successfully opened visualizers in tab:', response.tabId);
            });
        } catch (error) {
            button.disabled = false; // Re-enable button on error
            console.error('[SKMT] Error sending message:', error);
            alert('Failed to open visualizers: ' + error.message);
        }
    });

    // Add event listener for reset stats button
    document.getElementById('resetStatsBtn').addEventListener('click', function() {
        if (!currentSkid) return;

        // Determine which keys to reset based on currentMode
        const keysToReset = [];
        const modes = currentMode === 'all' ? ['normal', 'special', 'custom'] : [currentMode];

        if (confirm(`Are you sure you want to reset all stats and match history for ${currentMode === 'all' ? 'all modes' : 'this mode'} and SKID?`)) {
            modes.forEach(mode => {
                keysToReset.push(getModeKey('matchHistory', currentSkid, mode));
                keysToReset.push(getModeKey('gamesJoined', currentSkid, mode));
                keysToReset.push(getModeKey('gamesStarted', currentSkid, mode));
                keysToReset.push(getModeKey('gamesQuit', currentSkid, mode));
                keysToReset.push(getModeKey('matchesCompleted', currentSkid, mode));
            });

            const setObj = {};
            keysToReset.forEach(key => setObj[key] = key.includes('matchHistory') ? [] : 0);

            chrome.storage.sync.set(setObj, () => {
                console.log('[SKMT][RESET] Stats reset for', modes, 'mode(s).');
                loadStats(); // Reload stats after reset
            });
        }
    });

    updateModeSelector();
    loadStats(); // Load stats for the default mode on startup

    // Restore section states after loading stats
    restoreSectionStates();

    // Add event listener for More Details button
    const moreDetailsBtn = document.getElementById('moreDetailsBtn');
    if (moreDetailsBtn) {
        moreDetailsBtn.addEventListener('click', () => {
            chrome.tabs.create({ url: 'match-history.html' });
        });
    }
});

chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync') {
        const favoriteKey = `favoriteMatches_${currentSkid || 'Default'}`;
        if (changes[favoriteKey]) {
            console.log('[SKMT][POPUP] Favorite matches changed in storage, reloading stats.');
            loadStats(); // Reload stats to update the display
        } else if (currentSkid) {
             // Only reload if the change is relevant to the current skid for other data
             const skidRelevant = Object.keys(changes).some(key => key.includes(`_${currentSkid}_`));
             if (skidRelevant) {
                 loadStats(); // Reload stats for the current mode (or all modes)
             }
        }
    }
});

// Add this near the top of the file with other constants
const MAX_UPDATE_RETRIES = 3;
const UPDATE_RETRY_DELAY = 1000; // 1 second

// Add this function after the existing functions
async function verifyStatsUpdate(mode, expectedMatch) {
    return new Promise((resolve) => {
        chrome.storage.sync.get([getModeKey('matchHistory', currentSkid, mode)], (data) => {
            const history = data[getModeKey('matchHistory', currentSkid, mode)] || [];
            const lastMatch = history[history.length - 1];
            
            // Verify the last match matches our expected match
            const isUpdated = lastMatch && 
                lastMatch.matchEndTime === expectedMatch.matchEndTime &&
                lastMatch.kills === expectedMatch.kills &&
                lastMatch.deaths === expectedMatch.deaths;
            
            resolve(isUpdated);
        });
    });
}

async function forceStatsRefresh() {
    console.log('[SKMT][POPUP] Forcing stats refresh');
    await loadStats();
}

// Add this near the top with other constants
const MESSAGE_PORT_TIMEOUT = 5000; // 5 seconds timeout for message port
const MESSAGE_RETRY_DELAY = 1000; // 1 second between retries
const MAX_MESSAGE_RETRIES = 3;

// Add this function after other utility functions
async function sendMessageWithRetry(message, retryCount = 0) {
    return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
            if (retryCount < MAX_MESSAGE_RETRIES) {
                console.log(`[SKMT][POPUP] Message port timeout, retrying (${retryCount + 1}/${MAX_MESSAGE_RETRIES})...`);
                setTimeout(() => {
                    sendMessageWithRetry(message, retryCount + 1)
                        .then(resolve)
                        .catch(reject);
                }, MESSAGE_RETRY_DELAY);
            } else {
                reject(new Error('Message port timeout after all retries'));
            }
        }, MESSAGE_PORT_TIMEOUT);

        chrome.runtime.sendMessage(message, (response) => {
            clearTimeout(timeoutId);
            if (chrome.runtime.lastError) {
                console.error('[SKMT][POPUP] Message port error:', chrome.runtime.lastError);
                if (retryCount < MAX_MESSAGE_RETRIES) {
                    console.log(`[SKMT][POPUP] Retrying message (${retryCount + 1}/${MAX_MESSAGE_RETRIES})...`);
                    setTimeout(() => {
                        sendMessageWithRetry(message, retryCount + 1)
                            .then(resolve)
                            .catch(reject);
                    }, MESSAGE_RETRY_DELAY);
                } else {
                    reject(chrome.runtime.lastError);
                }
            } else {
                resolve(response);
            }
        });
    });
}

// Modify the message listener to use the new retry mechanism
chrome.runtime.onMessage.addListener(
    function(request, sender, sendResponse) {
        if (request.type === 'SKMT_SKID_UPDATED') {
            loadStats();
            sendResponse({ success: true });
            return true;
        } else if (request.type === 'SKMT_MATCH_COMPLETE') {
            console.log('[SKMT][POPUP] Received MATCH_COMPLETE message:', request.data);
            const match = request.data;
            
            // Update the display immediately with the current stats
            if (match.currentStats) {
                document.getElementById('kills').textContent = match.currentStats.kills;
                document.getElementById('deaths').textContent = match.currentStats.deaths;
                document.getElementById('kdr').textContent = formatKDR(match.currentStats.kills, match.currentStats.deaths);
            }
            
            // Then load the full stats
            loadStats();
            
            try {
                sendResponse({ success: true });
            } catch (error) {
                console.error('[SKMT][POPUP] Error sending response:', error);
            }
            return true;
        } else if (request.type === 'SKMT_DEATHS_UPDATE') {
            // Update deaths display in real-time
            document.getElementById('deaths').textContent = request.deaths;
            // Recalculate and update KDR
            const kills = parseInt(document.getElementById('kills').textContent) || 0;
            document.getElementById('kdr').textContent = formatKDR(kills, request.deaths);
            sendResponse({ success: true });
            return true;
        } else if (request.type === 'SKMT_KILLSTREAK_UPDATE') {
            // Update kill streak display in real-time
            document.getElementById('killStreak').textContent = request.killStreak;
            sendResponse({ success: true });
            return true;
        }
    }
);

// Encryption key generation and management
const ENCRYPTION_VERSION = '1.4';
let ENCRYPTION_KEY = null;

async function initializeEncryption() {
    if (!ENCRYPTION_KEY) {
        ENCRYPTION_KEY = await generateEncryptionKey();
    }
    return ENCRYPTION_KEY;
}

async function generateEncryptionKey() {
    // Generate a key based on a fixed salt
    const salt = 'SKMT_SECURE_SALT_v1.4';
    const keyMaterial = salt;
    const encoder = new TextEncoder();
    const data = encoder.encode(keyMaterial);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return await crypto.subtle.importKey(
        'raw',
        hashBuffer,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
    );
}

async function encryptData(data) {
    try {
        // Ensure encryption key is initialized
        await initializeEncryption();
        
        // Generate a random IV
        const iv = crypto.getRandomValues(new Uint8Array(12));
        
        // Convert data to string and encode
        const encoder = new TextEncoder();
        const dataBuffer = encoder.encode(JSON.stringify(data));
        
        // Encrypt the data
        const encryptedBuffer = await crypto.subtle.encrypt(
            {
                name: 'AES-GCM',
                iv: iv
            },
            ENCRYPTION_KEY,
            dataBuffer
        );
        
        // Combine IV and encrypted data
        const encryptedArray = new Uint8Array(iv.length + encryptedBuffer.byteLength);
        encryptedArray.set(iv);
        encryptedArray.set(new Uint8Array(encryptedBuffer), iv.length);
        
        // Convert to base64 and add a custom header
        const base64Data = btoa(String.fromCharCode.apply(null, encryptedArray));
        return `SKMT_ENCRYPTED_v${ENCRYPTION_VERSION}_${base64Data}`;
    } catch (error) {
        console.error('Encryption error:', error);
        throw new Error('Failed to encrypt data');
    }
}

async function decryptData(encryptedData) {
    try {
        // Ensure encryption key is initialized
        await initializeEncryption();
        
        // Verify and remove header
        const headerMatch = encryptedData.match(/^SKMT_ENCRYPTED_v(\d+\.\d+)_(.+)$/);
        if (!headerMatch) {
            throw new Error('Invalid encrypted data format');
        }
        
        const version = headerMatch[1];
        if (version !== ENCRYPTION_VERSION) {
            throw new Error('Incompatible encryption version');
        }
        
        const base64Data = headerMatch[2];
        
        // Convert base64 back to array
        const encryptedArray = new Uint8Array(atob(base64Data).split('').map(c => c.charCodeAt(0)));
        
        // Extract IV and encrypted data
        const iv = encryptedArray.slice(0, 12);
        const data = encryptedArray.slice(12);
        
        // Decrypt
        const decryptedBuffer = await crypto.subtle.decrypt(
            {
                name: 'AES-GCM',
                iv: iv
            },
            ENCRYPTION_KEY,
            data
        );
        
        // Convert back to string and parse JSON
        const decoder = new TextDecoder();
        return JSON.parse(decoder.decode(decryptedBuffer));
    } catch (error) {
        console.error('Decryption error:', error);
        throw new Error('Failed to decrypt data');
    }
}

// Function to export stats
async function exportStats() {
    try {
        // Get all stats data
        const modes = ['normal', 'special', 'custom'];
        const keysToFetch = ['currentSkid'];
        
        modes.forEach(mode => {
            keysToFetch.push(getModeKey('matchHistory', currentSkid, mode));
            keysToFetch.push(getModeKey('gamesJoined', currentSkid, mode));
            keysToFetch.push(getModeKey('gamesStarted', currentSkid, mode));
            keysToFetch.push(getModeKey('gamesQuit', currentSkid, mode));
            keysToFetch.push(getModeKey('matchesCompleted', currentSkid, mode));
        });

        const data = await new Promise(resolve => {
            chrome.storage.sync.get(keysToFetch, resolve);
        });

        // Get section states
        const sectionStates = await new Promise(resolve => {
            chrome.storage.local.get(['openSections'], resolve);
        });

        // Calculate streaks and records for each mode
        const statsData = {};
        modes.forEach(mode => {
            const history = data[getModeKey('matchHistory', currentSkid, mode)] || [];
            let smashStreak = 0;
            let smashtacularStreak = 0;
            let smashosaurusStreak = 0;
            let smashlvaniaStreak = 0;
            let monsterSmashStreak = 0;
            let potatoStreak = 0;
            let smashSmashStreak = 0;
            let potoatachioStreak = 0;

            // Initialize quick kills streak counters
            let doubleSmash = 0;
            let multiSmash = 0;
            let multiMegaSmash = 0;
            let multiMegaUltraSmash = 0;
            let gooseySmash = 0;
            let crazyMultiMegaUltraSmash = 0;

            // Initialize records
            let highestKillsRecord = 0;
            let highestDeathsRecord = 0;
            let highestKillStreakRecord = 0;
            let highestKDRRecord = 0;

            history.forEach(match => {
                // Calculate regular streaks
                if (match.kills >= 3) smashStreak++;
                if (match.kills >= 5) smashtacularStreak++;
                if (match.kills >= 7) smashosaurusStreak++;
                if (match.kills >= 10) smashlvaniaStreak++;
                if (match.kills >= 15) monsterSmashStreak++;
                if (match.kills >= 20) potatoStreak++;
                if (match.kills >= 25) smashSmashStreak++;
                if (match.kills >= 30) potoatachioStreak++;

                // Update records
                if (match.kills > highestKillsRecord) highestKillsRecord = match.kills;
                if (match.deaths > highestDeathsRecord) highestDeathsRecord = match.deaths;
                
                // Calculate KDR for this match
                const matchKDR = match.deaths > 0 ? match.kills / match.deaths : match.kills;
                if (matchKDR > highestKDRRecord) highestKDRRecord = matchKDR;

                // Calculate highest kill streak for this match
                if (match.killTimestamps && match.killTimestamps.length > 0) {
                    let currentStreak = 0;
                    let maxStreak = 0;
                    
                    // Create a combined timeline of kills and deaths
                    const timeline = [];
                    if (match.killTimestamps) {
                        match.killTimestamps.forEach(time => timeline.push({ type: 'kill', time }));
                    }
                    if (match.deathTimestamps) {
                        match.deathTimestamps.forEach(time => timeline.push({ type: 'death', time }));
                    }
                    // Sort timeline by timestamp
                    timeline.sort((a, b) => a.time - b.time);

                    // Process events in chronological order
                    timeline.forEach(event => {
                        if (event.type === 'death') {
                            if (currentStreak > maxStreak) maxStreak = currentStreak;
                            currentStreak = 0; // Reset streak on death
                        } else if (event.type === 'kill') {
                            currentStreak++;
                            if (currentStreak > maxStreak) maxStreak = currentStreak;
                        }
                    });
                    if (maxStreak > highestKillStreakRecord) highestKillStreakRecord = maxStreak;
                }

                // Calculate quick kills streaks
                if (match.killTimestamps && match.killTimestamps.length > 0) {
                    let quickKillStreak = 0; // Changed from 1 to 0 to match popup
                    let lastKillTime = match.killTimestamps[0];
                    
                    for (let i = 1; i < match.killTimestamps.length; i++) {
                        const currentKillTime = match.killTimestamps[i];
                        const timeDiff = currentKillTime - lastKillTime;
                        
                        if (timeDiff <= 4000) { // 4 seconds in milliseconds
                            quickKillStreak++;
                            if (quickKillStreak === 2) doubleSmash++;
                            if (quickKillStreak === 3) multiSmash++;
                            if (quickKillStreak === 4) multiMegaSmash++;
                            if (quickKillStreak === 5) multiMegaUltraSmash++;
                            if (quickKillStreak === 6) gooseySmash++;
                            if (quickKillStreak === 7) crazyMultiMegaUltraSmash++;
                        } else {
                            quickKillStreak = 1;
                        }
                        lastKillTime = currentKillTime;
                    }
                }
            });

            statsData[mode] = {
                smashStreak,
                smashtacularStreak,
                smashosaurusStreak,
                smashlvaniaStreak,
                monsterSmashStreak,
                potatoStreak,
                smashSmashStreak,
                potoatachioStreak,
                doubleSmash,
                multiSmash,
                multiMegaSmash,
                multiMegaUltraSmash,
                gooseySmash,
                crazyMultiMegaUltraSmash,
                highestKillsRecord,
                highestDeathsRecord,
                highestKillStreakRecord,
                highestKDRRecord
            };
        });

        // Add streaks and records data to the export
        data.stats = statsData;

        // Add UI state data
        data.uiState = {
            currentMode: currentMode,
            openSections: sectionStates.openSections || {},
            skid: currentSkid
        };

        // Add metadata
        const exportData = {
            version: ENCRYPTION_VERSION,
            timestamp: Date.now(),
            skid: currentSkid,
            data: data
        };

        // Encrypt the data
        const encryptedData = await encryptData(exportData);
        
        // Create blob and download
        const blob = new Blob([encryptedData], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `smash_karts_stats_${currentSkid}_${new Date().toISOString().split('T')[0]}.skmt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (error) {
        console.error('Error exporting stats:', error);
        alert('Failed to export stats. Please try again.');
    }
}

// Function to import stats
async function importStats(file) {
    try {
        const reader = new FileReader();
        
        reader.onload = async function(e) {
            try {
                // Read the encrypted data
                const encryptedData = new TextDecoder().decode(e.target.result);
                
                // Decrypt the data
                const importData = await decryptData(encryptedData);

                // Verify SKID match
                if (importData.skid !== currentSkid) {
                    throw new Error('Stats file SKID does not match current SKID');
                }

                // Verify timestamp (optional: prevent importing very old files)
                const maxAge = 365 * 24 * 60 * 60 * 1000; // 1 year in milliseconds
                if (Date.now() - importData.timestamp > maxAge) {
                    throw new Error('Stats file is too old');
                }

                // Confirm import
                if (!confirm('Are you sure you want to import these stats? This will overwrite your current stats.')) {
                    return;
                }

                // Import the data
                await new Promise(resolve => {
                    chrome.storage.sync.set(importData.data, resolve);
                });

                // Import UI state if available
                if (importData.data.uiState) {
                    const uiState = importData.data.uiState;
                    
                    // Set current mode
                    if (uiState.currentMode) {
                        currentMode = uiState.currentMode;
                        document.querySelectorAll('.mode-btn').forEach(btn => {
                            btn.classList.toggle('active', btn.dataset.mode === currentMode);
                        });
                    }

                    // Set section states
                    if (uiState.openSections) {
                        await new Promise(resolve => {
                            chrome.storage.local.set({ openSections: uiState.openSections }, resolve);
                        });
                    }
                }

                // Reload stats
                loadStats();
                alert('Stats imported successfully!');
            } catch (error) {
                console.error('Error processing imported stats:', error);
                alert(error.message || 'Failed to import stats. The file may be corrupted or invalid.');
            }
        };

        reader.onerror = function() {
            alert('Error reading file. Please try again.');
        };

        reader.readAsArrayBuffer(file);
    } catch (error) {
        console.error('Error importing stats:', error);
        alert('Failed to import stats. Please try again.');
    }
}

// Add function to save section states
function saveSectionStates() {
    const sections = document.querySelectorAll('.stats-details');
    sections.forEach(section => {
        const id = section.querySelector('.stats-section-label').id;
        openSections[id] = section.hasAttribute('open');
    });
    chrome.storage.local.set({ openSections });
}

// Add function to restore section states
function restoreSectionStates() {
    chrome.storage.local.get(['openSections'], (result) => {
        if (result.openSections) {
            openSections = result.openSections;
            Object.entries(openSections).forEach(([id, isOpen]) => {
                const section = document.querySelector(`.stats-details:has(#${id})`);
                if (section) {
                    if (isOpen) {
                        section.setAttribute('open', '');
                    } else {
                        section.removeAttribute('open');
                    }
                }
            });
        }
    });
}

function openMatchInfo(match) {
    // Populate modal body
    const modal = document.getElementById('matchInfoModal');
    const body = document.getElementById('match-info-modal-body');
    let indicators = [];
    if (match.joined) indicators.push('Joined');
    if (match.started) indicators.push('Started');
    if (match.quit) indicators.push('Quit');
    else indicators.push('Completed');
    if (match.isSpecialMode) indicators.push('Special Mode');
    if (match.isCustomMode) indicators.push('Custom Match');
    if (match.mode) indicators.push(`${match.mode.charAt(0).toUpperCase() + match.mode.slice(1)} Mode`);

    // Calculate duration from match start and end times
    const duration = match.duration || (match.matchEndTime && match.matchStartTime ? match.matchEndTime - match.matchStartTime : 0);

    // Calculate highest kill streak and streaks without dying
    let highestKillStreak = 0;
    let streaksWithoutDying = {
        smashStreak: 0,
        smashtacularStreak: 0,
        smashosaurusStreak: 0,
        smashlvaniaStreak: 0,
        monsterSmashStreak: 0,
        potatoStreak: 0,
        smashSmashStreak: 0,
        potoatachioStreak: 0
    };
    let quickKillsStreaks = {
        doubleSmash: 0,
        multiSmash: 0,
        multiMegaSmash: 0,
        multiMegaUltraSmash: 0,
        gooseySmash: 0,
        crazyMultiMegaUltraSmash: 0
    };

    if (match.killTimestamps && match.killTimestamps.length > 0) {
        let currentStreak = 0;
        let maxStreak = 0;
        let quickKillStreak = 0;
        let lastKillTime = null;
        let achievedMilestones = {};
        
        // Create a combined timeline of kills and deaths
        const timeline = [];
        if (match.killTimestamps) {
            match.killTimestamps.forEach(time => timeline.push({ type: 'kill', time }));
        }
        if (match.deathTimestamps) {
            match.deathTimestamps.forEach(time => timeline.push({ type: 'death', time }));
        }
        // Sort timeline by timestamp
        timeline.sort((a, b) => a.time - b.time);

        // Process events in chronological order
        timeline.forEach(event => {
            if (event.type === 'death') {
                if (currentStreak > maxStreak) maxStreak = currentStreak;
                currentStreak = 0; // Reset streak on death
                achievedMilestones = {}; // Reset achieved milestones
                quickKillStreak = 0; // Reset quick kill streak on death
                lastKillTime = null; // Reset last kill time on death
            } else if (event.type === 'kill') {
                currentStreak++;
                if (currentStreak > maxStreak) maxStreak = currentStreak;

                // Check for streaks without dying
                if (currentStreak >= 3 && !achievedMilestones[3]) { streaksWithoutDying.smashStreak++; achievedMilestones[3] = true; }
                if (currentStreak >= 5 && !achievedMilestones[5]) { streaksWithoutDying.smashtacularStreak++; achievedMilestones[5] = true; }
                if (currentStreak >= 7 && !achievedMilestones[7]) { streaksWithoutDying.smashosaurusStreak++; achievedMilestones[7] = true; }
                if (currentStreak >= 10 && !achievedMilestones[10]) { streaksWithoutDying.smashlvaniaStreak++; achievedMilestones[10] = true; }
                if (currentStreak >= 15 && !achievedMilestones[15]) { streaksWithoutDying.monsterSmashStreak++; achievedMilestones[15] = true; }
                if (currentStreak >= 20 && !achievedMilestones[20]) { streaksWithoutDying.potatoStreak++; achievedMilestones[20] = true; }
                if (currentStreak >= 25 && !achievedMilestones[25]) { streaksWithoutDying.smashSmashStreak++; achievedMilestones[25] = true; }
                if (currentStreak >= 30 && !achievedMilestones[30]) { streaksWithoutDying.potoatachioStreak++; achievedMilestones[30] = true; }

                // Check for quick kills streaks
                if (lastKillTime === null) {
                    // First kill after death
                    quickKillStreak = 1;
                    lastKillTime = event.time;
                } else {
                    const timeSinceLastKill = event.time - lastKillTime;
                    if (timeSinceLastKill <= 4000) {
                        // Kill within 4 seconds of last kill - INCREASE STREAK
                        quickKillStreak++;
                        if (quickKillStreak === 2) quickKillsStreaks.doubleSmash++;
                        if (quickKillStreak === 3) quickKillsStreaks.multiSmash++;
                        if (quickKillStreak === 4) quickKillsStreaks.multiMegaSmash++;
                        if (quickKillStreak === 5) quickKillsStreaks.multiMegaUltraSmash++;
                        if (quickKillStreak === 6) quickKillsStreaks.gooseySmash++;
                        if (quickKillStreak === 7) quickKillsStreaks.crazyMultiMegaUltraSmash++;
                    } else {
                        // Kill after more than 4 seconds - RESET STREAK
                        quickKillStreak = 1;
                    }
                    lastKillTime = event.time;
                }
            }
        });
        highestKillStreak = maxStreak;
    }

    // Get players from match data
    let detectedPlayers = [];
    if (Array.isArray(match.players)) {
        detectedPlayers = [...new Set(match.players)];
    }

    body.innerHTML = `
        <div class="match-info-title">Match Information</div>
        ${match.map ? `<div class="match-info-section"><span class="match-info-label">Map:</span><span class="match-info-value">${match.map}</span></div>` : ''}
        <div class="match-info-section"><span class="match-info-label">Start:</span><span class="match-info-value">${formatDateTime(match.matchStartTime)}</span></div>
        <div class="match-info-section"><span class="match-info-label">End:</span><span class="match-info-value">${formatDateTime(match.matchEndTime)}</span></div>
        <div class="match-info-section"><span class="match-info-label">Kills:</span><span class="match-info-value">${match.kills}</span></div>
        <div class="match-info-section"><span class="match-info-label">Deaths:</span><span class="match-info-value">${match.deaths}</span></div>
        <div class="match-info-section"><span class="match-info-label">KDR:</span><span class="match-info-value">${formatKDR(match.kills, match.deaths)}</span></div>
        <div class="match-info-section"><span class="match-info-label">Duration:</span><span class="match-info-value">${formatTimeSpent(duration)}</span></div>
        <div class="match-info-section"><span class="match-info-label">Highest Kill Streak:</span><span class="match-info-value">${highestKillStreak}</span></div>
        
        ${Object.values(streaksWithoutDying).some(v => v > 0) ? `
        <div class="match-info-section">
            <span class="match-info-label" style="display:block;margin-bottom:6px;">Streaks (Without Dying):</span>
            <ul style="margin:0 0 0 12px;padding:0;list-style:disc;">
                ${streaksWithoutDying.smashStreak > 0 ? `<li style='font-size:16px;'>Smash Streak (3): ${streaksWithoutDying.smashStreak}</li>` : ''}
                ${streaksWithoutDying.smashtacularStreak > 0 ? `<li style='font-size:16px;'>Smashtacular Streak (5): ${streaksWithoutDying.smashtacularStreak}</li>` : ''}
                ${streaksWithoutDying.smashosaurusStreak > 0 ? `<li style='font-size:16px;'>Smashosaurus Streak (7): ${streaksWithoutDying.smashosaurusStreak}</li>` : ''}
                ${streaksWithoutDying.smashlvaniaStreak > 0 ? `<li style='font-size:16px;'>Smashlvania Streak (10): ${streaksWithoutDying.smashlvaniaStreak}</li>` : ''}
                ${streaksWithoutDying.monsterSmashStreak > 0 ? `<li style='font-size:16px;'>Monster Smash Streak (15): ${streaksWithoutDying.monsterSmashStreak}</li>` : ''}
                ${streaksWithoutDying.potatoStreak > 0 ? `<li style='font-size:16px;'>Potato Streak (20): ${streaksWithoutDying.potatoStreak}</li>` : ''}
                ${streaksWithoutDying.smashSmashStreak > 0 ? `<li style='font-size:16px;'>Smash Smash Streak (25): ${streaksWithoutDying.smashSmashStreak}</li>` : ''}
                ${streaksWithoutDying.potoatachioStreak > 0 ? `<li style='font-size:16px;'>Potoatachio Streak (30): ${streaksWithoutDying.potoatachioStreak}</li>` : ''}
            </ul>
        </div>
        ` : ''}

        ${Object.values(quickKillsStreaks).some(v => v > 0) ? `
        <div class="match-info-section">
            <span class="match-info-label" style="display:block;margin-bottom:6px;">Streaks (Quick Kills):</span>
            <ul style="margin:0 0 0 12px;padding:0;list-style:disc;">
                ${quickKillsStreaks.doubleSmash > 0 ? `<li style='font-size:16px;'>Double Smash (2): ${quickKillsStreaks.doubleSmash}</li>` : ''}
                ${quickKillsStreaks.multiSmash > 0 ? `<li style='font-size:16px;'>Multi Smash (3): ${quickKillsStreaks.multiSmash}</li>` : ''}
                ${quickKillsStreaks.multiMegaSmash > 0 ? `<li style='font-size:16px;'>Multi Mega Smash (4): ${quickKillsStreaks.multiMegaSmash}</li>` : ''}
                ${quickKillsStreaks.multiMegaUltraSmash > 0 ? `<li style='font-size:16px;'>Multi Mega Ultra Smash (5): ${quickKillsStreaks.multiMegaUltraSmash}</li>` : ''}
                ${quickKillsStreaks.gooseySmash > 0 ? `<li style='font-size:16px;'>Goosey Smash (6): ${quickKillsStreaks.gooseySmash}</li>` : ''}
                ${quickKillsStreaks.crazyMultiMegaUltraSmash > 0 ? `<li style='font-size:16px;'>Crazy Multi Mega Ultra Smash (7): ${quickKillsStreaks.crazyMultiMegaUltraSmash}</li>` : ''}
            </ul>
        </div>
        ` : ''}

        <div class="match-info-section">
            <span class="match-info-label" style="display:block;margin-bottom:6px;">Detected Players In Room:</span>
            <ul style="margin:0 0 0 12px;padding:0;list-style:disc;">
                ${detectedPlayers.length > 0 ? detectedPlayers.map(p => `<li style='font-size:16px;'>${p}</li>`).join('') : '<li style="color:#aaa;font-size:16px;">No players detected</li>'}
            </ul>
        </div>
        <div class="match-info-indicators">${indicators.join(' | ')}</div>
    `;
    modal.style.display = 'flex';
}

// Modal close handler
if (document.getElementById('closeMatchInfoModal')) {
    document.getElementById('closeMatchInfoModal').onclick = function() {
        document.getElementById('matchInfoModal').style.display = 'none';
    };
}
// Optional: close modal when clicking outside content
if (document.getElementById('matchInfoModal')) {
    document.getElementById('matchInfoModal').onclick = function(e) {
        if (e.target === this) this.style.display = 'none';
    };
}

// HUD Settings functionality
let currentHudType = null; // 'deaths' or 'killstreak'

// Settings buttons
document.getElementById('deathsHudSettings').addEventListener('click', () => {
    currentHudType = 'deaths';
    openHudSettings();
});

document.getElementById('killStreakHudSettings').addEventListener('click', () => {
    currentHudType = 'killstreak';
    openHudSettings();
});

document.getElementById('kdrHudSettings').addEventListener('click', () => {
    currentHudType = 'kdr';
    openHudSettings();
});

// Close HUD settings modal
document.getElementById('closeHudSettingsModal').addEventListener('click', () => {
    document.getElementById('hudSettingsModal').style.display = 'none';
});

// Close modal when clicking outside
document.getElementById('hudSettingsModal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('hudSettingsModal')) {
        document.getElementById('hudSettingsModal').style.display = 'none';
    }
});

function openHudSettings() {
    const modal = document.getElementById('hudSettingsModal');
    const title = document.getElementById('hudSettingsTitle');
    let hudName = '';
    switch(currentHudType) {
        case 'deaths':
            hudName = 'Deaths';
            break;
        case 'killstreak':
            hudName = 'Kill Streak';
            break;
        case 'kdr':
            hudName = 'KDR';
            break;
    }
    title.textContent = `${hudName} HUD Settings`;
    
    // Load current settings
    const storageKey = `${currentHudType}HudSettings`;
    chrome.storage.sync.get([storageKey], (result) => {
        const settings = result[storageKey] || {
            fontSize: 32,
            fontColor: '#ffffff',
            fontFamily: 'Arial, sans-serif',
            backgroundColor: 'rgba(0, 0, 0, 0.5)'
        };
        
        document.getElementById('hudFontSize').value = settings.fontSize;
        document.getElementById('fontSizeValue').textContent = `${settings.fontSize}px`;
        document.getElementById('hudFontColor').value = settings.fontColor;
        document.getElementById('hudFontFamily').value = settings.fontFamily;
        document.getElementById('hudBackgroundColor').value = settings.backgroundColor ? rgbaToHex(settings.backgroundColor) : '#000000';
    });
    
    modal.style.display = 'flex';
}

// Font size slider
document.getElementById('hudFontSize').addEventListener('input', (e) => {
    const size = e.target.value;
    document.getElementById('fontSizeValue').textContent = `${size}px`;
    updateHudSettings();
});

// Font color select
document.getElementById('hudFontColor').addEventListener('change', updateHudSettings);

// Font family select
document.getElementById('hudFontFamily').addEventListener('change', updateHudSettings);

// Background color input
document.getElementById('hudBackgroundColor').addEventListener('input', updateHudSettings);

function updateHudSettings() {
    const settings = {
        fontSize: document.getElementById('hudFontSize').value,
        fontColor: document.getElementById('hudFontColor').value,
        fontFamily: document.getElementById('hudFontFamily').value,
        backgroundColor: hexToRgba(document.getElementById('hudBackgroundColor').value, 0.5) // Assuming 50% transparency for now
    };
    
    const storageKey = `${currentHudType}HudSettings`;
    chrome.storage.sync.set({ [storageKey]: settings });
    
    // Send update to content script
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
        let messageType;
        switch(currentHudType) {
            case 'deaths':
                messageType = 'update-deaths-hud-style';
                break;
            case 'killstreak':
                messageType = 'update-killstreak-hud-style';
                break;
            case 'kdr':
                messageType = 'update-kdr-hud-style';
                break;
        }
        chrome.tabs.sendMessage(tabs[0].id, {
            type: messageType,
            settings: settings
        });
    });
}

// Helper function to convert hex to rgba
function hexToRgba(hex, alpha) {
    const bigint = parseInt(hex.slice(1), 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Helper function to convert rgba to hex (simplified, ignores alpha)
function rgbaToHex(rgba) {
    const parts = rgba.substring(rgba.indexOf('(') + 1, rgba.indexOf(')')).split(',');
    const r = parseInt(parts[0].trim());
    const g = parseInt(parts[1].trim());
    const b = parseInt(parts[2].trim());
    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase()}`;
}

// Add favorites storage (using chrome.storage.sync)
let favoriteMatches = {}; // Initialize as empty, load from storage

async function saveFavoriteMatches() {
    // We need to save the whole favoriteMatches object under a key
    // Let's use a key that includes the current SKID for segregation
    const skid = currentSkid || 'Default';
    const key = `favoriteMatches_${skid}`;
    await new Promise(resolve => chrome.storage.sync.set({ [key]: favoriteMatches }, resolve));
    console.log('[SKMT][POPUP] Saved favorite matches to storage.', favoriteMatches);
}

function renderMatches(matches, mode) {
    const matchesList = document.getElementById('matches-list');
    matchesList.innerHTML = '';
    matches.forEach((m, idx) => {
        const card = document.createElement('div');
        card.className = 'match-card';

        // Content container for meta, stats, flags
        const content = document.createElement('div');
        content.className = 'match-card-content';

        // Meta info
        const meta = document.createElement('div');
        meta.className = 'match-meta';
        meta.textContent = `#${matches.length - idx} | ${formatDateTime(m.matchStartTime)} - ${formatDateTime(m.matchEndTime)}`;
        content.appendChild(meta);

        // Map info
        if (m.map) {
            const mapInfo = document.createElement('div');
            mapInfo.className = 'match-map';
            mapInfo.textContent = m.map;
            content.appendChild(mapInfo);
        }

        // Stats
        const stats = document.createElement('div');
        stats.className = 'match-stats';
        stats.innerHTML = '';
        stats.innerHTML += `<span>Kills:</span><b>${m.kills}</b>`;
        stats.innerHTML += `<span>Deaths:</span><b>${m.deaths}</b>`;
        stats.innerHTML += `<span>KDR:</span><b>${formatKDR(m.kills, m.deaths)}</b>`;
        // Add match duration
        const duration = m.duration || (m.matchEndTime && m.matchStartTime ? m.matchEndTime - m.matchStartTime : 0);
        const hours = Math.floor(duration / 3600000);
        const minutes = Math.floor((duration % 3600000) / 60000);
        const seconds = Math.floor((duration % 60000) / 1000);
        let durationText;
        if (hours > 0) {
            durationText = `${hours}h ${minutes}m ${seconds}s`;
        } else {
            durationText = `${minutes}m ${seconds}s`;
        }
        stats.innerHTML += `<span>Duration:</span><b>${durationText}</b>`;
        content.appendChild(stats);

        // Flags
        const flags = document.createElement('div');
        flags.className = 'match-flags';
        let flagText = [];
        if (m.joined) flagText.push('Joined');
        if (m.started) flagText.push('Started');
        if (m.quit) {
            flagText.push('Quit');
        } else { // Only add completed if not quit
            flagText.push('Completed');
        }
        if (m.isSpecialMode) flagText.push('Special Mode');
        if (m.isCustomMode) flagText.push('Custom Match');
        if (m.mode) flagText.push(`${m.mode.charAt(0).toUpperCase() + m.mode.slice(1)} Mode`);
        if (flagText.length > 0) flags.textContent = flagText.join(' | ');
        content.appendChild(flags);

        // Star (favorite) button
        const starBtn = document.createElement('button');
        starBtn.className = 'star-btn';
        starBtn.title = 'Favorite this match';
        // Use the favorite state from the match object (loaded from chrome.storage.sync)
        starBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><polygon points="10,2 12.59,7.36 18.51,8.09 14,12.26 15.18,18.09 10,15.27 4.82,18.09 6,12.26 1.49,8.09 7.41,7.36" stroke="#FFD700" stroke-width="1.5" fill="' + (m.favorite ? '#FFD700' : 'white') + '"/></svg>';
        starBtn.style.background = 'none';
        starBtn.style.border = 'none';
        starBtn.style.cursor = 'pointer';
        starBtn.style.marginRight = '4px';
        starBtn.onclick = async () => {
            // Toggle the favorite state on the match object
            m.favorite = !m.favorite;
            
            // Update the fill of the star icon immediately
            starBtn.querySelector('polygon').setAttribute('fill', m.favorite ? '#FFD700' : 'white');

            // Update the global favoriteMatches object (optional, but keeps state consistent)
            if (m.favorite) {
                favoriteMatches[m.matchStartTime] = true;
            } else {
                delete favoriteMatches[m.matchStartTime];
            }

            // Save the updated favorite state to storage
            await saveFavoriteMatches();
            
            // No need to re-render all matches just to update the star, but needed if sorting by favorites is active
            // check if favorites sort is active
            const sortValue = document.getElementById('matchSortSelect') ? document.getElementById('matchSortSelect').value : 'recent';
            if (sortValue === 'favorites') {
                 loadStats(); // Reloads and re-renders
            } else {
                // Just update the single star icon visually, already done above
            }
        };

        // Info icon button
        const infoBtn = document.createElement('button');
        infoBtn.className = 'info-btn';
        infoBtn.title = 'View match information';
        infoBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="10" cy="10" r="9" stroke="#3498db" stroke-width="2" fill="white"/><rect x="9" y="8" width="2" height="6" rx="1" fill="#3498db"/><rect x="9" y="5" width="2" height="2" rx="1" fill="#3498db"/></svg>';
        infoBtn.onclick = () => openMatchInfo(m);

        card.appendChild(content);
        card.appendChild(starBtn);
        card.appendChild(infoBtn);
        matchesList.appendChild(card);
    });
}

// Add event listener for match sort select
if (document.getElementById('matchSortSelect')) {
    document.getElementById('matchSortSelect').addEventListener('change', function(e) {
        loadStats();
    });
} 

// Add this to ensure stats are loaded when popup opens
document.addEventListener('DOMContentLoaded', () => {
    console.log('[SKMT][POPUP] Loading initial stats');
    loadStats();
});