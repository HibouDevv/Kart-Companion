// Overhauled popup.js for simple stats and match history

const killsElement = document.getElementById('kills');
const deathsElement = document.getElementById('deaths');
const matchesElement = document.getElementById('matches');
const matchesList = document.getElementById('matches-list');

// Section switching functionality
const statsBtn = document.getElementById('statsBtn');
const hudBtn = document.getElementById('hudBtn');
const statsSection = document.getElementById('statsSection');

// Initialize sections
statsSection.classList.add('active');

// Handle section switching
statsBtn.addEventListener('click', () => {
    statsBtn.classList.add('selected');
    hudBtn.classList.remove('selected');
    statsSection.classList.add('active');
});

hudBtn.addEventListener('click', () => {
    hudBtn.classList.add('selected');
    statsBtn.classList.remove('selected');
    statsSection.classList.remove('active');
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

let currentSkid = null;
let currentMode = 'normal'; // 'normal', 'special', or 'custom', or 'all'

// Add state for tracking open sections
let openSections = {
    primaryStats: false,
    secondaryStats: false,
    averageStats: false,
    streaks: false,
    quickKills: false
};

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
}

function displayStats(data, mode) {
    const history = data[getModeKey('matchHistory', currentSkid, mode)] || [];
    let totalKills = 0, totalDeaths = 0, totalTimeSpent = 0;

    let gamesJoined = 0;
    let gamesStarted = 0;
    let gamesQuit = 0;
    let matchesCompleted = 0;

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

    if (mode === 'all') {
        // Calculate stats for each mode first
        const modes = ['normal', 'special', 'custom'];
        const modeStats = {};

        // Calculate stats for each individual mode
        modes.forEach(mode => {
            const modeHistory = data[getModeKey('matchHistory', currentSkid, mode)] || [];
            let modeKills = 0;
            let modeDeaths = 0;
            let modeTimeSpent = 0;
            let modeGamesJoined = data[getModeKey('gamesJoined', currentSkid, mode)] || 0;
            let modeGamesStarted = data[getModeKey('gamesStarted', currentSkid, mode)] || 0;
            let modeGamesQuit = data[getModeKey('gamesQuit', currentSkid, mode)] || 0;
            let modeMatchesCompleted = data[getModeKey('matchesCompleted', currentSkid, mode)] || 0;
            let modeSmashStreak = 0;
            let modeSmashtacularStreak = 0;
            let modeSmashosaurusStreak = 0;
            let modeSmashlvaniaStreak = 0;
            let modeMonsterSmashStreak = 0;
            let modePotatoStreak = 0;
            let modeSmashSmashStreak = 0;
            let modePotoatachioStreak = 0;

            // Initialize quick kills streak counters for this mode
            let modeDoubleSmash = 0;
            let modeMultiSmash = 0;
            let modeMultiMegaSmash = 0;
            let modeMultiMegaUltraSmash = 0;
            let modeGooseySmash = 0;
            let modeCrazyMultiMegaUltraSmash = 0;

            // Calculate kills, deaths, and time spent
            modeHistory.forEach(m => {
                modeKills += m.kills || 0;
                modeDeaths += m.deaths || 0;
                modeTimeSpent += m.playerStats?.timeSpent || (m.endTime && m.startTime ? m.endTime - m.startTime : 0);
            });

            // Calculate streaks for this mode
            modeHistory.forEach(match => {
                let currentStreak = 0;
                let lastKillTime = null;
                let quickKillStreak = 0;
                let achievedMilestones = {}; // Track milestones achieved in the current life for without dying streaks

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
                        currentStreak = 0; // Reset streak immediately on death
                        achievedMilestones = {}; // Reset achieved milestones for the new life
                    } else if (event.type === 'kill') {
                        currentStreak++;
                        // Check for streak milestones only once per life
                        if (currentStreak >= 3 && !achievedMilestones[3]) {
                            modeSmashStreak++;
                            achievedMilestones[3] = true;
                        }
                        if (currentStreak >= 5 && !achievedMilestones[5]) {
                            modeSmashtacularStreak++;
                            achievedMilestones[5] = true;
                        }
                        if (currentStreak >= 7 && !achievedMilestones[7]) {
                            modeSmashosaurusStreak++;
                            achievedMilestones[7] = true;
                        }
                        if (currentStreak >= 10 && !achievedMilestones[10]) {
                            modeSmashlvaniaStreak++;
                            achievedMilestones[10] = true;
                        }
                        if (currentStreak >= 15 && !achievedMilestones[15]) {
                            modeMonsterSmashStreak++;
                            achievedMilestones[15] = true;
                        }
                        if (currentStreak >= 20 && !achievedMilestones[20]) {
                            modePotatoStreak++;
                            achievedMilestones[20] = true;
                        }
                        if (currentStreak >= 25 && !achievedMilestones[25]) {
                            modeSmashSmashStreak++;
                            achievedMilestones[25] = true;
                        }
                        if (currentStreak >= 30 && !achievedMilestones[30]) {
                            modePotoatachioStreak++;
                            achievedMilestones[30] = true;
                        }

                        // Handle quick kills streak
                        if (lastKillTime && (event.time - lastKillTime) <= 3000) {
                            quickKillStreak++;
                            if (quickKillStreak === 2) modeDoubleSmash++;
                            if (quickKillStreak === 3) modeMultiSmash++;
                            if (quickKillStreak === 4) modeMultiMegaSmash++;
                            if (quickKillStreak === 5) modeMultiMegaUltraSmash++;
                            if (quickKillStreak === 6) modeGooseySmash++;
                            if (quickKillStreak === 7) modeCrazyMultiMegaUltraSmash++;
                        } else {
                            quickKillStreak = 1;
                        }
                        lastKillTime = event.time;
                    }
                });
            });

            // Store mode stats
            modeStats[mode] = {
                kills: modeKills,
                deaths: modeDeaths,
                timeSpent: modeTimeSpent,
                gamesJoined: modeGamesJoined,
                gamesStarted: modeGamesStarted,
                gamesQuit: modeGamesQuit,
                matchesCompleted: modeMatchesCompleted,
                smashStreak: modeSmashStreak,
                smashtacularStreak: modeSmashtacularStreak,
                smashosaurusStreak: modeSmashosaurusStreak,
                smashlvaniaStreak: modeSmashlvaniaStreak,
                monsterSmashStreak: modeMonsterSmashStreak,
                potatoStreak: modePotatoStreak,
                smashSmashStreak: modeSmashSmashStreak,
                potoatachioStreak: modePotoatachioStreak,
                doubleSmash: modeDoubleSmash,
                multiSmash: modeMultiSmash,
                multiMegaSmash: modeMultiMegaSmash,
                multiMegaUltraSmash: modeMultiMegaUltraSmash,
                gooseySmash: modeGooseySmash,
                crazyMultiMegaUltraSmash: modeCrazyMultiMegaUltraSmash
            };
        });

        // Sum up all mode stats
        modes.forEach(mode => {
            const stats = modeStats[mode];
            totalKills += stats.kills;
            totalDeaths += stats.deaths;
            totalTimeSpent += stats.timeSpent;
            gamesJoined += stats.gamesJoined;
            gamesStarted += stats.gamesStarted;
            gamesQuit += stats.gamesQuit;
            matchesCompleted += stats.matchesCompleted;
            smashStreak += stats.smashStreak;
            smashtacularStreak += stats.smashtacularStreak;
            smashosaurusStreak += stats.smashosaurusStreak;
            smashlvaniaStreak += stats.smashlvaniaStreak;
            monsterSmashStreak += stats.monsterSmashStreak;
            potatoStreak += stats.potatoStreak;
            smashSmashStreak += stats.smashSmashStreak;
            potoatachioStreak += stats.potoatachioStreak;
            doubleSmash += stats.doubleSmash;
            multiSmash += stats.multiSmash;
            multiMegaSmash += stats.multiMegaSmash;
            multiMegaUltraSmash += stats.multiMegaUltraSmash;
            gooseySmash += stats.gooseySmash;
            crazyMultiMegaUltraSmash += stats.crazyMultiMegaUltraSmash;
        });
    } else {
        // Individual modes
        history.forEach(m => {
            totalKills += m.kills || 0;
            totalDeaths += m.deaths || 0;
            totalTimeSpent += m.playerStats?.timeSpent || (m.endTime && m.startTime ? m.endTime - m.startTime : 0);
        });

        // Access secondary stats using getModeKey for individual modes
        gamesJoined = data[getModeKey('gamesJoined', currentSkid, mode)] || 0;
        gamesStarted = data[getModeKey('gamesStarted', currentSkid, mode)] || 0;
        gamesQuit = data[getModeKey('gamesQuit', currentSkid, mode)] || 0;
        matchesCompleted = data[getModeKey('matchesCompleted', currentSkid, mode)] || 0;

        // Calculate streaks for individual mode
        history.forEach(match => {
            let currentStreak = 0;
            let lastKillTime = null;
            let quickKillStreak = 0;
            let achievedMilestones = {}; // Track milestones achieved in the current life for without dying streaks

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
                    currentStreak = 0; // Reset streak immediately on death
                    achievedMilestones = {}; // Reset achieved milestones for the new life
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
                    if (lastKillTime && (event.time - lastKillTime) <= 3000) {
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
                    lastKillTime = event.time;
                }
            });
        });
    }

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
    const avgKills = totalMatches > 0 ? totalKills / totalMatches : 0;
    const avgDeaths = totalMatches > 0 ? totalDeaths / totalMatches : 0;
    const avgTimeSpent = totalMatches > 0 ? totalTimeSpent / totalMatches : 0;

    document.getElementById('avgKills').textContent = avgKills.toFixed(2);
    document.getElementById('avgDeaths').textContent = avgDeaths.toFixed(2);
    document.getElementById('avgTimeSpent').textContent = formatTimeSpent(avgTimeSpent);

    // Update average stats header label
    document.getElementById('averageStatsHeader').textContent = mode === 'all' ? 'All Modes Average Stats' : 'Average Stats';

    // Render match history only for individual modes
    const matchesList = document.getElementById('matches-list');
    matchesList.innerHTML = '';
    
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

        // Sort by match start time, newest first
        allHistory.sort((a, b) => {
            const timeA = a.matchStartTime || a.startTime || 0;
            const timeB = b.matchStartTime || b.startTime || 0;
            return timeB - timeA;
        });

        // Display combined history
        allHistory.forEach((m, idx) => {
            const card = document.createElement('div');
            card.className = 'match-card';

            // Content container for meta, stats, flags
            const content = document.createElement('div');
            content.className = 'match-card-content';

            // Meta info
            const meta = document.createElement('div');
            meta.className = 'match-meta';
            meta.textContent = `#${allHistory.length - idx} | ${formatDateTime(m.matchStartTime)} - ${formatDateTime(m.matchEndTime)}`;
            content.appendChild(meta);

            // Stats
            const stats = document.createElement('div');
            stats.className = 'match-stats';
            stats.innerHTML = '';
            stats.innerHTML += `<span>Kills:</span><b>${m.kills}</b>`;
            stats.innerHTML += `<span>Deaths:</span><b>${m.deaths}</b>`;
            stats.innerHTML += `<span>KDR:</span><b>${formatKDR(m.kills, m.deaths)}</b>`;
            // Add match duration
            const duration = m.playerStats?.timeSpent || (m.endTime && m.startTime ? m.endTime - m.startTime : 0);
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
            // Add mode information
            flagText.push(`${m.mode.charAt(0).toUpperCase() + m.mode.slice(1)} Mode`);
            if (flagText.length > 0) flags.textContent = flagText.join(' | ');
            content.appendChild(flags);

            // Trash icon button
            const trashBtn = document.createElement('button');
            trashBtn.className = 'trash-btn';
            trashBtn.title = 'Delete this match';
            trashBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6 8V15M10 8V15M14 8V15M3 5H17M8 5V3H12V5M5 5V17C5 17.5523 5.44772 18 6 18H14C14.5523 18 15 17.5523 15 17V5" stroke="#e74c3c" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
            trashBtn.onclick = () => deleteMatch(allHistory.length - 1 - idx, m.mode);

            card.appendChild(content);
            card.appendChild(trashBtn);
            matchesList.appendChild(card);
        });
    } else {
        // Individual mode history display (existing code)
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
            stats.innerHTML = '';
            stats.innerHTML += `<span>Kills:</span><b>${m.kills}</b>`;
            stats.innerHTML += `<span>Deaths:</span><b>${m.deaths}</b>`;
            stats.innerHTML += `<span>KDR:</span><b>${formatKDR(m.kills, m.deaths)}</b>`;
            // Add match duration
            const duration = m.playerStats?.timeSpent || (m.endTime && m.startTime ? m.endTime - m.startTime : 0);
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
    }
}

