// Function to get stats from storage
async function getStats() {
    return new Promise((resolve) => {
        chrome.storage.sync.get(['currentSkid'], (skidData) => {
            const currentSkid = skidData.currentSkid || 'Default';
            console.log('[SKMT][STATS-NUMBERS][getStats] Current SKID:', currentSkid);
            
            const modes = ['normal', 'special', 'custom'];
            const keysToFetch = ['currentSkid'];
            
            // Fetch data for all modes
            modes.forEach(mode => {
                keysToFetch.push(`matchHistory_${currentSkid}_${mode}`);
                keysToFetch.push(`gamesJoined_${currentSkid}_${mode}`);
                keysToFetch.push(`gamesStarted_${currentSkid}_${mode}`);
                keysToFetch.push(`gamesQuit_${currentSkid}_${mode}`);
                keysToFetch.push(`matchesCompleted_${currentSkid}_${mode}`);
            });

            console.log('[SKMT][STATS-NUMBERS][getStats] Keys to fetch:', keysToFetch);

            chrome.storage.sync.get(keysToFetch, (data) => {
                console.log('[SKMT][STATS-NUMBERS][getStats] Raw data received:', data);
                
                // Combine data from all modes
                const combinedData = {
                    matchHistory: [],
                    matchesCompleted: 0,
                    matchesQuit: 0,
                    gamesJoined: 0,
                    gamesStarted: 0,
                    totalKills: 0,
                    totalDeaths: 0,
                    totalTimePlayed: 0,
                    smashStreak: 0,
                    smashtacularStreak: 0,
                    smashosaurusStreak: 0,
                    smashlvaniaStreak: 0,
                    monsterSmashStreak: 0,
                    potatoStreak: 0,
                    smashSmashStreak: 0,
                    potoatachioStreak: 0,
                    doubleSmash: 0,
                    multiSmash: 0,
                    multiMegaSmash: 0,
                    multiMegaUltraSmash: 0,
                    gooseySmash: 0,
                    crazyMultiMegaUltraSmash: 0,
                    highestKills: 0,
                    highestDeaths: 0,
                    highestKillStreak: 0,
                    highestKDR: 0,
                    longestTimePlayed: 0
                };

                modes.forEach(mode => {
                    const history = data[`matchHistory_${currentSkid}_${mode}`] || [];
                    console.log(`[SKMT][STATS-NUMBERS][getStats] History for ${mode}:`, history);
                    combinedData.matchHistory = combinedData.matchHistory.concat(history);
                    combinedData.matchesCompleted += data[`matchesCompleted_${currentSkid}_${mode}`] || 0;
                    combinedData.matchesQuit += data[`gamesQuit_${currentSkid}_${mode}`] || 0;
                    combinedData.gamesJoined += data[`gamesJoined_${currentSkid}_${mode}`] || 0;
                    combinedData.gamesStarted += data[`gamesStarted_${currentSkid}_${mode}`] || 0;
                });

                console.log('[SKMT][STATS-NUMBERS][getStats] Combined match history:', combinedData.matchHistory);

                // Calculate totals and records from match history
                combinedData.matchHistory.forEach((match, index) => {
                    console.log(`[SKMT][STATS-NUMBERS][getStats] Processing match ${index}:`, JSON.stringify(match, null, 2));
                    
                    // Basic stats
                    combinedData.totalKills += match.kills || 0;
                    combinedData.totalDeaths += match.deaths || 0;
                    // Convert duration from milliseconds to seconds
                    const durationInSeconds = Math.floor((match.duration || 0) / 1000);
                    combinedData.totalTimePlayed += durationInSeconds;

                    // Update records
                    if (match.kills > combinedData.highestKills) {
                        combinedData.highestKills = match.kills;
                    }
                    if (match.deaths > combinedData.highestDeaths) {
                        combinedData.highestDeaths = match.deaths;
                    }

                    // Calculate KDR for the match
                    const matchKDR = match.deaths > 0 ? match.kills / match.deaths : match.kills;
                    if (matchKDR > combinedData.highestKDR) {
                        combinedData.highestKDR = matchKDR;
                    }

                    // Use duration for longest time (in seconds)
                    if (durationInSeconds > combinedData.longestTimePlayed) {
                        combinedData.longestTimePlayed = durationInSeconds;
                    }

                    // Calculate streaks from kill and death timestamps
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

                                // Update without dying streaks
                                if (currentStreak >= 3 && !achievedMilestones[3]) { combinedData.smashStreak++; achievedMilestones[3] = true; }
                                if (currentStreak >= 5 && !achievedMilestones[5]) { combinedData.smashtacularStreak++; achievedMilestones[5] = true; }
                                if (currentStreak >= 7 && !achievedMilestones[7]) { combinedData.smashosaurusStreak++; achievedMilestones[7] = true; }
                                if (currentStreak >= 10 && !achievedMilestones[10]) { combinedData.smashlvaniaStreak++; achievedMilestones[10] = true; }
                                if (currentStreak >= 15 && !achievedMilestones[15]) { combinedData.monsterSmashStreak++; achievedMilestones[15] = true; }
                                if (currentStreak >= 20 && !achievedMilestones[20]) { combinedData.potatoStreak++; achievedMilestones[20] = true; }
                                if (currentStreak >= 25 && !achievedMilestones[25]) { combinedData.smashSmashStreak++; achievedMilestones[25] = true; }
                                if (currentStreak >= 30 && !achievedMilestones[30]) { combinedData.potoatachioStreak++; achievedMilestones[30] = true; }

                                // Handle quick kills streak
                                if (lastKillTime === null) {
                                    // First kill after death
                                    quickKillStreak = 1;
                                    lastKillTime = event.time;
                                } else {
                                    const timeSinceLastKill = event.time - lastKillTime;
                                    if (timeSinceLastKill <= 3000) { // 3 seconds for quick kills
                                        // Kill within 3 seconds of last kill - INCREASE STREAK
                                        quickKillStreak++;
                                        if (quickKillStreak === 2) combinedData.doubleSmash++;
                                        if (quickKillStreak === 3) combinedData.multiSmash++;
                                        if (quickKillStreak === 4) combinedData.multiMegaSmash++;
                                        if (quickKillStreak === 5) combinedData.multiMegaUltraSmash++;
                                        if (quickKillStreak === 6) combinedData.gooseySmash++;
                                        if (quickKillStreak === 7) combinedData.crazyMultiMegaUltraSmash++;
                                    } else {
                                        // Kill after more than 3 seconds - RESET STREAK
                                        quickKillStreak = 1;
                                    }
                                    lastKillTime = event.time;
                                }
                            }
                        });

                        // Update highest kill streak
                        if (maxStreak > combinedData.highestKillStreak) {
                            combinedData.highestKillStreak = maxStreak;
                        }
                    }
                });

                console.log('[SKMT][STATS-NUMBERS][getStats] Final combined data:', combinedData);

                // Add currentSkid to the returned object
                combinedData.currentSkid = currentSkid;
                resolve(combinedData);
            });
        });
    });
}

