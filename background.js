(()=>{
    const firebaseConfig = {
        // Firebase configuration should be loaded from environment variables or a secure config file
        apiKey: process.env.FIREBASE_API_KEY,
        authDomain: process.env.FIREBASE_AUTH_DOMAIN,
        projectId: process.env.FIREBASE_PROJECT_ID,
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
        messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
        appId: process.env.FIREBASE_APP_ID
    };

    let db = null;
    try {
        firebase.initializeApp(firebaseConfig);
        db = firebase.firestore();
    } catch (error) {
        console.error("Error initializing Firebase:", error);
    }

    // Store match data in Firebase
    async function storeMatchData(matchData) {
        if (!db) return;
        
        try {
            // Only store non-special mode matches in the main collection
            if (!matchData.isSpecialMode) {
                const matchRef = db.collection('matches').doc();
                await matchRef.set({
                    ...matchData,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp()
                });

                // Update player statistics
                await updatePlayerStats(matchData.playerStats);
            } else {
                // Store special mode matches in a separate collection
                const specialMatchRef = db.collection('special_matches').doc();
                await specialMatchRef.set({
                    ...matchData,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp()
                });
            }
        } catch (error) {
            console.error('Error storing match data:', error);
        }
    }

    // Update player statistics in Firebase
    async function updatePlayerStats(playerStats) {
        if (!db) return;
        
        try {
            const playerRef = db.collection('players').doc(playerStats.skid);
            
            // Get current player stats
            const playerDoc = await playerRef.get();
            const currentStats = playerDoc.exists ? playerDoc.data() : {
                totalMatches: 0,
                totalKills: 0,
                totalDeaths: 0,
                totalPowerUpsCollected: 0,
                totalPowerUpsUsed: 0,
                bestSmashStreak: 0,
                specialModeMatches: 0
            };

            // Update statistics
            const updatedStats = {
                totalMatches: currentStats.totalMatches + 1,
                totalKills: currentStats.totalKills + playerStats.kills,
                totalDeaths: currentStats.totalDeaths + playerStats.deaths,
                totalPowerUpsCollected: currentStats.totalPowerUpsCollected + playerStats.powerUpsCollected,
                totalPowerUpsUsed: currentStats.totalPowerUpsUsed + playerStats.powerUpsUsed,
                bestSmashStreak: Math.max(currentStats.bestSmashStreak, 
                    Math.max(...playerStats.smashStreaks.map(streak => streak.type)))
            };

            await playerRef.set(updatedStats, { merge: true });
        } catch (error) {
            console.error('Error updating player stats:', error);
        }
    }

    // Listen for messages from content script
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.type === 'matchComplete') {
            storeMatchData(message.data);
        } else if (message.type === 'OPEN_VISUALIZERS') {
            console.log('[SKMT] Opening visualizers page');
            try {
                const visualizersUrl = chrome.runtime.getURL('visualizers.html');
                console.log('[SKMT] Visualizers URL:', visualizersUrl);
                
                chrome.tabs.create({ 
                    url: visualizersUrl,
                    active: true
                }, (tab) => {
                    if (chrome.runtime.lastError) {
                        console.error('[SKMT] Error creating tab:', chrome.runtime.lastError);
                        sendResponse({ success: false, error: chrome.runtime.lastError.message });
                    } else {
                        console.log('[SKMT] Visualizers page opened successfully in tab:', tab.id);
                        sendResponse({ success: true, tabId: tab.id });
                    }
                });
                return true; // Keep the message channel open for the async response
            } catch (error) {
                console.error('[SKMT] Error in OPEN_VISUALIZERS handler:', error);
                sendResponse({ success: false, error: error.message });
                return false;
            }
        }
    });

    // Handle extension installation
    chrome.runtime.onInstalled.addListener(() => {
        // Initialize extension storage
        chrome.storage.local.set({
            settings: {
                enableTracking: true,
                showNotifications: true
            }
        });
    });

    // Handle extension updates
    chrome.runtime.onUpdateAvailable.addListener(() => {
        chrome.runtime.reload();
    });
})(); 