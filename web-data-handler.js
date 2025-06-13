// Function to get data from localStorage
function getWebPageData() {
    try {
        // Try to get individual components first
        const stats = JSON.parse(localStorage.getItem('kartCompanionStats') || '{}');
        const matchHistory = JSON.parse(localStorage.getItem('kartCompanionMatchHistory') || '{}');
        const currentSkid = localStorage.getItem('kartCompanionCurrentSkid') || 'Default';
        const uiState = JSON.parse(localStorage.getItem('kartCompanionUIState') || '{}');

        // If individual components exist, use them
        if (Object.keys(stats).length > 0 || Object.keys(matchHistory).length > 0) {
            return {
                stats,
                matchHistory,
                currentSkid,
                uiState
            };
        }

        // Fallback to the complete data object
        const completeData = JSON.parse(localStorage.getItem('kartCompanionData') || '{}');
        return completeData;
    } catch (error) {
        console.error('Error getting web page data:', error);
        return null;
    }
}

// Function to initialize charts with data
function initializeCharts(data) {
    if (!data) {
        console.warn('No data available for charts');
        return;
    }

    // Initialize visualizers
    if (typeof initializeVisualizers === 'function') {
        initializeVisualizers(data);
    }

    // Initialize stats numbers
    if (typeof initializeStatsNumbers === 'function') {
        initializeStatsNumbers(data);
    }

    // Initialize match history
    if (typeof initializeMatchHistory === 'function') {
        initializeMatchHistory(data);
    }

    // Initialize player card
    if (typeof initializePlayerCard === 'function') {
        initializePlayerCard(data);
    }
}

// Function to check if we're on a Kart Companion page
function isKartCompanionPage() {
    return window.location.hostname === 'leafbolt8.github.io' && 
           window.location.pathname.includes('Kart-Companion');
}

// Function to process and format data for display
function processDataForDisplay(data) {
    if (!data) return null;

    const processed = {
        stats: {},
        matchHistory: {},
        currentSkid: data.currentSkid || 'Default',
        uiState: data.uiState || {}
    };

    // Process stats
    if (data.stats) {
        processed.stats = data.stats;
    }

    // Process match history
    if (data.matchHistory) {
        processed.matchHistory = data.matchHistory;
    }

    return processed;
}

// Initialize data when page loads
document.addEventListener('DOMContentLoaded', () => {
    if (isKartCompanionPage()) {
        const rawData = getWebPageData();
        const processedData = processDataForDisplay(rawData);
        if (processedData) {
            initializeCharts(processedData);
        } else {
            console.warn('No valid data found for initialization');
        }
    }
});

// Export functions for use in other files
export { getWebPageData, initializeCharts, isKartCompanionPage, processDataForDisplay }; 