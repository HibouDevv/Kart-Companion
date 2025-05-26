console.log('[SKMT] Injected script running');

// Add a global event listener for game events
window.addEventListener('message', function(event) {
    if (event.data && typeof event.data === 'object') {
        console.log('[SKMT][INJECTED] Received message:', event.data);
    }
});

const originalLog = console.log;
const originalInfo = console.info;
const originalWarn = console.warn;
const originalError = console.error;

// Flag to prevent recursive logging
let isIntercepting = false;

window.kartStats = {
    kills: 0,
    deaths: 0,
    matchActive: false,
    matchStartTime: null,
    matchEndTime: null,
    isSpecialMode: false,
    isCustomMode: false,
    joined: false,
    started: false,
    quit: false,
    awaitingStartType: true,
    _pendingGameEnd: false,
    _successLogCount: 0,
    _gameEndTimeout: null,
    skid: null,
    killTimestamps: [],
    deathTimestamps: [],
    sawJoinedRoom: false,
    sawStartGame: false,
    killStreak: 0,
    joinedFirst: null,
    players: []
};

let collectingPlayerLogs = false;
let currentPlayerLogLines = [];

function setSkid(skid) {
    if (skid && typeof skid === 'string' && skid.length > 5) {
        window.kartStats.skid = skid;
        originalLog('[SKMT] SKID set:', skid);
        window.postMessage({ type: 'SKMT_SKID_UPDATED', skid }, '*');
    }
}

