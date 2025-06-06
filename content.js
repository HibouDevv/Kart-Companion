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
    }).catch(() => {
        console.log('[SKMT] Content: Message port closed, ignoring error');
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
        console.log('[SKMT] Saving match data:', { kills: match.kills, deaths: match.deaths, quit: match.quit });
        
        // Determine the mode key based on the match data
        chrome.storage.sync.get(['currentSkid'], (data) => {
            const skid = data.currentSkid || 'default';
            let mode = 'normal';
            
            // Determine mode based on match data
            if (match.isCustomMode) {
                mode = 'custom';
                console.log('[SKMT] Recording quit in custom mode');
            } else if (match.isSpecialMode) {
                mode = 'special';
                console.log('[SKMT] Recording quit in special mode');
            } else {
                console.log('[SKMT] Recording quit in normal mode');
            }
            
            const getModeKey = (base) => `${base}_${skid}_${mode}`;

            // Get all relevant keys
            const keys = [];
            
            if (match.quit) {
                // For quit games, only get gamesQuit
                keys.push(getModeKey('gamesQuit'));
            } else {
                // For completed games, get all stats
                keys.push(
                    getModeKey('matchHistory'),
                    getModeKey('gamesJoined'),
                    getModeKey('gamesStarted'),
                    getModeKey('matchesCompleted')
                );
            }
            
            chrome.storage.sync.get(keys, (result) => {
                const setObj = {};

                if (match.quit) {
                    // Calculate time spent in game
                    const timeSpent = match.matchEndTime - match.matchStartTime;
                    const shouldIncrementQuit = timeSpent >= 10000; // 10 seconds in milliseconds

                    if (shouldIncrementQuit) {
                        // Only increment gamesQuit if spent more than 10 seconds
                        let gamesQuit = result[getModeKey('gamesQuit')] || 0;
                        gamesQuit++;
                        setObj[getModeKey('gamesQuit')] = gamesQuit;
                        console.log('[SKMT] Incrementing gamesQuit for mode:', mode, 'New value:', gamesQuit, 'Time spent:', timeSpent);
                    } else {
                        console.log('[SKMT] Not incrementing gamesQuit - time spent less than 10 seconds:', timeSpent);
                    }
                } else {
                    // For completed games, update all stats
                    let history = result[getModeKey('matchHistory')] || [];
                    history.push(match);
                    
                    let gamesJoined = result[getModeKey('gamesJoined')] || 0;
                    let gamesStarted = result[getModeKey('gamesStarted')] || 0;
                    let matchesCompleted = result[getModeKey('matchesCompleted')] || 0;

                    if (match.joined) gamesJoined++;
                    if (match.started) gamesStarted++;
                    matchesCompleted++;

                    setObj[getModeKey('matchHistory')] = history;
                    setObj[getModeKey('gamesJoined')] = gamesJoined;
                    setObj[getModeKey('gamesStarted')] = gamesStarted;
                    setObj[getModeKey('matchesCompleted')] = matchesCompleted;
                }

                // Save the stats
                chrome.storage.sync.set(setObj, () => {
                    console.log('[SKMT] Match data saved:', {
                        mode,
                        quit: match.quit,
                        isSpecialMode: match.isSpecialMode,
                        isCustomMode: match.isCustomMode,
                        savedToHistory: !match.quit,
                        statsUpdated: !match.quit,
                        timeSpent: match.matchEndTime - match.matchStartTime
                    });

                    // Send message to popup with the updated data
                    chrome.runtime.sendMessage({
                        type: 'SKMT_MATCH_COMPLETE',
                        data: {
                            ...match,
                            mode: mode, // Add mode to the data
                            quit: match.quit // Ensure quit flag is included
                        }
                    }, () => {
                        if (chrome.runtime.lastError) {
                            console.error('[SKMT] Error sending message to popup:', chrome.runtime.lastError);
                        } else {
                            console.log('[SKMT] Successfully sent match data to popup:', {
                                mode,
                                quit: match.quit,
                                isSpecialMode: match.isSpecialMode,
                                isCustomMode: match.isCustomMode
                            });
                        }
                    });
                });
            });
        });
    } else if (event.data.type === 'SKMT_DEATHS_UPDATE') {
        console.log('[SKMT] Received deaths update:', event.data.deaths);
        hud.textContent = `Deaths: ${event.data.deaths}`;
        console.log('[SKMT] HUD: Deaths display updated to', event.data.deaths);
    } else if (event.data.type === 'SKMT_KILLSTREAK_UPDATE') {
        console.log('[SKMT] Received kill streak update:', event.data.killStreak);
        killStreakHud.textContent = `Kill Streak: ${event.data.killStreak}`;
        console.log('[SKMT] HUD: Kill streak display updated to', event.data.killStreak);
    } else if (event.data.type === 'SKMT_MATCH_COMPLETE') {
        console.log('[SKMT] Match complete, resetting HUD displays');
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
hud.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
hud.style.padding = '0.5em 1em';
hud.style.borderRadius = '0.5em';

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
    // Set display to block by default if not explicitly disabled
    hud.style.display = result.deathsHudEnabled !== false ? 'block' : 'none';
    killStreakHud.style.display = result.killStreakHudEnabled !== false ? 'block' : 'none';
    
    // Log the current state for debugging
    console.log('[SKMT] HUD states:', {
        deathsHud: hud.style.display,
        killStreakHud: killStreakHud.style.display,
        deathsHudEnabled: result.deathsHudEnabled,
        killStreakHudEnabled: result.killStreakHudEnabled
    });
});

