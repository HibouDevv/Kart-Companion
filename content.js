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
        
        console.log('[SKMT] WebSocket connected');
        
        ws.addEventListener('open', function() {
            console.log('[SKMT] WebSocket ready');
        });
        
        ws.addEventListener('message', function(event) {
            try {
                const data = JSON.parse(event.data);
                processGameData(data);
            } catch (error) {
                // Only log if it's not a binary message
                if (typeof event.data === 'string') {
                    console.error('[SKMT] WebSocket error:', error.message);
                }
            }
        });

        ws.addEventListener('error', function(error) {
            console.error('[SKMT] WebSocket error:', error.message);
        });

        ws.addEventListener('close', function() {
            console.log('[SKMT] WebSocket closed');
        });

        return ws;
    };
}

// Process game data from WebSocket messages
function processGameData(data) {
    if (!data) return;

    // Handle different types of game events
    if (data.type) {
        switch (data.type) {
            case 'gameStart':
            case 'start_game':
                handleGameStart(data);
                break;
            case 'gameEnd':
            case 'game_end':
                handleGameEnd(data);
                break;
            case 'playerKill':
            case 'destroyed_human':
                handlePlayerKill(data);
                break;
            case 'playerDeath':
            case 'destroyed_by_human':
            case 'destroyed_by_bot':
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
}

// Event handlers
function handleGameStart(data) {
    console.log('[SKMT] Game starting');
    currentMatchLogs = [];
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
    console.log('[SKMT] Game ending');
    currentMatch.endTime = Date.now();
    currentMatch.playerStats.timeSpent = currentMatch.endTime - currentMatch.playerStats.timeJoined;
    
    // Calculate final statistics
    const matchData = {
        ...currentMatch,
        otherPlayers: Array.from(currentMatch.otherPlayers.values()),
        logs: currentMatchLogs
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
        return;
    }

    // Handle different message types
    if (event.data.type === 'SKMT_SKID_UPDATED') {
        const skid = event.data.skid;
        if (skid && typeof skid === 'string' && skid.length > 5) {
            if (window.chrome && chrome.storage && chrome.storage.sync) {
                chrome.storage.sync.set({ currentSkid: skid }, () => {
                    console.log('[SKMT] SKID saved:', skid);
                    chrome.runtime.sendMessage(event.data);
                });
            }
        }
    } else if (event.data.type === 'SKMT_MATCH_COMPLETE') {
        const match = event.data.data;
        console.log('[SKMT] Saving match data:', { kills: match.kills, deaths: match.deaths });
        
        // Determine the mode key based on the match data
        chrome.storage.sync.get(['currentSkid'], (skidData) => {
            const skid = skidData.currentSkid || 'default';
            let mode = 'normal';
            if (match.isCustomMode) mode = 'custom';
            else if (match.isSpecialMode) mode = 'special';
            const getModeKey = (base) => `${base}_${skid}_${mode}`;

            // Handle quit matches
            if (match.quit) {
                const gamesQuitKey = getModeKey('gamesQuit');
                chrome.storage.sync.get([gamesQuitKey], (result) => {
                    let gamesQuit = result[gamesQuitKey] || 0;
                    gamesQuit++;
                    const setObj = {};
                    setObj[gamesQuitKey] = gamesQuit;
                    chrome.storage.sync.set(setObj, () => {
                        console.log('[SKMT] Match quit saved');
                        chrome.runtime.sendMessage(event.data);
                    });
                });
            } else {
                // Handle completed matches
                const keys = [
                    getModeKey('matchHistory'),
                    getModeKey('gamesJoined'),
                    getModeKey('gamesStarted'),
                    getModeKey('gamesQuit'),
                    getModeKey('matchesCompleted')
                ];
                
                chrome.storage.sync.get(keys, (result) => {
                    const history = result[getModeKey('matchHistory')] || [];
                    history.push(match);

                    let gamesJoined = result[getModeKey('gamesJoined')] || 0;
                    let gamesStarted = result[getModeKey('gamesStarted')] || 0;
                    let gamesQuit = result[getModeKey('gamesQuit')] || 0;
                    let matchesCompleted = result[getModeKey('matchesCompleted')] || 0;

                    if (match.joined) gamesJoined++;
                    if (match.started) gamesStarted++;
                    if (!match.quit) matchesCompleted++;

                    const setObj = {};
                    setObj[getModeKey('matchHistory')] = history;
                    setObj[getModeKey('gamesJoined')] = gamesJoined;
                    setObj[getModeKey('gamesStarted')] = gamesStarted;
                    setObj[getModeKey('gamesQuit')] = gamesQuit;
                    setObj[getModeKey('matchesCompleted')] = matchesCompleted;

                    chrome.storage.sync.set(setObj, () => {
                        console.log('[SKMT] Match data saved');
                        chrome.runtime.sendMessage(event.data);
                    });
                });
            }
        });
    } else if (event.data.type === 'SKMT_DEATHS_UPDATE') {
        hud.textContent = `Deaths: ${event.data.deaths}`;
        console.log('[SKMT] HUD: Deaths display updated to', event.data.deaths);
    } else if (event.data.type === 'SKMT_KILLSTREAK_UPDATE') {
        killStreakHud.textContent = `Kill Streak: ${event.data.killStreak}`;
        console.log('[SKMT] HUD: Kill streak display updated to', event.data.killStreak);
    } else if (event.data.type === 'SKMT_MATCH_COMPLETE') {
        hud.textContent = 'Deaths: 0';
        killStreakHud.textContent = 'Kill Streak: 0';
        console.log('[SKMT] HUD: Reset to initial state');
    }
    // Note: Other message types from injected.js that don't start with SKMT_ will be ignored by this listener.
    // If other message types need forwarding or processing, they should be added here.
});

// Any other existing initialization logic in content.js (like WebSocket monitoring, MutationObserver, injected script injection) should remain.
// Ensure there are no other conflicting listeners or direct storage writes for match data/SKID in content.js.

// HUD overlay for Deaths
const hud = document.createElement('div');
hud.id = 'death-hud-overlay';
hud.style.position = 'fixed';
hud.style.top = '100px';
hud.style.right = '40px';
hud.style.zIndex = '999999';
hud.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
hud.style.fontWeight = '700';
hud.style.fontSize = '32px';
hud.style.color = '#fff';
hud.style.textShadow = '2px 2px 4px rgba(0, 0, 0, 0.3)';
hud.style.cursor = 'move';
hud.style.userSelect = 'none';
hud.style.display = 'none';
hud.style.textRendering = 'optimizeLegibility';
hud.style.webkitFontSmoothing = 'antialiased';
hud.style.mozOsxFontSmoothing = 'grayscale';
hud.style.letterSpacing = '0.5px';
hud.textContent = 'Deaths: 0';

// Make HUD draggable
let isDragging = false;
let currentX;
let currentY;
let initialX;
let initialY;
let xOffset = 0;
let yOffset = 0;

// Load saved position
chrome.storage.sync.get(['hudPosition'], function(result) {
    if (result.hudPosition) {
        xOffset = result.hudPosition.x;
        yOffset = result.hudPosition.y;
        setTranslate(xOffset, yOffset, hud);
    }
});

function dragStart(e) {
    if (e.type === "touchstart") {
        initialX = e.touches[0].clientX - xOffset;
        initialY = e.touches[0].clientY - yOffset;
    } else {
        initialX = e.clientX - xOffset;
        initialY = e.clientY - yOffset;
    }

    if (e.target === hud) {
        isDragging = true;
        e.preventDefault(); // Prevent text selection while dragging
    }
}

function dragEnd(e) {
    if (!isDragging) return;
    
    initialX = currentX;
    initialY = currentY;
    isDragging = false;

    // Save position
    chrome.storage.sync.set({
        hudPosition: {
            x: xOffset,
            y: yOffset
        }
    });
}

function drag(e) {
    if (!isDragging) return;
    
    e.preventDefault();

    if (e.type === "touchmove") {
        currentX = e.touches[0].clientX - initialX;
        currentY = e.touches[0].clientY - initialY;
    } else {
        currentX = e.clientX - initialX;
        currentY = e.clientY - initialY;
    }

    xOffset = currentX;
    yOffset = currentY;

    setTranslate(currentX, currentY, hud);
}

hud.addEventListener("touchstart", dragStart, false);
hud.addEventListener("touchend", dragEnd, false);
hud.addEventListener("touchmove", drag, false);

hud.addEventListener("mousedown", dragStart, false);
hud.addEventListener("mouseup", dragEnd, false);
hud.addEventListener("mousemove", drag, false);

document.body.appendChild(hud);

// Initialize HUD states on page load
chrome.storage.sync.get(['deathsHudEnabled', 'killStreakHudEnabled'], (result) => {
    if (result.deathsHudEnabled !== false) { // default ON
        hud.style.display = 'block';
    }
    if (result.killStreakHudEnabled !== false) { // default ON
        killStreakHud.style.display = 'block';
    }
});

// Listen for toggle from popup
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'toggle-deaths-hud') {
    hud.style.display = msg.enabled ? 'block' : 'none';
  } else if (msg.type === 'toggle-killstreak-hud') {
    killStreakHud.style.display = msg.enabled ? 'block' : 'none';
  }
});

