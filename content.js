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

// Listen for SKMT_MATCH_COMPLETE messages and save match data to chrome.storage.sync
window.addEventListener('message', function(event) {
    if (event.data && event.data.type === 'SKMT_MATCH_COMPLETE') {
        const match = event.data.data;
        // Get current SKID from chrome.storage.sync
        chrome.storage.sync.get(['currentSkid'], (skidData) => {
            const skid = skidData.currentSkid || 'default';
            let mode = 'normal';
            if (match.isCustomMode) mode = 'custom';
            else if (match.isSpecialMode) mode = 'special';
            const getModeKey = (base) => `${base}_${skid}_${mode}`;
            const keys = [
                getModeKey('matchHistory'),
                getModeKey('gamesJoined'),
                getModeKey('gamesStarted'),
                getModeKey('gamesQuit'),
                getModeKey('matchesCompleted')
            ];
            console.log('[SKMT][SAVE] Saving match for SKID:', skid, 'Mode:', mode, 'isSpecialMode:', match.isSpecialMode, 'isCustomMode:', match.isCustomMode, 'Keys:', keys, 'Match:', match);
            chrome.storage.sync.get(keys, (result) => {
                const history = result[getModeKey('matchHistory')] || [];
                history.push(match);

                // Increment counters
                let gamesJoined = result[getModeKey('gamesJoined')] || 0;
                let gamesStarted = result[getModeKey('gamesStarted')] || 0;
                let gamesQuit = result[getModeKey('gamesQuit')] || 0;
                let matchesCompleted = result[getModeKey('matchesCompleted')] || 0;

                if (match.joined) gamesJoined++;
                if (match.started) gamesStarted++;
                if (match.quit) gamesQuit++;
                // Only count as completed if not quit and in the correct mode
                if (mode === 'special' && match.isSpecialMode && !match.quit) matchesCompleted++;
                if (mode === 'normal' && !match.isSpecialMode && !match.isCustomMode && !match.quit) matchesCompleted++;
                if (mode === 'custom' && match.isCustomMode && !match.quit) matchesCompleted++;

                const setObj = {};
                setObj[getModeKey('matchHistory')] = history;
                setObj[getModeKey('gamesJoined')] = gamesJoined;
                setObj[getModeKey('gamesStarted')] = gamesStarted;
                setObj[getModeKey('gamesQuit')] = gamesQuit;
                setObj[getModeKey('matchesCompleted')] = matchesCompleted;
                console.log('[SKMT][SAVE] Setting in chrome.storage.sync:', setObj);
                chrome.storage.sync.set(setObj);
            });
        });
    }
});

// Listen for SKID updates from injected.js and save to chrome.storage.sync
window.addEventListener('message', function(event) {
    if (event.source !== window) return; // Only accept messages from same window
    if (event.data && event.data.type === 'SKMT_SKID_UPDATED' && event.data.skid) {
        if (window.chrome && chrome.storage && chrome.storage.sync) {
            chrome.storage.sync.set({ currentSkid: event.data.skid });
            console.log('[SKMT] SKID saved to chrome.storage.sync:', event.data.skid);
        }
    }
}); 