// Listen for toggle from popup
chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'toggle-deaths-hud') {
        hud.style.display = msg.enabled ? 'block' : 'none';
        console.log('[SKMT] Deaths HUD toggled:', msg.enabled);
    } else if (msg.type === 'toggle-killstreak-hud') {
        killStreakHud.style.display = msg.enabled ? 'block' : 'none';
        console.log('[SKMT] Kill Streak HUD toggled:', msg.enabled);
    } else if (msg.type === 'toggle-kdr-hud') {
        kdrHud.style.display = msg.enabled ? 'block' : 'none';
        console.log('[SKMT] KDR HUD toggled:', msg.enabled);
    } else if (msg.type === 'toggle-matchcode-hud') {
        matchCodeHud.style.display = msg.enabled ? 'block' : 'none';
        console.log('[SKMT] Match Code HUD toggled:', msg.enabled);
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
killStreakHud.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
killStreakHud.style.padding = '0.5em 1em';
killStreakHud.style.borderRadius = '0.5em';

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

// Load HUD settings on initialization
chrome.storage.sync.get(['deathsHudSettings', 'killStreakHudSettings', 'kdrHudSettings'], (result) => {
    // Apply Deaths HUD settings
    if (result.deathsHudSettings) {
        applyHudSettings(hud, result.deathsHudSettings);
    } else {
        // Set default settings for Deaths HUD if none exist
        const defaultDeathsSettings = {
            fontSize: 32,
            fontColor: '#ffffff',
            fontFamily: 'Arial, sans-serif'
        };
        chrome.storage.sync.set({ deathsHudSettings: defaultDeathsSettings });
        applyHudSettings(hud, defaultDeathsSettings);
    }

    // Apply Kill Streak HUD settings
    if (result.killStreakHudSettings) {
        applyHudSettings(killStreakHud, result.killStreakHudSettings);
    } else {
        // Set default settings for Kill Streak HUD if none exist
        const defaultKillStreakSettings = {
            fontSize: 32,
            fontColor: '#ffffff',
            fontFamily: 'Arial, sans-serif'
        };
        chrome.storage.sync.set({ killStreakHudSettings: defaultKillStreakSettings });
        applyHudSettings(killStreakHud, defaultKillStreakSettings);
    }

    // Apply KDR HUD settings
    if (result.kdrHudSettings) {
        applyHudSettings(kdrHud, result.kdrHudSettings);
    } else {
        // Set default settings for KDR HUD if none exist
        const defaultKdrSettings = {
            fontSize: 32,
            fontColor: '#ffffff',
            fontFamily: 'Arial, sans-serif'
        };
        chrome.storage.sync.set({ kdrHudSettings: defaultKdrSettings });
        applyHudSettings(kdrHud, defaultKdrSettings);
    }
});

// Listen for HUD style updates
chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'update-deaths-hud-style') {
        applyHudSettings(hud, msg.settings);
        // Save settings immediately
        chrome.storage.sync.set({ deathsHudSettings: msg.settings });
    } else if (msg.type === 'update-killstreak-hud-style') {
        applyHudSettings(killStreakHud, msg.settings);
        // Save settings immediately
        chrome.storage.sync.set({ killStreakHudSettings: msg.settings });
    } else if (msg.type === 'update-kdr-hud-style') {
        applyHudSettings(kdrHud, msg.settings);
        // Save settings immediately
        chrome.storage.sync.set({ kdrHudSettings: msg.settings });
    }
});

