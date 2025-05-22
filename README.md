# Smash Karts Match Tracker

A Chrome extension that tracks and analyzes your Smash Karts gameplay statistics.

## Features

- Track detailed match statistics including:
  - Kills and deaths
  - Power-ups collected and used
  - Smash streaks
  - Match duration and map information
- Real-time data synchronization with Firebase
- Visual performance tracking with charts
- Match history with filtering and sorting options
- Player-specific statistics using SKID

## Installation

1. Clone this repository or download the source code
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right corner
4. Click "Load unpacked" and select the extension directory
5. Configure Firebase:
   - Create a new Firebase project
   - Enable Firestore database
   - Add your Firebase configuration to `background.js`

## Configuration

1. Create a Firebase project at [https://console.firebase.google.com/](https://console.firebase.google.com/)
2. Enable Firestore database
3. Get your Firebase configuration from Project Settings
4. Update the `firebaseConfig` object in `background.js` with your configuration

## Usage

1. Install the extension
2. Play Smash Karts in your browser
3. Click the extension icon to view your statistics
4. Use the filters to sort and view specific matches
5. View your performance trends in the chart

## Data Collection

The extension collects the following data:
- Match statistics (kills, deaths, power-ups, etc.)
- Player information (SKID, username)
- Match timestamps and map information

All data is stored securely in Firebase and is associated with your SKID.

## Privacy

- All data is stored securely in Firebase
- Data is only collected when you are actively playing
- You can disable tracking in the extension settings
- No personal information is collected beyond your game statistics

## Development

### Project Structure

```
smash-karts-match-tracker/
├── manifest.json
├── popup.html
├── popup.js
├── content.js
├── background.js
├── styles/
│   └── popup.css
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

### Building

1. Install dependencies:
   ```bash
   npm install
   ```

2. Build the extension:
   ```bash
   npm run build
   ```

### Testing

1. Load the extension in Chrome
2. Play Smash Karts
3. Verify that statistics are being tracked
4. Check the extension popup for data display

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support, please open an issue in the GitHub repository or contact the maintainers. 