// This script contains the logic for the 3 Minute Mode visualizer page.

// Initialize charts when the page loads
document.addEventListener('DOMContentLoaded', async () => {
    // Get the current SKID and update the display
    const stats = await getStats();
    document.getElementById('skidDisplay').textContent = `SKID: ${stats.currentSkid}`;

    // Log the match history to inspect its content
    console.log('Match history for 3-minute mode:', stats.matchHistory);

    // Initialize all charts
    initializeCharts();

    // Set up event listeners for chart controls
    // These listeners were already present in visualizers.js and handle filtering
    // based on the stats object which now contains mode-specific data
}); 