function applyHudSettings(hudElement, settings) {
    if (!settings) return;
    
    hudElement.style.fontSize = `${settings.fontSize}px`;
    hudElement.style.color = settings.fontColor;
    hudElement.style.fontFamily = settings.fontFamily;
    hudElement.style.backgroundColor = settings.backgroundColor || 'rgba(0, 0, 0, 0.5)';
}

// HUD overlay for KDR
const kdrHud = document.createElement('div');
kdrHud.id = 'kdr-hud-overlay';
kdrHud.style.position = 'fixed';
kdrHud.style.top = '220px';
kdrHud.style.right = '40px';
kdrHud.style.zIndex = '999999';
kdrHud.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
kdrHud.style.fontWeight = '700';
kdrHud.style.fontSize = '32px';
kdrHud.style.color = '#fff';
kdrHud.style.textShadow = '2px 2px 4px rgba(0, 0, 0, 0.3)';
kdrHud.style.cursor = 'move';
kdrHud.style.userSelect = 'none';
kdrHud.style.display = 'none';
kdrHud.style.textRendering = 'optimizeLegibility';
kdrHud.style.webkitFontSmoothing = 'antialiased';
kdrHud.style.mozOsxFontSmoothing = 'grayscale';
kdrHud.style.letterSpacing = '0.5px';
kdrHud.textContent = 'KDR: 0.00';
kdrHud.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
kdrHud.style.padding = '0.5em 1em';
kdrHud.style.borderRadius = '0.5em';

// Make KDR HUD draggable
let isDraggingKDR = false;
let currentXKDR;
let currentYKDR;
let initialXKDR;
let initialYKDR;
let xOffsetKDR = 0;
let yOffsetKDR = 0;

// Load saved position for KDR HUD
chrome.storage.sync.get(['kdrHudPosition'], function(result) {
    if (result.kdrHudPosition) {
        xOffsetKDR = result.kdrHudPosition.x;
        yOffsetKDR = result.kdrHudPosition.y;
        setTranslateKDR(xOffsetKDR, yOffsetKDR, kdrHud);
    }
});

// Add KDR HUD to document
document.body.appendChild(kdrHud);

// KDR HUD drag event listeners
kdrHud.addEventListener('mousedown', dragStartKDR);
document.addEventListener('mousemove', dragKDR);
document.addEventListener('mouseup', dragEndKDR);

function dragStartKDR(e) {
    initialX = e.clientX - xOffsetKDR;
    initialY = e.clientY - yOffsetKDR;

    if (e.target === kdrHud) {
        isDraggingKDR = true;
    }
}

function dragKDR(e) {
    if (isDraggingKDR) {
        e.preventDefault();
        currentX = e.clientX - initialX;
        currentY = e.clientY - initialY;

        xOffsetKDR = currentX;
        yOffsetKDR = currentY;

        setTranslateKDR(currentX, currentY, kdrHud);
    }
}

function dragEndKDR(e) {
    initialX = currentX;
    initialY = currentY;
    isDraggingKDR = false;

    // Save position
    chrome.storage.sync.set({
        kdrHudPosition: {
            x: xOffsetKDR,
            y: yOffsetKDR
        }
    });
}

function setTranslateKDR(xPos, yPos, el) {
    el.style.transform = `translate3d(${xPos}px, ${yPos}px, 0)`;
}

// Initialize HUD states on page load
chrome.storage.sync.get(['deathsHudEnabled', 'killStreakHudEnabled', 'kdrHudEnabled'], (result) => {
    // Set display to block by default if not explicitly disabled
    hud.style.display = result.deathsHudEnabled !== false ? 'block' : 'none';
    killStreakHud.style.display = result.killStreakHudEnabled !== false ? 'block' : 'none';
    kdrHud.style.display = result.kdrHudEnabled !== false ? 'block' : 'none';
    
    // Log the current state for debugging
    console.log('[SKMT] HUD states:', {
        deathsHud: hud.style.display,
        killStreakHud: killStreakHud.style.display,
        kdrHud: kdrHud.style.display,
        deathsHudEnabled: result.deathsHudEnabled,
        killStreakHudEnabled: result.killStreakHudEnabled,
        kdrHudEnabled: result.kdrHudEnabled
    });
});