// HUD overlay for Kill Streak
const killStreakHud = document.createElement('div');
killStreakHud.id = 'kill-streak-hud-overlay';
killStreakHud.style.position = 'fixed';
killStreakHud.style.top = '160px';
killStreakHud.style.right = '40px';
killStreakHud.style.zIndex = '999999';
killStreakHud.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
killStreakHud.style.fontWeight = '700';
killStreakHud.style.fontSize = '32px';
killStreakHud.style.color = '#fff';
killStreakHud.style.textShadow = '2px 2px 4px rgba(0, 0, 0, 0.3)';
killStreakHud.style.cursor = 'move';
killStreakHud.style.userSelect = 'none';
killStreakHud.style.display = 'none';
killStreakHud.style.textRendering = 'optimizeLegibility';
killStreakHud.style.webkitFontSmoothing = 'antialiased';
killStreakHud.style.mozOsxFontSmoothing = 'grayscale';
killStreakHud.style.letterSpacing = '0.5px';
killStreakHud.textContent = 'Kill Streak: 0';

// Make Kill Streak HUD draggable
let isDraggingKS = false;
let currentXKS;
let currentYKS;
let initialXKS;
let initialYKS;
let xOffsetKS = 0;
let yOffsetKS = 0;

// Load saved position for Kill Streak HUD
chrome.storage.sync.get(['killStreakHudPosition'], function(result) {
    if (result.killStreakHudPosition) {
        xOffsetKS = result.killStreakHudPosition.x;
        yOffsetKS = result.killStreakHudPosition.y;
        setTranslateKS(xOffsetKS, yOffsetKS, killStreakHud);
    }
});

