// Function to get stats from storage
async function getStats() {
    return new Promise((resolve) => {
        chrome.storage.sync.get(['currentSkid'], (skidData) => {
            const currentSkid = skidData.currentSkid || 'Default';
            const modes = ['normal', 'special', 'custom'];
            const keysToFetch = ['currentSkid'];
            
            // Fetch data for all modes
            modes.forEach(mode => {
                keysToFetch.push(`matchHistory_${currentSkid}_${mode}`);
                keysToFetch.push(`gamesJoined_${currentSkid}_${mode}`);
                keysToFetch.push(`gamesStarted_${currentSkid}_${mode}`);
                keysToFetch.push(`gamesQuit_${currentSkid}_${mode}`);
                keysToFetch.push(`matchesCompleted_${currentSkid}_${mode}`);
            });

            chrome.storage.sync.get(keysToFetch, (data) => {
                // Combine data from all modes
                const combinedData = {
                    matchHistory: [],
                    matchesCompleted: 0,
                    matchesQuit: 0,
                    smashStreak: 0,
                    smashtacularStreak: 0,
                    smashosaurusStreak: 0,
                    smashlvaniaStreak: 0,
                    monsterSmashStreak: 0,
                    potatoStreak: 0
                };

                modes.forEach(mode => {
                    const history = data[`matchHistory_${currentSkid}_${mode}`] || [];
                    combinedData.matchHistory = combinedData.matchHistory.concat(history);
                    combinedData.matchesCompleted += data[`matchesCompleted_${currentSkid}_${mode}`] || 0;
                    combinedData.matchesQuit += data[`gamesQuit_${currentSkid}_${mode}`] || 0;
                });

                // Sort match history by timestamp
                combinedData.matchHistory.sort((a, b) => {
                    const timeA = a.matchStartTime || a.startTime || 0;
                    const timeB = b.matchStartTime || b.startTime || 0;
                    return timeA - timeB;
                });

                resolve(combinedData);
            });
        });
    });
}

// Function to create performance trends chart
function createPerformanceChart(data) {
    const ctx = document.getElementById('performanceChart').getContext('2d');
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.matchHistory.map((_, index) => `Match ${index + 1}`),
            datasets: [
                {
                    label: 'Kills',
                    data: data.matchHistory.map(match => match.kills),
                    borderColor: '#4CAF50',
                    tension: 0.1
                },
                {
                    label: 'Deaths',
                    data: data.matchHistory.map(match => match.deaths),
                    borderColor: '#f44336',
                    tension: 0.1
                }
            ]
        },
        options: {
            responsive: true,
            plugins: {
                title: {
                    display: true,
                    text: 'Performance Over Time'
                }
            },
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

// Function to create kills distribution chart
function createKillsDistributionChart(data) {
    const ctx = document.getElementById('killsDistributionChart').getContext('2d');
    const killsData = data.matchHistory.map(match => match.kills);
    const distribution = {};
    
    killsData.forEach(kills => {
        distribution[kills] = (distribution[kills] || 0) + 1;
    });

    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: Object.keys(distribution),
            datasets: [{
                label: 'Number of Matches',
                data: Object.values(distribution),
                backgroundColor: '#4CAF50'
            }]
        },
        options: {
            responsive: true,
            plugins: {
                title: {
                    display: true,
                    text: 'Kills Distribution'
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    }
                }
            }
        }
    });
}

// Function to create match completion rate chart
function createCompletionRateChart(data) {
    const ctx = document.getElementById('completionRateChart').getContext('2d');
    const completed = data.matchesCompleted;
    const quit = data.matchesQuit;
    const total = completed + quit;

    new Chart(ctx, {
        type: 'pie',
        data: {
            labels: ['Completed', 'Quit'],
            datasets: [{
                data: [completed, quit],
                backgroundColor: ['#4CAF50', '#f44336']
            }]
        },
        options: {
            responsive: true,
            plugins: {
                title: {
                    display: true,
                    text: 'Match Completion Rate'
                }
            }
        }
    });
}

// Function to create streak analysis chart
function createStreakChart(data) {
    const ctx = document.getElementById('streakChart').getContext('2d');
    const streakData = {
        smashStreak: data.smashStreak || 0,
        smashtacularStreak: data.smashtacularStreak || 0,
        smashosaurusStreak: data.smashosaurusStreak || 0,
        smashlvaniaStreak: data.smashlvaniaStreak || 0,
        monsterSmashStreak: data.monsterSmashStreak || 0,
        potatoStreak: data.potatoStreak || 0
    };

    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: Object.keys(streakData).map(key => key.replace('Streak', '')),
            datasets: [{
                label: 'Number of Streaks',
                data: Object.values(streakData),
                backgroundColor: '#4CAF50'
            }]
        },
        options: {
            responsive: true,
            plugins: {
                title: {
                    display: true,
                    text: 'Streak Analysis'
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    }
                }
            }
        }
    });
}

// Initialize all charts when the page loads
async function initializeCharts() {
    const stats = await getStats();
    
    if (Object.keys(stats).length === 0) {
        document.querySelector('.charts-grid').innerHTML = '<p style="text-align: center; grid-column: 1/-1;">No stats data available. Play some matches first!</p>';
        return;
    }

    createPerformanceChart(stats);
    createKillsDistributionChart(stats);
    createCompletionRateChart(stats);
    createStreakChart(stats);
}

// Initialize charts when the page loads
document.addEventListener('DOMContentLoaded', initializeCharts); 