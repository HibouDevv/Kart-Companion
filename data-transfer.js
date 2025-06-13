// Function to get data from Chrome storage
async function getChromeStorageData() {
    return new Promise((resolve) => {
        chrome.storage.local.get(null, (data) => {
            // Process the data to ensure it's in the correct format
            const processedData = {
                stats: {},
                matchHistory: {},
                currentSkid: data.currentSkid || 'Default',
                uiState: data.uiState || {}
            };

            // Process match history for each mode
            ['normal', 'special', 'custom'].forEach(mode => {
                const matchHistoryKey = `matchHistory_${processedData.currentSkid}_${mode}`;
                processedData.matchHistory[mode] = data[matchHistoryKey] || [];
            });

            // Process stats
            processedData.stats = data.stats || {};

            resolve(processedData);
        });
    });
}

// Function to send data to web pages
function sendDataToWebPages(data) {
    // Store data in localStorage for web pages to access
    localStorage.setItem('kartCompanionData', JSON.stringify(data));
    
    // Also store individual components for easier access
    localStorage.setItem('kartCompanionStats', JSON.stringify(data.stats));
    localStorage.setItem('kartCompanionMatchHistory', JSON.stringify(data.matchHistory));
    localStorage.setItem('kartCompanionCurrentSkid', data.currentSkid);
    localStorage.setItem('kartCompanionUIState', JSON.stringify(data.uiState));
}

// Function to initialize data transfer
async function initializeDataTransfer() {
    try {
        const data = await getChromeStorageData();
        sendDataToWebPages(data);
        return true;
    } catch (error) {
        console.error('Error transferring data:', error);
        return false;
    }
}

// Function to check if we're in the extension context
function isExtensionContext() {
    return typeof chrome !== 'undefined' && chrome.storage;
}

// Initialize data transfer if we're in the extension context
if (isExtensionContext()) {
    initializeDataTransfer();
}

// Export functions for use in other files
export { initializeDataTransfer, getChromeStorageData, sendDataToWebPages }; 