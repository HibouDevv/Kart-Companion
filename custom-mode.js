// This script contains the logic for the Custom Mode visualizer page.

import { getStats, initializeVisualizers } from './visualizers.js';

// Initialize when document is ready
document.addEventListener('DOMContentLoaded', async () => {
    try {
        await initializeVisualizers();
    } catch (error) {
        console.error('Error initializing custom mode:', error);
    }
}); 