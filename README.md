# Kart Companion 🏎️

A powerful Chrome extension that enhances your Smash Karts gaming experience by providing detailed match analytics and performance tracking.

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

## ✨ Features

### 🎮 Real-time Match Tracking
- Comprehensive match statistics including:
  - Kills and deaths
  - Power-ups collected and used
  - Smash streaks
  - Match duration and map information
- Instant data synchronization with Firebase
- SKID-based player identification

### 📊 Advanced Analytics
- Interactive performance charts and graphs
- Detailed match history with advanced filtering
- Player-specific statistics and trends
- Visual performance tracking over time

### 🔄 Data Management
- Secure Firebase integration
- Automatic data synchronization
- Match history export capabilities
- Customizable tracking preferences

## 🚀 Installation

### Quick Install (Chrome Web Store)
1. Visit the Chrome Web Store (coming soon)
2. Click "Add to Chrome"
3. Confirm the installation

### Manual Installation (Developer Mode)
1. Download or clone this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" (top right)
4. Click "Load unpacked" and select the extension directory
5. Configure Firebase (see Configuration section)

## ⚙️ Configuration

### Firebase Setup
1. Create a Firebase project at [Firebase Console](https://console.firebase.google.com/)
2. Enable Firestore database
3. Get your Firebase configuration from Project Settings
4. Update the `firebaseConfig` in `background.js`

### Extension Settings
- Customize tracking preferences
- Set up data retention policies
- Configure notification settings

## 🎯 Usage

1. Launch Smash Karts in your browser
2. Click the Kart Companion icon in your toolbar
3. View real-time match statistics
4. Access detailed analytics and charts
5. Filter and sort your match history

## 🔒 Privacy & Security

- All data is stored securely in Firebase
- Data collection only occurs during active gameplay
- Optional tracking features
- No personal information beyond game statistics
- Full control over data retention

## 🛠️ Development

### Project Structure
```
kart-companion/
├── manifest.json          # Extension configuration
├── popup.html            # Main UI interface
├── popup.js              # UI logic
├── content.js            # Game data collection
├── background.js         # Background processes
├── styles/               # CSS styles
└── icons/                # Extension icons
```

### Building from Source
```bash
# Install dependencies
npm install

# Build extension
npm run build
```

### Testing
1. Load the extension in Chrome
2. Play Smash Karts
3. Verify statistics tracking
4. Check data visualization

## 🤝 Contributing

We welcome contributions! Please follow these steps:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 💬 Support

- Open an issue in the GitHub repository
- Contact the maintainers
- Join our Discord community (coming soon)

## 🙏 Acknowledgments

- Smash Karts community
- All contributors and supporters
- Firebase for data management 