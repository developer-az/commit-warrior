# Commit Warrior

![Commit Warrior Logo](https://via.placeholder.com/150x150?text=CW)

A simple Electron app that helps you track your daily GitHub commit streak. Stay motivated and consistent with your coding practice by keeping your commit streak alive!

## Features

- **Simple Status Dashboard**: Visual indicator showing whether you've committed code today
- **GitHub Integration**: Connects to your GitHub account via personal access token
- **Auto-updates**: Always stay on the latest version
- **Minimal UI**: Focus on what matters - your daily commit status
- **Tray Application**: Runs quietly in your system tray

## Installation

### Windows
Download the latest installer from the [Releases](https://github.com/developer-az/commit-warrior/releases) page and run the `.exe` file.

### Building from Source
If you prefer to build from source:

```bash
# Clone the repository
git clone https://github.com/developer-az/commit-warrior.git

# Navigate to the project directory
cd commit-warrior

# Install dependencies
npm install

# Start the application
npm start

# Build the application
npm run build
```

## Setup

1. **GitHub Personal Access Token**:
   - You'll need a GitHub Personal Access Token with `repo` scope
   - Create one at [GitHub Settings > Developer Settings > Personal access tokens](https://github.com/settings/tokens)

2. **First Launch**:
   - Enter your GitHub username
   - Enter your GitHub Personal Access Token
   - Click "Save Settings"

3. **Daily Usage**:
   - The app will automatically check your commit status on launch
   - Use the "Check Now" button to refresh at any time
   - A green checkmark means you've committed today! 🎉
   - A red X means you haven't committed yet today

## Screenshots

![Main Screen](https://via.placeholder.com/400x300?text=Commit+Warrior+Screenshot)

## Technical Details

- Built with Electron
- Uses GitHub's API to check commit status
- Secure token storage using electron-store
- Automatic updates via electron-updater

## Privacy

- Your GitHub token is stored locally on your machine
- No data is sent to any servers except GitHub's API
- The app only checks if you've made commits today

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Roadmap

- [ ] Streak tracking (consecutive days)
- [ ] Commit statistics dashboard
- [ ] Desktop notifications
- [ ] Multiple GitHub account support
- [ ] Custom commit goals

## License

This project is licensed under the ISC License - see the LICENSE file for details.

## Acknowledgments

- Built by [Anthony Zhou](https://github.com/developer-az)

---

If you find Commit Warrior useful, please consider giving it a star on GitHub! ⭐
