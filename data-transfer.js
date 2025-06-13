// Function to get data from Chrome storage
async function getChromeStorageData() {
    return new Promise((resolve) => {
        chrome.storage.local.get(null, (data) => {
            resolve(data);
        });
    });
}

// Function to send data to web pages
function sendDataToWebPages(data) {
    // Store data in localStorage for web pages to access
    localStorage.setItem('kartCompanionData', JSON.stringify(data));
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

// Export functions for use in other files
export { initializeDataTransfer, getChromeStorageData, sendDataToWebPages }; 