// Match data structure
let currentMatch = {
    startTime: null,
    endTime: null,
    map: null,
    playerStats: {
        kills: 0,
        deaths: 0,
        powerUpsCollected: 0,
        powerUpsUsed: 0,
        smashStreaks: [],
        timeJoined: null,
        timeSpent: 0
    },
    otherPlayers: new Map()
};

// Initialize WebSocket connection monitoring
function initializeWebSocketMonitoring() {
    const originalWebSocket = window.WebSocket;
    window.WebSocket = function(url, protocols) {
        const ws = new originalWebSocket(url, protocols);
        
        ws.addEventListener('message', function(event) {
            try {
                const data = JSON.parse(event.data);
                processGameData(data);
            } catch (error) {
                console.error('Error processing WebSocket message:', error);
            }
        });

        return ws;
    };
}

// Process game data from WebSocket messages
function processGameData(data) {
    if (!data) return;

    // Handle different types of game events
    switch (data.type) {
        case 'gameStart':
            handleGameStart(data);
            break;
        case 'gameEnd':
            handleGameEnd(data);
            break;
        case 'playerKill':
            handlePlayerKill(data);
            break;
        case 'playerDeath':
            handlePlayerDeath(data);
            break;
        case 'powerUpCollected':
            handlePowerUpCollected(data);
            break;
        case 'powerUpUsed':
            handlePowerUpUsed(data);
            break;
        case 'smashStreak':
            handleSmashStreak(data);
            break;
    }
}

// Event handlers
function handleGameStart(data) {
    currentMatch = {
        startTime: Date.now(),
        endTime: null,
        map: data.map,
        playerStats: {
            kills: 0,
            deaths: 0,
            powerUpsCollected: 0,
            powerUpsUsed: 0,
            smashStreaks: [],
            timeJoined: Date.now(),
            timeSpent: 0
        },
        otherPlayers: new Map()
    };

    // Extract player SKID and username
    const playerInfo = extractPlayerInfo();
    if (playerInfo) {
        currentMatch.playerStats.skid = playerInfo.skid;
        currentMatch.playerStats.username = playerInfo.username;
    }
}

function handleGameEnd(data) {
    currentMatch.endTime = Date.now();
    currentMatch.playerStats.timeSpent = currentMatch.endTime - currentMatch.playerStats.timeJoined;
    
    // Calculate final statistics
    const matchData = {
        ...currentMatch,
        otherPlayers: Array.from(currentMatch.otherPlayers.values())
    };

    // Send match data to background script
    chrome.runtime.sendMessage({
        type: 'matchComplete',
        data: matchData
    });
}

function handlePlayerKill(data) {
    if (data.killerId === currentMatch.playerStats.skid) {
        currentMatch.playerStats.kills++;
    }
    
    // Update other player's stats
    if (currentMatch.otherPlayers.has(data.victimId)) {
        const player = currentMatch.otherPlayers.get(data.victimId);
        player.deaths++;
        currentMatch.otherPlayers.set(data.victimId, player);
    }
}

function handlePlayerDeath(data) {
    if (data.victimId === currentMatch.playerStats.skid) {
        currentMatch.playerStats.deaths++;
    }
}

function handlePowerUpCollected(data) {
    if (data.playerId === currentMatch.playerStats.skid) {
        currentMatch.playerStats.powerUpsCollected++;
    }
}

function handlePowerUpUsed(data) {
    if (data.playerId === currentMatch.playerStats.skid) {
        currentMatch.playerStats.powerUpsUsed++;
    }
}

function handleSmashStreak(data) {
    if (data.playerId === currentMatch.playerStats.skid) {
        currentMatch.playerStats.smashStreaks.push({
            type: data.streakType,
            timestamp: Date.now()
        });
    }
}

// Helper function to extract player information
function extractPlayerInfo() {
    // This will need to be implemented based on how the game exposes player information
    // You might need to monitor DOM changes or specific game events
    const playerElement = document.querySelector('[data-player-info]');
    if (playerElement) {
        return {
            skid: playerElement.dataset.skid,
            username: playerElement.dataset.username
        };
    }
    return null;
}

// Initialize the content script
function initialize() {
    initializeWebSocketMonitoring();
    
    // Monitor DOM changes for player information
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'childList') {
                const playerInfo = extractPlayerInfo();
                if (playerInfo) {
                    currentMatch.playerStats.skid = playerInfo.skid;
                    currentMatch.playerStats.username = playerInfo.username;
                }
            }
        });
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
}

// Start the content script
initialize();

console.log('[SKMT] Content script loaded');

// Inject injected.js as a script file to bypass CSP restrictions
function injectScriptFile(filePath) {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL(filePath);
    script.onload = function() { this.remove(); };
    (document.head || document.documentElement).appendChild(script);
}
injectScriptFile('injected.js');