// Listen for toggle from popup
chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'toggle-deaths-hud') {
        hud.style.display = msg.enabled ? 'block' : 'none';
        console.log('[SKMT] Deaths HUD toggled:', msg.enabled);
    } else if (msg.type === 'toggle-killstreak-hud') {
        killStreakHud.style.display = msg.enabled ? 'block' : 'none';
        console.log('[SKMT] Kill Streak HUD toggled:', msg.enabled);
    } else if (msg.type === 'toggle-kdr-hud') {
        kdrHud.style.display = msg.enabled ? 'block' : 'none';
        console.log('[SKMT] KDR HUD toggled:', msg.enabled);
    } else if (msg.type === 'toggle-matchcode-hud') {
        matchCodeHud.style.display = msg.enabled ? 'block' : 'none';
        console.log('[SKMT] Match Code HUD toggled:', msg.enabled);
    }
});

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
    } else if (event.data.type === 'SKMT_KDR_UPDATE') {
        kdrHud.textContent = `KDR: ${event.data.kdr.toFixed(2)}`;
    } else if (event.data.type === 'SKMT_MATCH_COMPLETE') {
        hud.textContent = 'Deaths: 0';
        killStreakHud.textContent = 'Kill Streak: 0';
        kdrHud.textContent = 'KDR: 0.00';
    }
});

// HUD overlay for Custom Match Code
const matchCodeHud = document.createElement('div');
matchCodeHud.id = 'match-code-hud-overlay';
matchCodeHud.style.position = 'fixed';
matchCodeHud.style.top = '280px';
matchCodeHud.style.right = '40px';
matchCodeHud.style.zIndex = '999999';
matchCodeHud.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
matchCodeHud.style.fontWeight = '700';
matchCodeHud.style.fontSize = '32px';
matchCodeHud.style.color = '#fff';
matchCodeHud.style.textShadow = '2px 2px 4px rgba(0, 0, 0, 0.3)';
matchCodeHud.style.cursor = 'move';
matchCodeHud.style.userSelect = 'none';
matchCodeHud.style.display = 'none';
matchCodeHud.style.textRendering = 'optimizeLegibility';
matchCodeHud.style.webkitFontSmoothing = 'antialiased';
matchCodeHud.style.mozOsxFontSmoothing = 'grayscale';
matchCodeHud.style.letterSpacing = '0.5px';
matchCodeHud.textContent = 'Code: ';
matchCodeHud.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
matchCodeHud.style.padding = '0.5em 1em';
matchCodeHud.style.borderRadius = '0.5em';

// Make Match Code HUD draggable
let isDraggingMC = false;
let currentXMC;
let currentYMC;
let initialXMC;
let initialYMC;
let xOffsetMC = 0;
let yOffsetMC = 0;

// Load saved position for Match Code HUD
chrome.storage.sync.get(['matchCodeHudPosition'], function(result) {
    if (result.matchCodeHudPosition) {
        xOffsetMC = result.matchCodeHudPosition.x;
        yOffsetMC = result.matchCodeHudPosition.y;
        setTranslateMC(xOffsetMC, yOffsetMC, matchCodeHud);
    }
});

// Add Match Code HUD to document
document.body.appendChild(matchCodeHud);

// Match Code HUD drag functions
function dragStartMC(e) {
    if (e.type === "touchstart") {
        initialX = e.touches[0].clientX - xOffsetMC;
        initialY = e.touches[0].clientY - yOffsetMC;
    } else {
        initialX = e.clientX - xOffsetMC;
        initialY = e.clientY - yOffsetMC;
    }

    if (e.target === matchCodeHud) {
        isDraggingMC = true;
    }
}

function dragMC(e) {
    if (isDraggingMC) {
        e.preventDefault();

        if (e.type === "touchmove") {
            currentX = e.touches[0].clientX - initialX;
            currentY = e.touches[0].clientY - initialY;
        } else {
            currentX = e.clientX - initialX;
            currentY = e.clientY - initialY;
        }

        xOffsetMC = currentX;
        yOffsetMC = currentY;

        setTranslateMC(currentX, currentY, matchCodeHud);
    }
}

function setTranslateMC(xPos, yPos, el) {
    el.style.transform = `translate3d(${xPos}px, ${yPos}px, 0)`;
}

function dragEndMC(e) {
    initialX = currentX;
    initialY = currentY;
    isDraggingMC = false;

    // Save position
    chrome.storage.sync.set({
        matchCodeHudPosition: {
            x: xOffsetMC,
            y: yOffsetMC
        }
    });
}

