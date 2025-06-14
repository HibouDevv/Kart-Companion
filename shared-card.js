document.addEventListener('DOMContentLoaded', () => {
    const sharedCard = document.getElementById('shared-card');
    
    // Get card data from URL
    const urlParams = new URLSearchParams(window.location.search);
    const cardData = urlParams.get('card');
    
    if (!cardData) {
        sharedCard.innerHTML = `
            <div style="text-align: center; padding: 20px; color: #fff;">
                <h2>Invalid Card Link</h2>
                <p>Please make sure you're using a valid Kart Companion player card URL.</p>
            </div>
        `;
        return;
    }

    try {
        // Decode and parse the card data
        const decodedData = JSON.parse(atob(cardData));
        
        // Create the card HTML
        sharedCard.innerHTML = `
            <div class="card-background-layer"></div>
            
            <div class="player-ovr-container">
                ${decodedData.ovr}
            </div>

            <div class="player-flag-container">
                <img src="https://placehold.co/60x40/0033a0/ffffff?text=${decodedData.flag}" alt="${decodedData.flag} Flag" title="${decodedData.flag}">
            </div>

            <div class="team-logo-container">
                ${decodedData.teamLogo ? `<img src="${decodedData.teamLogo}" alt="Team Logo">` : ''}
            </div>

            <div class="player-avatar-container">
                ${decodedData.avatar ? `<img src="${decodedData.avatar}" alt="Player Avatar">` : ''}
            </div>

            <div class="player-name-container">
                ${decodedData.playerName}
            </div>

            <div class="team-name-container">
                ${decodedData.teamName}
            </div>

            <div class="stats-block">
                <div class="stats-column">
                    <div class="stat-item">
                        <span class="stat-label">ATK</span>
                        <span class="stat-value">${decodedData.atk}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">DEF</span>
                        <span class="stat-value">${decodedData.def}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">CNS</span>
                        <span class="stat-value">${decodedData.cns}</span>
                    </div>
                </div>
                <div class="stats-column">
                    <div class="stat-item">
                        <span class="stat-label">EXP</span>
                        <span class="stat-value">${decodedData.exp}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">PRF</span>
                        <span class="stat-value">${decodedData.prf}</span>
                    </div>
                </div>
            </div>

            <div class="game-logo-container">
                <img src="sklogo.png" alt="Smash Karts Logo" title="Smash Karts">
            </div>
        `;
    } catch (error) {
        console.error('Error loading shared card:', error);
        sharedCard.innerHTML = `
            <div style="text-align: center; padding: 20px; color: #fff;">
                <h2>Error Loading Card</h2>
                <p>There was an error loading the player card. Please try again later.</p>
            </div>
        `;
    }
}); 