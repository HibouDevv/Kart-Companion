console.log('[SKMT] Injected script running');
const originalLog = console.log;
const originalInfo = console.info;
const originalWarn = console.warn;
const originalError = console.error;
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
    sawStartGame: false
};

function setSkid(skid) {
    if (skid && typeof skid === 'string' && skid.length > 5) {
        window.kartStats.skid = skid;
        console.log('[SKMT] SKID detected and set:', skid);
        window.postMessage({ type: 'SKMT_SKID_UPDATED', skid }, '*');
    }
}

function interceptConsole(method, original) {
    return function(...args) {
        if (args[0] && typeof args[0] === 'string') {
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

            // Handle special mode exit
            if (msg.includes('bytebrew: sending custom event: confirmexitgame')) {
                // Removed the incorrect early reset here. The reset will happen after match data is captured.
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
                window.kartStats.isSpecialMode = false; // Set special mode to false when entering custom mode
                console.log('[SKMT][CUSTOM] Custom event detected. isCustomMode set to true, isSpecialMode set to false.');
            }

            // Handle game end (new logic)
            if (msg.includes('bytebrew: sending custom event: game_end') || msg.includes('bytebrew: sending custom event: confirmexitgame')) {
                if (window.kartStats.matchActive) {
                    // Capture current mode flags *before* any reset within this handler
                    const endedInSpecialMode = window.kartStats.isSpecialMode;
                    const endedInCustomMode = window.kartStats.isCustomMode;

                    window.kartStats.matchEndTime = Date.now();
                    if (msg.includes('confirmexitgame')) {
                         window.kartStats.quit = true;
                         // *** NEW PLACEMENT: Set special mode to false here, AFTER capturing flags for match data ***
                         window.kartStats.isSpecialMode = false; // Reset special mode on explicit exit confirmation
                    }

                    // Set joined/started flags for this match according to the rules
                    let joined = false, started = false;
                    if (window.kartStats.sawJoinedRoom && !window.kartStats.sawStartGame) {
                        joined = true;
                    } else if (window.kartStats.sawStartGame && !window.kartStats.sawJoinedRoom) {
                        started = true;
                    } else if (window.kartStats.sawStartGame && window.kartStats.sawJoinedRoom) {
                        started = true;
                    }

                    // Capture the match data *before* resetting stats
                    const matchObj = {
                        kills: window.kartStats.kills,
                        deaths: window.kartStats.deaths,
                        matchStartTime: window.kartStats.matchStartTime,
                        matchEndTime: window.kartStats.matchEndTime,
                        isSpecialMode: endedInSpecialMode, // Use captured value
                        isCustomMode: endedInCustomMode, // Use captured value
                        joined: joined,
                        started: started,
                        quit: window.kartStats.quit,
                        killTimestamps: window.kartStats.killTimestamps, // These are reset in resetStats
                        deathTimestamps: window.kartStats.deathTimestamps // These are reset in resetStats
                    };
                    console.log('[SKMT][DEBUG] Posting match complete:', matchObj);
                    window.postMessage({
                        type: 'SKMT_MATCH_COMPLETE',
                        data: matchObj
                    }, '*');

                    // Reset flags after match complete
                    window.kartStats.sawJoinedRoom = false;
                    window.kartStats.sawStartGame = false;

                    // Now reset other stats
                    resetStats();
                    // isCustomMode is reset when entering other modes.
                    window.kartStats.awaitingStartType = true;

                    console.log('[SKMT][DEBUG] Game end/exit handler completed posting message and resetting state.');
                }
            }

            // Handle joined_room/start_game only if awaiting start type
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
                } else if (msg.includes('bytebrew: sending custom event: start_game')) {
                    // If we are starting a game and it's not already marked as special or custom, assume normal mode
                    if (!window.kartStats.isSpecialMode && !window.kartStats.isCustomMode) {
                         window.kartStats.isSpecialMode = false; // Explicitly set to false for normal mode
                    }
                    window.kartStats.kills = 0;
                    window.kartStats.deaths = 0;
                    window.kartStats.matchActive = true;
                    window.kartStats.matchStartTime = Date.now();
                    window.kartStats.started = true;
                    window.kartStats.joined = false; // Assuming 'start_game' means you started, not joined mid-round
                    window.kartStats.quit = false;
                    window.kartStats.awaitingStartType = false;
                    window.kartStats.sawStartGame = true;
                }
            }

            // Track kills and deaths only if match is active
            if (window.kartStats.matchActive) {
                if (msg.includes('destroyed_human')) {
                    window.kartStats.kills++;
                    window.kartStats.killTimestamps.push(Date.now());
                }
                if (msg.includes('destroyed_by_human') || msg.includes('destroyed_by_bot')) {
                    window.kartStats.deaths++;
                    window.kartStats.deathTimestamps.push(Date.now());
                    window.postMessage({ type: 'SKMT_DEATHS_UPDATE', deaths: window.kartStats.deaths }, '*');
                }
            }
        }
        original.apply(console, args);
    };
}

console.log = interceptConsole('log', originalLog);
console.info = interceptConsole('info', originalInfo);
console.warn = interceptConsole('warn', originalWarn);
console.error = interceptConsole('error', originalError);

// Helper function to reset stats
function resetStats() {
    window.kartStats.kills = 0;
    window.kartStats.deaths = 0;
    window.kartStats.matchActive = false;
    window.kartStats.matchStartTime = null;
    window.kartStats.matchEndTime = null;
    // Do NOT reset isSpecialMode or isCustomMode here!
    window.kartStats.joined = false;
    window.kartStats.started = false;
    window.kartStats.quit = false;
    window.kartStats._pendingGameEnd = false;
    window.kartStats._successLogCount = 0;
    window.kartStats.killTimestamps = [];
    window.kartStats.deathTimestamps = [];
    if (window.kartStats._gameEndTimeout) clearTimeout(window.kartStats._gameEndTimeout);
    window.kartStats._gameEndTimeout = null;
    // Do not reset awaitingStartType here; it is managed in the main logic
} 