// Function to format time in seconds to a readable string
function formatTime(seconds) {
    if (seconds < 60) {
        return `${Math.floor(seconds)}s`;
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}m ${remainingSeconds}s`;
}

// Function to update all stats on the page
async function updateStats() {
    console.log('[SKMT][STATS-NUMBERS][updateStats] Starting stats update');
    const stats = await getStats();
    console.log('[SKMT][STATS-NUMBERS][updateStats] Stats received:', stats);
    
    // Primary Stats
    document.getElementById('kills').textContent = stats.totalKills;
    document.getElementById('deaths').textContent = stats.totalDeaths;
    document.getElementById('kdr').textContent = (stats.totalDeaths > 0 ? stats.totalKills / stats.totalDeaths : stats.totalKills).toFixed(2);
    document.getElementById('timePlayed').textContent = formatTime(stats.totalTimePlayed);
    document.getElementById('matchesCompleted').textContent = stats.matchesCompleted;

    // Secondary Stats
    document.getElementById('matchesJoined').textContent = stats.gamesJoined;
    document.getElementById('matchesStarted').textContent = stats.gamesStarted;
    document.getElementById('matchesQuit').textContent = stats.matchesQuit;
    document.getElementById('totalMatches').textContent = stats.matchesCompleted + stats.matchesQuit;
    
    const totalMatches = stats.matchesCompleted + stats.matchesQuit;
    const completedRate = totalMatches > 0 ? (stats.matchesCompleted / totalMatches * 100) : 0;
    const quitRate = totalMatches > 0 ? (stats.matchesQuit / totalMatches * 100) : 0;
    
    document.getElementById('matchesCompletedRate').textContent = `${completedRate.toFixed(2)}%`;
    document.getElementById('matchesQuitRate').textContent = `${quitRate.toFixed(2)}%`;

    // Average Stats
    const avgKills = stats.matchesCompleted > 0 ? stats.totalKills / stats.matchesCompleted : 0;
    const avgDeaths = stats.matchesCompleted > 0 ? stats.totalDeaths / stats.matchesCompleted : 0;
    const avgTime = stats.matchesCompleted > 0 ? stats.totalTimePlayed / stats.matchesCompleted : 0;
    
    document.getElementById('avgKills').textContent = avgKills.toFixed(2);
    document.getElementById('avgDeaths').textContent = avgDeaths.toFixed(2);
    document.getElementById('avgTime').textContent = formatTime(avgTime);

    // Records
    document.getElementById('highestKills').textContent = stats.highestKills;
    document.getElementById('highestDeaths').textContent = stats.highestDeaths;
    document.getElementById('highestKillStreak').textContent = stats.highestKillStreak;
    document.getElementById('highestKDR').textContent = stats.highestKDR.toFixed(2);
    document.getElementById('longestTime').textContent = formatTime(stats.longestTimePlayed);

    // Streaks (Without Dying)
    document.getElementById('smashStreak').textContent = stats.smashStreak;
    document.getElementById('smashtacularStreak').textContent = stats.smashtacularStreak;
    document.getElementById('smashosaurusStreak').textContent = stats.smashosaurusStreak;
    document.getElementById('smashlvaniaStreak').textContent = stats.smashlvaniaStreak;
    document.getElementById('monsterSmashStreak').textContent = stats.monsterSmashStreak;
    document.getElementById('potatoStreak').textContent = stats.potatoStreak;
    document.getElementById('smashSmashStreak').textContent = stats.smashSmashStreak;
    document.getElementById('potoatachioStreak').textContent = stats.potoatachioStreak;

    // Quick Kills Streaks
    document.getElementById('doubleSmash').textContent = stats.doubleSmash;
    document.getElementById('multiSmash').textContent = stats.multiSmash;
    document.getElementById('multiMegaSmash').textContent = stats.multiMegaSmash;
    document.getElementById('multiMegaUltraSmash').textContent = stats.multiMegaUltraSmash;
    document.getElementById('gooseySmash').textContent = stats.gooseySmash;
    document.getElementById('crazyMultiMegaUltraSmash').textContent = stats.crazyMultiMegaUltraSmash;

    console.log('[SKMT][STATS-NUMBERS][updateStats] Stats update completed');
}

// Update stats when the page loads
document.addEventListener('DOMContentLoaded', () => {
    console.log('[SKMT][STATS-NUMBERS] Page loaded, initializing stats');
    updateStats();
});

// Update stats every 5 seconds to keep them current
setInterval(() => {
    console.log('[SKMT][STATS-NUMBERS] Interval update triggered');
    updateStats();
}, 5000); 