function loadStats() {
    chrome.storage.sync.get(['currentSkid'], (skidData) => {
        currentSkid = skidData.currentSkid || 'Default';
        document.getElementById('skidValue').textContent = currentSkid;

        const keysToFetch = ['currentSkid']; // Always fetch currentSkid
        const modes = ['normal', 'special', 'custom'];

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

            // Show match history section for both all and individual modes
            document.querySelector('.match-history').style.display = 'block';

            // Pass the data directly to displayStats for both all and individual modes
            displayStats(data, currentMode);
        });
    });
}

function deleteMatch(index, mode) {
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
        updateModeSelector();
        loadStats();
    });

    updateModeSelector();
    loadStats(); // Load stats for the default mode on startup

    // Add event listeners for section toggles
    document.querySelectorAll('.stats-details').forEach(section => {
        section.addEventListener('toggle', () => {
            saveSectionStates();
        });
    });

    // Restore section states after loading stats
    restoreSectionStates();
    loadStats(); // Load stats for the default mode on startup
});

chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync' && currentSkid) {
        // Only reload if the change is relevant to the current skid
        const skidRelevant = Object.keys(changes).some(key => key.includes(`_${currentSkid}_`));
        if (skidRelevant) {
            loadStats(); // Reload stats for the current mode (or all modes)
        }
    }
});

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