function interceptConsole(method, original) {
    return function(...args) {
        if (isIntercepting) {
            return original.apply(console, args);
        }

        if (args[0] && typeof args[0] === 'string') {
            isIntercepting = true;
            const msg = args[0].toLowerCase();

            // Detect SKID from AuthStateChanged log
            if (msg.includes('authstatechanged, uid:')) {
                const match = args[0].match(/uid:\s*([^,\s]+)/i);
                if (match && match[1]) {
                    setSkid(match[1].trim());
                }
            }

            // Handle special mode
            if (msg.includes('bytebrew: sending custom event: play_special_mode') ||
                msg.includes('bytebrew: sending custom event: play_special_mode_rules') ||
                msg.includes('bytebrew: sending custom event: play_special_mode_arena')) {
                window.kartStats.isSpecialMode = true;
                window.kartStats.isCustomMode = false;
                originalLog('[SKMT] Mode: Special mode detected');
            }

            // Custom mode: ON for any custom event
            if (
                msg.includes('bytebrew: sending custom event: create_game_rules') ||
                msg.includes('bytebrew: sending custom event: create_game_weapons') ||
                msg.includes('bytebrew: sending custom event: create_game_level') ||
                msg.includes('bytebrew: sending custom event: create_game_mode') ||
                msg.includes('bytebrew: sending custom event: join_or_create_private_mode') ||
                msg.includes('bytebrew: sending custom event: join_or_create_private_arena')
            ) {
                window.kartStats.isCustomMode = true;
                window.kartStats.isSpecialMode = false;
                originalLog('[SKMT] Mode: Custom mode detected');
            }

            // Handle game state changes
            if (msg.includes('bytebrew: sending custom event: joined_room')) {
                window.kartStats.joined = true;
                window.kartStats.matchActive = false;
                window.kartStats.matchStartTime = null;
                window.kartStats.matchEndTime = null;
                originalLog('[SKMT] Game joined');
                window.postMessage({ type: 'SKMT_STATUS_UPDATE', status: 'joined' }, '*');
            }
            if (msg.includes('bytebrew: sending custom event: start_game')) {
                window.kartStats.started = true;
                window.kartStats.matchActive = true;
                window.kartStats.matchStartTime = Date.now();
                originalLog('[SKMT] Game started');
                window.postMessage({ type: 'SKMT_STATUS_UPDATE', status: 'started' }, '*');
            }
            if (msg.includes('bytebrew: sending custom event: game_end') || 
                msg.includes('bytebrew: sending custom event: confirmexitgame')) {
                if (window.kartStats.matchActive) {
                    window.kartStats.matchEndTime = Date.now();
                    window.kartStats.matchActive = false;
                    
                    // Only reset modes when explicitly quitting
                    if (msg.includes('confirmexitgame')) {
                        window.kartStats.quit = true;
                        window.kartStats.isSpecialMode = false;
                        window.kartStats.isCustomMode = false;
                        originalLog('[SKMT] Mode: Reset to normal');
                    }
                    
                    // Capture match data
                    const matchObj = {
                        kills: window.kartStats.kills,
                        deaths: window.kartStats.deaths,
                        matchStartTime: window.kartStats.matchStartTime,
                        matchEndTime: window.kartStats.matchEndTime,
                        isSpecialMode: window.kartStats.isSpecialMode,
                        isCustomMode: window.kartStats.isCustomMode,
                        joined: window.kartStats.joined,
                        started: window.kartStats.started,
                        quit: window.kartStats.quit,
                        killTimestamps: [...window.kartStats.killTimestamps],
                        deathTimestamps: [...window.kartStats.deathTimestamps],
                        players: window.kartStats.players || []
                    };
                    
                    // Log comprehensive stats
                    originalLog('[SKMT] Match stats:', {
                        kills: matchObj.kills,
                        deaths: matchObj.deaths,
                        killStreak: window.kartStats.killStreak,
                        mode: matchObj.isCustomMode ? 'custom' : (matchObj.isSpecialMode ? 'special' : 'normal'),
                        joined: matchObj.joined,
                        started: matchObj.started,
                        quit: matchObj.quit,
                        duration: matchObj.matchEndTime - matchObj.matchStartTime,
                        players: matchObj.players
                    });
                    
                    window.postMessage({
                        type: 'SKMT_MATCH_COMPLETE',
                        data: matchObj
                    }, '*');
                    
                    // Reset stats after sending match data
                    resetStats();
                }
            }

            // Track kills and deaths
            if (window.kartStats.matchActive) {
                if (msg.includes('destroyed_human')) {
                    window.kartStats.kills++;
                    window.kartStats.killTimestamps.push(Date.now());
                    window.kartStats.killStreak++;
                    originalLog('[SKMT] HUD: Kill streak updated to', window.kartStats.killStreak);
                    window.postMessage({ type: 'SKMT_KILLSTREAK_UPDATE', killStreak: window.kartStats.killStreak }, '*');
                }
                if (msg.includes('destroyed_by_human') || msg.includes('destroyed_by_bot')) {
                    window.kartStats.deaths++;
                    window.kartStats.deathTimestamps.push(Date.now());
                    window.kartStats.killStreak = 0;
                    originalLog('[SKMT] HUD: Deaths updated to', window.kartStats.deaths);
                    window.postMessage({ type: 'SKMT_DEATHS_UPDATE', deaths: window.kartStats.deaths }, '*');
                    window.postMessage({ type: 'SKMT_KILLSTREAK_UPDATE', killStreak: 0 }, '*');
                }
            }

            // Track players
            if (msg.includes('Vehicle Setup: VehicleCharacter - setting new head position -') ||
                msg.includes('Vehicle Setup: VehicleCharacter - setting original head position -')) {
                const playerMatch = args[0].match(/Vehicle Setup: VehicleCharacter - setting (?:new|original) head position - ([^\n]+)/);
                if (playerMatch && playerMatch[1]) {
                    const playerName = playerMatch[1].trim();
                    if (!window.kartStats.players) {
                        window.kartStats.players = [];
                    }
                    if (!window.kartStats.players.includes(playerName)) {
                        window.kartStats.players.push(playerName);
                        originalLog('[SKMT] Player detected:', playerName);
                    }
                }
            }

            isIntercepting = false;
        }
        return original.apply(console, args);
    };
}

console.log = interceptConsole('log', originalLog);
console.info = interceptConsole('info', originalInfo);
console.warn = interceptConsole('warn', originalWarn);
console.error = interceptConsole('error', originalError);

function resetStats() {
    window.kartStats.kills = 0;
    window.kartStats.deaths = 0;
    window.kartStats.matchActive = false;
    window.kartStats.matchStartTime = null;
    window.kartStats.matchEndTime = null;
    window.kartStats.killStreak = 0;
    window.kartStats.joinedFirst = null;
    window.kartStats.joined = false;
    window.kartStats.started = false;
    window.kartStats.quit = false;
    window.kartStats._pendingGameEnd = false;
    window.kartStats._successLogCount = 0;
    window.kartStats.killTimestamps = [];
    window.kartStats.deathTimestamps = [];
    window.kartStats.sawJoinedRoom = false;
    window.kartStats.sawStartGame = false;
    window.kartStats.awaitingStartType = true;
    window.kartStats.players = [];
    if (window.kartStats._gameEndTimeout) clearTimeout(window.kartStats._gameEndTimeout);
    window.kartStats._gameEndTimeout = null;
    // Do not reset isSpecialMode or isCustomMode here
} 