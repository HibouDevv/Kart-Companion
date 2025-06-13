// This script contains the logic for the Special Mode visualizer page.

import { getStats, initializeVisualizers } from './visualizers.js';

// Initialize when document is ready
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const data = await getStats();
        await initializeVisualizers(data);
    } catch (error) {
        console.error('Error initializing charts:', error);
    }
}); 