// Listen for messages from the extension runtime
chrome.runtime.onMessage.addListener(
    function(request, sender, sendResponse) {
        if (request.type === 'SKMT_SKID_UPDATED') {
            // When SKID updates, reload stats for the current mode (or all modes)
            loadStats();
        } else if (request.type === 'SKMT_MATCH_COMPLETE') {
             console.log('[SKMT][POPUP] Received MATCH_COMPLETE message:', request.data);
             const match = request.data;
             
             // Determine the mode key based on the match data
             const mode = match.isSpecialMode ? 'special' : (match.isCustomMode ? 'custom' : 'normal');
             const skid = currentSkid || 'Default'; // Use currentSkid from popup
             const matchHistoryKey = getModeKey('matchHistory', skid, mode);
             const gamesJoinedKey = getModeKey('gamesJoined', skid, mode);
             const gamesStartedKey = getModeKey('gamesStarted', skid, mode);
             const gamesQuitKey = getModeKey('gamesQuit', skid, mode);
             const matchesCompletedKey = getModeKey('matchesCompleted', skid, mode);

             chrome.storage.sync.get([matchHistoryKey, gamesJoinedKey, gamesStartedKey, gamesQuitKey, matchesCompletedKey], (data) => {
                 let history = data[matchHistoryKey] || [];
                 let gamesJoined = data[gamesJoinedKey] || 0;
                 let gamesStarted = data[gamesStartedKey] || 0;
                 let gamesQuit = data[gamesQuitKey] || 0;
                 let matchesCompleted = data[matchesCompletedKey] || 0;

                 console.log(`[SKMT][POPUP] Before update - Mode: ${mode}, Games Joined: ${gamesJoined}, Games Started: ${gamesStarted}, Games Quit: ${gamesQuit}, Matches Completed: ${matchesCompleted}`);

                 // Add the new match to history
                 history.push(match);

                 // Update cumulative stats based on the new match
                 if (match.joined) gamesJoined++;
                 if (match.started) gamesStarted++;
                 if (match.quit) gamesQuit++;
                 // A match is considered completed if not quit, regardless of mode
                 if (!match.quit) matchesCompleted++;

                 console.log(`[SKMT][POPUP] After update - Mode: ${mode}, Games Joined: ${gamesJoined}, Games Started: ${gamesStarted}, Games Quit: ${gamesQuit}, Matches Completed: ${matchesCompleted}`);

                 // Save updated data back to storage
                 const setObj = {};
                 setObj[matchHistoryKey] = history;
                 setObj[gamesJoinedKey] = gamesJoined;
                 setObj[gamesStartedKey] = gamesStarted;
                 setObj[gamesQuitKey] = gamesQuit;
                 setObj[matchesCompletedKey] = matchesCompleted;

                 chrome.storage.sync.set(setObj, () => {
                     console.log(`[SKMT][POPUP] Saved match data and updated stats for ${mode} mode.`);
                     // Reload stats in the popup to display the new data
                     loadStats();
                 });
             });
        }
    }
);

