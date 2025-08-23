# Commit Warrior

A simple Electron app that helps you track your daily GitHub commit streak. Stay motivated and consistent with your coding practice by keeping your commit streak alive!

## Features

- **💯 Reliable Commit Tracking**: Advanced GitHub API integration with intelligent fallback mechanisms
- **🚀 Smart Caching**: Reduces API calls and improves performance with configurable caching
- **🔄 Rate Limit Handling**: Automatic retry logic and rate limit management
- **🎯 Accurate Detection**: Multiple commit detection methods ensure reliability
- **⚡ Fast Response**: Cached results and optimized API usage for quick feedback
- **🛡️ Error Resilience**: Comprehensive error handling with user-friendly messages
- **🔧 Configurable**: Customizable preferences for different usage patterns
- **📊 Streak Tracking**: Accurate consecutive day calculation with timezone support
- **🎨 Clean Interface**: Minimal, focused UI that gets out of your way
- **🔄 Auto-updates**: Always stay on the latest version
- **🏷️ Smart Validation**: Comprehensive GitHub token validation and guidance

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
   - You'll need a GitHub Personal Access Token with `repo` or `public_repo` scope
   - Create one at [GitHub Settings > Developer Settings > Personal access tokens](https://github.com/settings/tokens)
   - **Recommended scopes**: `repo` (for private repos) or `public_repo` (for public repos only)

2. **First Launch**:
   - Enter your GitHub username
   - Enter your GitHub Personal Access Token
   - Click "Save Settings" - the app will validate your credentials
   - ✅ Green checkmark = you've committed today!
   - ❌ Red X = no commits yet today

3. **Daily Usage**:
   - The app automatically checks your commit status on launch
   - Use the "Check Now" button to refresh manually
   - Results are cached for 5 minutes to reduce API usage
   - Your streak updates automatically based on contribution history

## What's New in v1.0.7

🚀 **Major Stability Improvements**:
- **Enhanced API reliability** with rate limiting and retry logic  
- **Smart caching** reduces API calls and improves performance
- **Better error handling** with clear, actionable messages
- **Improved commit detection** using multiple GitHub API methods
- **Timezone support** for accurate date calculations
- **Token validation** with helpful setup guidance

See [CHANGELOG.md](CHANGELOG.md) for complete details.

## Technical Details

- **Built with**: Electron, Node.js, GitHub REST API
- **Architecture**: Modular utilities for reliability and maintainability
- **API Integration**: Multiple GitHub API endpoints with intelligent fallback
- **Caching**: Smart response caching with automatic cleanup
- **Rate Limiting**: Built-in GitHub API rate limit handling
- **Error Handling**: Comprehensive error recovery and user feedback
- **Security**: Secure token storage using electron-store
- **Performance**: Optimized API usage and response caching
- **Timezone**: Proper timezone handling for global users
- **Logging**: Comprehensive logging for debugging and monitoring

## Troubleshooting

### Common Issues

**"Invalid token" error:**
- Verify your token at [GitHub Settings](https://github.com/settings/tokens)
- Ensure the token has `repo` or `public_repo` scope
- Try regenerating your token if it's old

**"Rate limit exceeded":**
- Wait a few minutes - GitHub allows 5,000 requests per hour
- The app will automatically retry when the limit resets
- Consider reducing check frequency if you hit limits often

**"Network error":**
- Check your internet connection
- Verify you can access github.com in your browser
- Try again in a few minutes

**Commits not detected:**
- Ensure commits are pushed to GitHub (local commits don't count)
- Check that commits are authored with your GitHub email
- Verify your timezone settings are correct

### Getting Help

If you encounter issues:
1. Try the "Check Now" button to refresh
2. Check the console logs (F12 in dev mode)
3. Reset settings and reconfigure if needed
4. Open an issue on GitHub with error details

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