function dragStartKS(e) {
    if (e.type === "touchstart") {
        initialXKS = e.touches[0].clientX - xOffsetKS;
        initialYKS = e.touches[0].clientY - yOffsetKS;
    } else {
        initialXKS = e.clientX - xOffsetKS;
        initialYKS = e.clientY - yOffsetKS;
    }
    
    if (e.target === killStreakHud) {
        isDraggingKS = true;
        e.preventDefault(); // Prevent text selection while dragging
    }
}

function dragEndKS(e) {
    if (!isDraggingKS) return;
    
    initialXKS = currentXKS;
    initialYKS = currentYKS;
    isDraggingKS = false;

    // Save position
    chrome.storage.sync.set({
        killStreakHudPosition: {
            x: xOffsetKS,
            y: yOffsetKS
        }
    });
}

function dragKS(e) {
    if (!isDraggingKS) return;
    
    e.preventDefault();

    if (e.type === "touchmove") {
        currentXKS = e.touches[0].clientX - initialXKS;
        currentYKS = e.touches[0].clientY - initialYKS;
    } else {
        currentXKS = e.clientX - initialXKS;
        currentYKS = e.clientY - initialYKS;
    }

    xOffsetKS = currentXKS;
    yOffsetKS = currentYKS;

    setTranslateKS(currentXKS, currentYKS, killStreakHud);
}

function setTranslate(xPos, yPos, el) {
    el.style.transform = `translate3d(${xPos}px, ${yPos}px, 0)`;
}

function setTranslateKS(xPos, yPos, el) {
    el.style.transform = `translate3d(${xPos}px, ${yPos}px, 0)`;
}

killStreakHud.addEventListener("touchstart", dragStartKS, false);
killStreakHud.addEventListener("touchend", dragEndKS, false);
killStreakHud.addEventListener("touchmove", dragKS, false);
killStreakHud.addEventListener("mousedown", dragStartKS, false);
killStreakHud.addEventListener("mouseup", dragEndKS, false);
killStreakHud.addEventListener("mousemove", dragKS, false);

document.body.appendChild(killStreakHud);

// Kill Streak logic
let killStreak = 0;

// Listen for messages from injected.js
window.addEventListener('message', function(event) {
    if (event.source !== window) return;
    if (!event.data || !event.data.type || !event.data.type.startsWith('SKMT_')) {
        return;
    }
    if (event.data.type === 'SKMT_DEATHS_UPDATE') {
        hud.textContent = `Deaths: ${event.data.deaths}`;
    } else if (event.data.type === 'SKMT_KILLSTREAK_UPDATE') {
        killStreakHud.textContent = `Kill Streak: ${event.data.killStreak}`;
    } else if (event.data.type === 'SKMT_MATCH_COMPLETE') {
        hud.textContent = 'Deaths: 0';
        killStreakHud.textContent = 'Kill Streak: 0';
    }
});

// Add at the top:
let currentMatchLogs = [];

// In the code that handles log lines (e.g., WebSocket, MutationObserver, or console interception), add:
function collectPlayerLogLine(line) {
    if (typeof line === 'string' &&
        (line.includes('Vehicle Setup: VehicleCharacter - setting new head position -') ||
         line.includes('Vehicle Setup: VehicleCharacter - setting original head position -'))
    ) {
        currentMatchLogs.push(line);
    }
}

// If you have a place where you process or intercept logs, call collectPlayerLogLine(line) for each log line.
// For example, if you have a function that processes logs:
// collectPlayerLogLine(logLine);