// Function to generate a secure hash for the stats data
async function generateStatsHash(data) {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(JSON.stringify(data));
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
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

        // Calculate streaks for each mode
        const streaksData = {};
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

                // Calculate quick kills streaks
                if (match.killTimestamps && match.killTimestamps.length > 0) {
                    let quickKillStreak = 1;
                    let lastKillTime = match.killTimestamps[0];
                    
                    for (let i = 1; i < match.killTimestamps.length; i++) {
                        const currentKillTime = match.killTimestamps[i];
                        const timeDiff = currentKillTime - lastKillTime;
                        
                        if (timeDiff <= 3000) { // 3 seconds in milliseconds
                            quickKillStreak++;
                            if (quickKillStreak === 2) doubleSmash++;
                            if (quickKillStreak === 3) multiSmash++;
                            if (quickKillStreak === 4) multiMegaSmash++;
                            if (quickKillStreak === 5) multiMegaUltraSmash++;
                            if (quickKillStreak === 6) gooseySmash++;
                            if (quickKillStreak === 7) crazyMultiMegaUltraSmash++;
                        } else {
                            quickKillStreak = 1; // Reset streak if more than 3 seconds between kills
                        }
                        lastKillTime = currentKillTime;
                    }
                }
            });

            streaksData[mode] = {
                smashStreak,
                smashtacularStreak,
                smashosaurusStreak,
                smashlvaniaStreak,
                monsterSmashStreak,
                potatoStreak,
                smashSmashStreak,
                potoatachioStreak,
                // Add quick kills streak data
                doubleSmash,
                multiSmash,
                multiMegaSmash,
                multiMegaUltraSmash,
                gooseySmash,
                crazyMultiMegaUltraSmash
            };
        });

        // Add streaks data to the export
        data.streaks = streaksData;

        // Generate hash for security
        const hash = await generateStatsHash(data);

        // Create export object
        const exportData = {
            version: '1.2', // Increment version to indicate new quick kills streak data
            timestamp: Date.now(),
            skid: currentSkid,
            hash: hash,
            data: data
        };

        // Convert to binary format
        const encoder = new TextEncoder();
        const binaryData = encoder.encode(JSON.stringify(exportData));
        
        // Create blob and download
        const blob = new Blob([binaryData], { type: 'application/octet-stream' });
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
                // Decode binary data
                const decoder = new TextDecoder();
                const jsonData = decoder.decode(e.target.result);
                const importData = JSON.parse(jsonData);

                // Verify version
                if (!['1.0', '1.1', '1.2'].includes(importData.version)) {
                    throw new Error('Unsupported stats file version');
                }

                // Verify SKID match
                if (importData.skid !== currentSkid) {
                    throw new Error('Stats file SKID does not match current SKID');
                }

                // Verify hash
                const calculatedHash = await generateStatsHash(importData.data);
                if (calculatedHash !== importData.hash) {
                    throw new Error('Stats file has been tampered with');
                }

                // Confirm import
                if (!confirm('Are you sure you want to import these stats? This will overwrite your current stats.')) {
                    return;
                }

                // Import the data
                await new Promise(resolve => {
                    chrome.storage.sync.set(importData.data, resolve);
                });

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