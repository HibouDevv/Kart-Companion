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
    joinedFirst: null
};

let collectingPlayerLogs = false;
let currentPlayerLogLines = [];

function setSkid(skid) {
    if (skid && typeof skid === 'string' && skid.length > 5) {
        window.kartStats.skid = skid;
        originalLog('[SKMT] SKID detected and set:', skid);
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
            // Detect SKID from GameDataService log (fallback)
            if (msg.includes('gamedataservice::getgamedatafromserverfirstload')) {
                const parts = args[0].trim().split(' ');
                const skid = parts[parts.length - 1];
                setSkid(skid.trim());
            }

            // Handle special mode
            if (msg.includes('bytebrew: sending custom event: play_special_mode') ||
                msg.includes('bytebrew: sending custom event: play_special_mode_rules') ||
                msg.includes('bytebrew: sending custom event: play_special_mode_arena')) {
                window.kartStats.isSpecialMode = true;
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
            }

            // Handle game end
            if (msg.includes('bytebrew: sending custom event: game_end') || msg.includes('bytebrew: sending custom event: confirmexitgame')) {
                // Always capture match data if we have any stats
                if (window.kartStats.matchActive || window.kartStats.kills > 0 || window.kartStats.deaths > 0 || window.kartStats.matchStartTime) {
                    // Reset HUD overlays
                    window.postMessage({ type: 'SKMT_DEATHS_UPDATE', deaths: 0 }, '*');
                    window.kartStats.killStreak = 0;
                    window.postMessage({ type: 'SKMT_KILLSTREAK_UPDATE', killStreak: 0 }, '*');
                    
                    // Capture current mode flags
                    const endedInSpecialMode = window.kartStats.isSpecialMode;
                    const endedInCustomMode = window.kartStats.isCustomMode;

                    window.kartStats.matchEndTime = Date.now();
                    if (msg.includes('confirmexitgame')) {
                        window.kartStats.quit = true;
                        window.kartStats.isSpecialMode = false;
                    }

                    // Set joined/started flags
                    let joined = false, started = false;
                    if (window.kartStats.joinedFirst) {
                        joined = true;
                    } else {
                        started = true;
                    }

                    // Capture match data
                    const matchObj = {
                        kills: window.kartStats.kills,
                        deaths: window.kartStats.deaths,
                        matchStartTime: window.kartStats.matchStartTime,
                        matchEndTime: window.kartStats.matchEndTime,
                        isSpecialMode: endedInSpecialMode,
                        isCustomMode: endedInCustomMode,
                        joined: joined,
                        started: started,
                        quit: window.kartStats.quit,
                        killTimestamps: [...window.kartStats.killTimestamps],
                        deathTimestamps: [...window.kartStats.deathTimestamps],
                        logs: [...currentPlayerLogLines]
                    };
                    
                    window.postMessage({
                        type: 'SKMT_MATCH_COMPLETE',
                        data: matchObj
                    }, '*');
                }

                // Reset all stats and flags
                resetStats();
            }

            // Handle joined_room/start_game
            if (window.kartStats.awaitingStartType) {
                if (msg.includes('bytebrew: sending custom event: joined_room')) {
                    if (!window.kartStats.matchActive) {
                        window.kartStats.joined = true;
                        window.kartStats.kills = 0;
                        window.kartStats.deaths = 0;
                        window.kartStats.matchActive = true;
                        window.kartStats.matchStartTime = Date.now();
                        window.kartStats.started = false;
                        window.kartStats.quit = false;
                        window.postMessage({ type: 'SKMT_JOINED_ROOM' }, '*');
                    }
                    window.kartStats.sawJoinedRoom = true;
                    window.kartStats.sawStartGame = false;
                    if (window.kartStats.joinedFirst === null) {
                        window.kartStats.joinedFirst = true;
                    }
                } else if (msg.includes('bytebrew: sending custom event: start_game')) {
                    if (!window.kartStats.isSpecialMode && !window.kartStats.isCustomMode) {
                        window.kartStats.isSpecialMode = false;
                    }
                    window.kartStats.kills = 0;
                    window.kartStats.deaths = 0;
                    window.kartStats.matchActive = true;
                    window.kartStats.matchStartTime = Date.now();
                    window.kartStats.started = true;
                    window.kartStats.joined = false;
                    window.kartStats.quit = false;
                    window.kartStats.awaitingStartType = false;
                    window.kartStats.sawStartGame = true;
                    if (window.kartStats.joinedFirst === null) {
                        window.kartStats.joinedFirst = false;
                    }
                }
            }

            // Track kills and deaths
            if (window.kartStats.matchActive) {
                if (msg.includes('destroyed_human')) {
                    window.kartStats.kills++;
                    window.kartStats.killTimestamps.push(Date.now());
                    window.kartStats.killStreak++;
                    window.postMessage({ type: 'SKMT_KILLSTREAK_UPDATE', killStreak: window.kartStats.killStreak }, '*');
                }
                if (msg.includes('destroyed_by_human') || msg.includes('destroyed_by_bot')) {
                    window.kartStats.deaths++;
                    window.kartStats.deathTimestamps.push(Date.now());
                    window.kartStats.killStreak = 0;
                    window.postMessage({ type: 'SKMT_DEATHS_UPDATE', deaths: window.kartStats.deaths }, '*');
                    window.postMessage({ type: 'SKMT_KILLSTREAK_UPDATE', killStreak: 0 }, '*');
                }
            }

            // Handle player log collection
            if (msg.includes('bytebrew: sending custom event: joined_room') || msg.includes('bytebrew: sending custom event: start_game')) {
                collectingPlayerLogs = true;
                currentPlayerLogLines = [];
            }
            if (msg.includes('bytebrew: sending custom event: game_end') || msg.includes('bytebrew: sending custom event: confirmexitgame')) {
                collectingPlayerLogs = false;
            }
            if (
                collectingPlayerLogs &&
                (args[0].includes('Vehicle Setup: VehicleCharacter - setting new head position -') ||
                 args[0].includes('Vehicle Setup: VehicleCharacter - setting original head position -'))
            ) {
                currentPlayerLogLines.push(args[0]);
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
    if (window.kartStats._gameEndTimeout) clearTimeout(window.kartStats._gameEndTimeout);
    window.kartStats._gameEndTimeout = null;
    // Do not reset isSpecialMode or isCustomMode here
} 