// Add a single consolidated message listener
window.addEventListener('message', function(event) {
    // Only accept messages from the same frame and from our injected script
    if (event.source !== window) return;
    if (!event.data || !event.data.type || !event.data.type.startsWith('SKMT_')) {
        return; // Only process messages specifically from our script
    }

    console.log('[SKMT][CONTENT] Received message from injected script:', event.data.type, event.data);

    // Handle different message types
    if (event.data.type === 'SKMT_SKID_UPDATED') {
        const skid = event.data.skid;
        if (skid && typeof skid === 'string' && skid.length > 5) {
            if (window.chrome && chrome.storage && chrome.storage.sync) {
                chrome.storage.sync.set({ currentSkid: skid }, () => {
                    console.log('[SKMT][CONTENT] SKID saved to chrome.storage.sync:', skid);
                    // Always forward SKID updates to the runtime
                    chrome.runtime.sendMessage(event.data);
                });
            }
        }
    } else if (event.data.type === 'SKMT_MATCH_COMPLETE') {
        const match = event.data.data;

        // Determine the mode key based on the match data
        // Fetch current SKID from storage first, as it's needed for the mode key
        chrome.storage.sync.get(['currentSkid'], (skidData) => {
            const skid = skidData.currentSkid || 'default'; // Use currentSKID from storage
            let mode = 'normal';
            if (match.isCustomMode) mode = 'custom';
            else if (match.isSpecialMode) mode = 'special';
            const getModeKey = (base) => `${base}_${skid}_${mode}`;

            // *** Handle quit matches differently ***
            if (match.quit) {
                console.log('[SKMT][CONTENT][SAVE] Match was quit. Only updating gamesQuit stat for mode:', mode, 'Match:', match);
                const gamesQuitKey = getModeKey('gamesQuit');
                
                // Fetch only the gamesQuit stat for this mode
                chrome.storage.sync.get([gamesQuitKey], (result) => {
                    let gamesQuit = result[gamesQuitKey] || 0;
                    gamesQuit++; // Increment quit count

                    // Save ONLY the incremented gamesQuit stat
                    const setObj = {};
                    setObj[gamesQuitKey] = gamesQuit;

                    console.log('[SKMT][CONTENT][SAVE] Setting updated gamesQuit in chrome.storage.sync:', setObj);
                    chrome.storage.sync.set(setObj, () => {
                        // Forward the match complete message to the runtime after saving
                        chrome.runtime.sendMessage(event.data);
                    });
                });
                
            } else { // *** Logic for Completed Matches (match.quit === false) ***
                console.log('[SKMT][CONTENT][SAVE] Saving completed match for SKID:', skid, 'Mode:', mode, 'isSpecialMode:', match.isSpecialMode, 'isCustomMode:', match.isCustomMode, 'Match:', match);

                // Calculate timeSpent from matchStartTime and matchEndTime if available
                if (match.matchStartTime && match.matchEndTime) {
                    match.playerStats = match.playerStats || {}; // Ensure playerStats exists
                    match.playerStats.timeSpent = match.matchEndTime - match.matchStartTime;
                } else {
                     match.playerStats = match.playerStats || {}; // Ensure playerStats exists
                     match.playerStats.timeSpent = 0;
                }

                // Keys to fetch for completed matches
                const keys = [
                    getModeKey('matchHistory'),
                    getModeKey('gamesJoined'),
                    getModeKey('gamesStarted'),
                    getModeKey('gamesQuit'), // Need to fetch this even for completed to avoid overwriting
                    getModeKey('matchesCompleted')
                ];
                
                chrome.storage.sync.get(keys, (result) => {
                    const history = result[getModeKey('matchHistory')] || [];
                    history.push(match); // Add match to history only for completed games

                    // Get current cumulative counts
                    let gamesJoined = result[getModeKey('gamesJoined')] || 0;
                    let gamesStarted = result[getModeKey('gamesStarted')] || 0;
                    let gamesQuit = result[getModeKey('gamesQuit')] || 0;
                    let matchesCompleted = result[getModeKey('matchesCompleted')] || 0;

                    // Increment counters for completed matches
                    if (match.joined) gamesJoined++;
                    if (match.started) gamesStarted++;
                    // gamesQuit is NOT incremented here
                    if (!match.quit) matchesCompleted++; // Count as completed if not quit

                    // Save updated data back to storage
                    const setObj = {};
                    setObj[getModeKey('matchHistory')] = history;
                    setObj[getModeKey('gamesJoined')] = gamesJoined;
                    setObj[getModeKey('gamesStarted')] = gamesStarted;
                    setObj[getModeKey('gamesQuit')] = gamesQuit; // Save the fetched value
                    setObj[getModeKey('matchesCompleted')] = matchesCompleted;

                    console.log('[SKMT][CONTENT][SAVE] Setting completed match data and updated stats in chrome.storage.sync:', setObj);
                    chrome.storage.sync.set(setObj, () => {
                         // Forward the match complete message to the runtime after saving
                         chrome.runtime.sendMessage(event.data);
                    });
                });
            }
        });
    }
    // Note: Other message types from injected.js that don't start with SKMT_ will be ignored by this listener.
    // If other message types need forwarding or processing, they should be added here.
});

// Any other existing initialization logic in content.js (like WebSocket monitoring, MutationObserver, injected script injection) should remain.
// Ensure there are no other conflicting listeners or direct storage writes for match data/SKID in content.js.