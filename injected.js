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
    skid: null
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
        // Print every intercepted message
        try { originalLog('[SKMT] Intercepted:', method, ...args); } catch(e){}
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
            if (msg.includes('bytebrew: sending custom event: play_special_mode')) {
                window.kartStats.isSpecialMode = true;
            }

            // Detect custom match creation/join
            if (
                msg.includes('bytebrew: sending custom event: create_game_rules') ||
                msg.includes('bytebrew: sending custom event: create_game_weapons') ||
                msg.includes('bytebrew: sending custom event: create_game_level') ||
                msg.includes('bytebrew: sending custom event: create_game_mode') ||
                msg.includes('bytebrew: sending custom event: join_or_create_private_mode') ||
                msg.includes('bytebrew: sending custom event: join_or_create_private_arena')
            ) {
                window.kartStats.isCustomMode = true;
            }

            // Handle game end (new logic)
            if (msg.includes('bytebrew: sending custom event: game_end') || msg.includes('bytebrew: sending custom event: confirmexitgame')) {
                if (window.kartStats.matchActive) {
                    window.kartStats.matchEndTime = Date.now();
                    if (msg.includes('confirmexitgame')) window.kartStats.quit = true;
                    window.postMessage({
                        type: 'SKMT_MATCH_COMPLETE',
                        data: {
                            kills: window.kartStats.kills,
                            deaths: window.kartStats.deaths,
                            matchStartTime: window.kartStats.matchStartTime,
                            matchEndTime: window.kartStats.matchEndTime,
                            isSpecialMode: window.kartStats.isSpecialMode,
                            isCustomMode: window.kartStats.isCustomMode,
                            joined: window.kartStats.joined,
                            started: window.kartStats.started,
                            quit: window.kartStats.quit
                        }
                    }, '*');
                    resetStats();
                    window.kartStats.awaitingStartType = true;
                }
            }

            // Handle joined_room/start_game only if awaiting start type
            if (window.kartStats.awaitingStartType) {
                if (msg.includes('bytebrew: sending custom event: joined_room')) {
                    window.kartStats.kills = 0;
                    window.kartStats.deaths = 0;
                    window.kartStats.matchActive = true;
                    window.kartStats.matchStartTime = Date.now();
                    window.kartStats.joined = true;
                    window.kartStats.started = false;
                    window.kartStats.quit = false;
                    window.kartStats.awaitingStartType = false;
                } else if (msg.includes('bytebrew: sending custom event: start_game')) {
                    window.kartStats.kills = 0;
                    window.kartStats.deaths = 0;
                    window.kartStats.matchActive = true;
                    window.kartStats.matchStartTime = Date.now();
                    window.kartStats.started = true;
                    window.kartStats.joined = false;
                    window.kartStats.quit = false;
                    window.kartStats.awaitingStartType = false;
                }
            }

            // Track kills and deaths only if match is active
            if (window.kartStats.matchActive) {
                if (msg.includes('destroyed_human')) {
                    window.kartStats.kills++;
                }
                if (msg.includes('destroyed_by_human') || msg.includes('destroyed_by_bot')) {
                    window.kartStats.deaths++;
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
    window.kartStats.isSpecialMode = false;
    window.kartStats.isCustomMode = false;
    window.kartStats.joined = false;
    window.kartStats.started = false;
    window.kartStats.quit = false;
    window.kartStats._pendingGameEnd = false;
    window.kartStats._successLogCount = 0;
    if (window.kartStats._gameEndTimeout) clearTimeout(window.kartStats._gameEndTimeout);
    window.kartStats._gameEndTimeout = null;
    // Do not reset awaitingStartType here; it is managed in the main logic
} 