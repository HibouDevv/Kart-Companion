// Import Firebase modules
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCtkDvbYbosr5ZhTh9g3VO1q7Fe45KvAqg",
  authDomain: "smash-karts-match-tracker.firebaseapp.com",
  projectId: "smash-karts-match-tracker",
  storageBucket: "smash-karts-match-tracker.firebasestorage.app",
  messagingSenderId: "324411303245",
  appId: "1:324411303245:web:caccc3059a3f929b7f0304"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Store match data in Firebase
async function storeMatchData(matchData) {
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