// Add event listeners for Match Code HUD
matchCodeHud.addEventListener("touchstart", dragStartMC, false);
matchCodeHud.addEventListener("touchend", dragEndMC, false);
matchCodeHud.addEventListener("touchmove", dragMC, false);
matchCodeHud.addEventListener("mousedown", dragStartMC, false);
matchCodeHud.addEventListener("mouseup", dragEndMC, false);
matchCodeHud.addEventListener("mousemove", dragMC, false);

// Initialize HUD states on page load
chrome.storage.sync.get(['deathsHudEnabled', 'killStreakHudEnabled', 'kdrHudEnabled', 'matchCodeHudEnabled'], (result) => {
    // Set display to block by default if not explicitly disabled
    hud.style.display = result.deathsHudEnabled !== false ? 'block' : 'none';
    killStreakHud.style.display = result.killStreakHudEnabled !== false ? 'block' : 'none';
    kdrHud.style.display = result.kdrHudEnabled !== false ? 'block' : 'none';
    matchCodeHud.style.display = result.matchCodeHudEnabled !== false ? 'block' : 'none';
    
    // Log the current state for debugging
    console.log('[SKMT] HUD states:', {
        deathsHud: hud.style.display,
        killStreakHud: killStreakHud.style.display,
        kdrHud: kdrHud.style.display,
        matchCodeHud: matchCodeHud.style.display,
        deathsHudEnabled: result.deathsHudEnabled,
        killStreakHudEnabled: result.killStreakHudEnabled,
        kdrHudEnabled: result.kdrHudEnabled,
        matchCodeHudEnabled: result.matchCodeHudEnabled
    });
});

// Load HUD settings on initialization
chrome.storage.sync.get(['deathsHudSettings', 'killStreakHudSettings', 'kdrHudSettings', 'matchCodeHudSettings'], (result) => {
    // ... existing settings code ...

    // Apply Match Code HUD settings
    if (result.matchCodeHudSettings) {
        applyHudSettings(matchCodeHud, result.matchCodeHudSettings);
    } else {
        // Set default settings for Match Code HUD if none exist
        const defaultMatchCodeSettings = {
            fontSize: 32,
            fontColor: '#ffffff',
            fontFamily: 'Arial, sans-serif'
        };
        chrome.storage.sync.set({ matchCodeHudSettings: defaultMatchCodeSettings });
        applyHudSettings(matchCodeHud, defaultMatchCodeSettings);
    }
});

// Listen for HUD style updates
chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'update-deaths-hud-style') {
        applyHudSettings(hud, msg.settings);
        // Save settings immediately
        chrome.storage.sync.set({ deathsHudSettings: msg.settings });
    } else if (msg.type === 'update-killstreak-hud-style') {
        applyHudSettings(killStreakHud, msg.settings);
        // Save settings immediately
        chrome.storage.sync.set({ killStreakHudSettings: msg.settings });
    } else if (msg.type === 'update-kdr-hud-style') {
        applyHudSettings(kdrHud, msg.settings);
        // Save settings immediately
        chrome.storage.sync.set({ kdrHudSettings: msg.settings });
    } else if (msg.type === 'update-matchcode-hud-style') {
        applyHudSettings(matchCodeHud, msg.settings);
        // Save settings immediately
        chrome.storage.sync.set({ matchCodeHudSettings: msg.settings });
    }
});

// Listen for messages from the injected script
window.addEventListener('message', function(event) {
    if (event.data && typeof event.data === 'object') {
        switch (event.data.type) {
            case 'SKMT_KILLSTREAK_UPDATE':
                if (killStreakHud) {
                    killStreakHud.textContent = `Kill Streak: ${event.data.killStreak}`;
                }
                break;
            case 'SKMT_DEATHS_UPDATE':
                if (hud) {
                    hud.textContent = `Deaths: ${event.data.deaths}`;
                }
                break;
            case 'SKMT_KDR_UPDATE':
                if (kdrHud) {
                    kdrHud.textContent = `KDR: ${event.data.kdr.toFixed(2)}`;
                }
                break;
            case 'SKMT_MATCH_CODE_UPDATE':
                if (matchCodeHud) {
                    matchCodeHud.textContent = event.data.code ? `Code: ${event.data.code}` : 'Code: ';
                }
                break;
        }
    }
});