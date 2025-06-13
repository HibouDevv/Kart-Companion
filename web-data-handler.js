// Function to get data from localStorage
function getWebPageData() {
    const data = localStorage.getItem('kartCompanionData');
    return data ? JSON.parse(data) : null;
}

// Function to initialize charts with data
function initializeCharts(data) {
    if (!data) return;

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

// Initialize data when page loads
document.addEventListener('DOMContentLoaded', () => {
    if (isKartCompanionPage()) {
        const data = getWebPageData();
        initializeCharts(data);
    }
});

// Export functions for use in other files
export { getWebPageData, initializeCharts, isKartCompanionPage }; 