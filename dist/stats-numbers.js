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

// Function to animate counting from 0 to target value
function animateValue(element, start, end, duration) {
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        const currentValue = Math.floor(progress * (end - start) + start);
        element.textContent = currentValue;
        if (progress < 1) {
            window.requestAnimationFrame(step);
        }
    };
    window.requestAnimationFrame(step);
}

// Function to animate decimal values
function animateDecimal(element, start, end, duration, decimals = 2) {
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        const currentValue = progress * (end - start) + start;
        element.textContent = currentValue.toFixed(decimals);
        if (progress < 1) {
            window.requestAnimationFrame(step);
        }
    };
    window.requestAnimationFrame(step);
}

// Function to animate time values
function animateTime(element, start, end, duration) {
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        const currentValue = Math.floor(progress * (end - start) + start);
        element.textContent = formatTime(currentValue);
        if (progress < 1) {
            window.requestAnimationFrame(step);
        }
    };
    window.requestAnimationFrame(step);
}

// Function to update all stats on the page
async function updateStats() {
    console.log('[SKMT][STATS-NUMBERS][updateStats] Starting stats update');
    const stats = await getStats();
    console.log('[SKMT][STATS-NUMBERS][updateStats] Stats received:', stats);
    
    const animationDuration = 1000; // 1 second animation

    // Primary Stats
    animateValue(document.getElementById('kills'), 0, stats.totalKills, animationDuration);
    animateValue(document.getElementById('deaths'), 0, stats.totalDeaths, animationDuration);
    animateDecimal(document.getElementById('kdr'), 0, (stats.totalDeaths > 0 ? stats.totalKills / stats.totalDeaths : stats.totalKills), animationDuration);
    animateTime(document.getElementById('timePlayed'), 0, stats.totalTimePlayed, animationDuration);
    animateValue(document.getElementById('matchesCompleted'), 0, stats.matchesCompleted, animationDuration);

    // Secondary Stats
    animateValue(document.getElementById('matchesJoined'), 0, stats.gamesJoined, animationDuration);
    animateValue(document.getElementById('matchesStarted'), 0, stats.gamesStarted, animationDuration);
    animateValue(document.getElementById('matchesQuit'), 0, stats.matchesQuit, animationDuration);
    animateValue(document.getElementById('totalMatches'), 0, stats.matchesCompleted + stats.matchesQuit, animationDuration);
    
    const totalMatches = stats.matchesCompleted + stats.matchesQuit;
    const completedRate = totalMatches > 0 ? (stats.matchesCompleted / totalMatches * 100) : 0;
    const quitRate = totalMatches > 0 ? (stats.matchesQuit / totalMatches * 100) : 0;
    
    animateDecimal(document.getElementById('matchesCompletedRate'), 0, completedRate, animationDuration);
    animateDecimal(document.getElementById('matchesQuitRate'), 0, quitRate, animationDuration);

    // Average Stats
    const avgKills = stats.matchesCompleted > 0 ? stats.totalKills / stats.matchesCompleted : 0;
    const avgDeaths = stats.matchesCompleted > 0 ? stats.totalDeaths / stats.matchesCompleted : 0;
    const avgTime = stats.matchesCompleted > 0 ? stats.totalTimePlayed / stats.matchesCompleted : 0;
    
    animateDecimal(document.getElementById('avgKills'), 0, avgKills, animationDuration);
    animateDecimal(document.getElementById('avgDeaths'), 0, avgDeaths, animationDuration);
    animateTime(document.getElementById('avgTime'), 0, avgTime, animationDuration);

    // Records
    animateValue(document.getElementById('highestKills'), 0, stats.highestKills, animationDuration);
    animateValue(document.getElementById('highestDeaths'), 0, stats.highestDeaths, animationDuration);
    animateValue(document.getElementById('highestKillStreak'), 0, stats.highestKillStreak, animationDuration);
    animateDecimal(document.getElementById('highestKDR'), 0, stats.highestKDR, animationDuration);
    animateTime(document.getElementById('longestTime'), 0, stats.longestTimePlayed, animationDuration);

    // Streaks (Without Dying)
    animateValue(document.getElementById('smashStreak'), 0, stats.smashStreak, animationDuration);
    animateValue(document.getElementById('smashtacularStreak'), 0, stats.smashtacularStreak, animationDuration);
    animateValue(document.getElementById('smashosaurusStreak'), 0, stats.smashosaurusStreak, animationDuration);
    animateValue(document.getElementById('smashlvaniaStreak'), 0, stats.smashlvaniaStreak, animationDuration);
    animateValue(document.getElementById('monsterSmashStreak'), 0, stats.monsterSmashStreak, animationDuration);
    animateValue(document.getElementById('potatoStreak'), 0, stats.potatoStreak, animationDuration);
    animateValue(document.getElementById('smashSmashStreak'), 0, stats.smashSmashStreak, animationDuration);
    animateValue(document.getElementById('potoatachioStreak'), 0, stats.potoatachioStreak, animationDuration);

    // Quick Kills Streaks
    animateValue(document.getElementById('doubleSmash'), 0, stats.doubleSmash, animationDuration);
    animateValue(document.getElementById('multiSmash'), 0, stats.multiSmash, animationDuration);
    animateValue(document.getElementById('multiMegaSmash'), 0, stats.multiMegaSmash, animationDuration);
    animateValue(document.getElementById('multiMegaUltraSmash'), 0, stats.multiMegaUltraSmash, animationDuration);
    animateValue(document.getElementById('gooseySmash'), 0, stats.gooseySmash, animationDuration);
    animateValue(document.getElementById('crazyMultiMegaUltraSmash'), 0, stats.crazyMultiMegaUltraSmash, animationDuration);

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