# Commit Warrior - GitHub Copilot Instructions

Commit Warrior is an Electron desktop application that helps users track their daily GitHub commit streaks. The app connects to GitHub's API to check commit status and provides a simple visual interface showing whether the user has committed code today.

**Always reference these instructions first and fallback to search or bash commands only when you encounter unexpected information that does not match the info here.**

## Working Effectively

### Bootstrap and Dependencies
- Install dependencies: `npm install` -- takes ~35 seconds. NEVER CANCEL. Set timeout to 60+ seconds.
- Check for circular dependencies: `node scripts/check-circular.js` -- takes <1 second
- Dependencies include: axios (GitHub API), electron-store (settings), electron-updater (auto-updates)
- **Security Note**: Current Electron version (28.1.0) has moderate vulnerability, upgrade available to 38.1.0+

### Development and Building
- **CRITICAL**: The application CANNOT be run in CI/headless environments due to Electron sandbox requirements
- Development mode: `npm start` -- only works with display/GUI environment. In headless: "SUID sandbox helper binary" error
- Build: `npm run build` -- takes ~3.5 seconds. NEVER CANCEL. Set timeout to 5+ minutes for safety.
- **Build Limitation**: Building on Linux fails due to icon.ico size requirements (current: 16x16/24x24, needs 256x256+), but successfully creates `dist/linux-unpacked/` directory with runnable application (~177MB executable + ~9.4MB app.asar)
- The build process uses electron-builder and targets Windows (NSIS installer), Linux (AppImage, Snap)

### No Test Infrastructure
- There are NO unit tests (`npm run test` returns "Error: no test specified")
- No linting tools (ESLint, Prettier) are configured
- Only validation available is the circular dependency checker

## Validation Requirements

### Manual Validation Scenarios
Since the app cannot run in CI environments, you MUST document your changes thoroughly:

1. **Settings Flow**: User enters GitHub username and personal access token, app validates credentials
2. **Commit Checking**: App queries GitHub API using multiple methods (Search API, Events API, Repository API) to determine if user has committed today
3. **Streak Calculation**: App calculates consecutive commit days using GitHub events data
4. **Visual Feedback**: Green checkmark for commits today, red X for no commits
5. **Auto-updates**: App checks for updates via electron-updater
6. **Build Verification**: Successful build creates `dist/linux-unpacked/commit-warrior` executable (~177MB) and `resources/app.asar` (~9.4MB)

### Code Validation Steps
Always validate your changes by:
- Running `npm install` after package.json changes (35s, timeout 60+ seconds)
- Running `node scripts/check-circular.js` to check dependencies (<1 second)
- Running `npm run build` to ensure no build-breaking changes (3.5s, timeout 5+ minutes) - expect icon-related failures on Linux
- Reviewing main.js, renderer.js, and preload.js for IPC communication correctness
- Checking that GitHub API calls in `checkGitHubCommits()` function remain functional
- **NEVER TRY** `npm start` in CI/headless - will fail with sandbox errors

## Project Structure

### Core Files
- `main.js` - Main Electron process, handles GitHub API calls, window management, auto-updates
- `renderer.js` - Frontend JavaScript for UI interactions and state management  
- `preload.js` - Secure IPC bridge between main and renderer processes
- `index.html` - Single-page application UI with embedded CSS
- `package.json` - Dependencies, build configuration, scripts

### Key Directories
- `assets/` - UI images (committed.png, not-committed.png variants)
- `scripts/` - Utility scripts (check-circular.js for dependency validation)
- `dist/` - Build output directory (created by electron-builder)
- `node_modules/` - Dependencies (excluded from git)

### Configuration
- `.gitignore` - Excludes node_modules, dist, logs, certificates, .env
- `.npmrc` - NPM configuration 
- `.env.example` - Template for GitGuardian API key
- No TypeScript, linting, or testing configuration files

## GitHub API Integration

The app uses three methods to check commits:
1. **Search API**: `GET /search/commits` - may miss some commits
2. **Events API**: `GET /users/{username}/events` - for recent activity and streak calculation
3. **Repository API**: `GET /users/{username}/repos` + individual repo commit checks

Always test GitHub API changes with valid credentials to ensure rate limiting and authentication work correctly.

## Common Tasks

### Adding New Features
1. Modify UI in `index.html` (embedded CSS and HTML structure)
2. Add frontend logic in `renderer.js` 
3. Add IPC handlers in `main.js` using `ipcMain.handle()`
4. Update IPC bridge in `preload.js` using `contextBridge.exposeInMainWorld()`
5. Test the full flow by running through user scenarios
6. Run `npm run build` to ensure no breaking changes

### Essential Commands Reference
```bash
# Bootstrap and validate (ALWAYS run in this order)
npm install                           # 35s, never cancel, timeout 60+s
node scripts/check-circular.js       # <1s, check dependencies  
npm run build                         # 3.5s, never cancel, timeout 5+min, expect icon errors on Linux
npm test                              # Fails: "Error: no test specified"
npm start                             # Fails in CI: "SUID sandbox helper binary" error

# Security and validation
npm audit                             # Shows Electron vulnerability (moderate)
```

### Build Timing Expectations
- `npm install`: ~35 seconds - NEVER CANCEL, set timeout to 60+ seconds
- `npm run build`: ~3.5 seconds - NEVER CANCEL, set timeout to 5+ minutes for safety
- `node scripts/check-circular.js`: <1 second
- Icon errors on Linux are expected and do not prevent core functionality

### Dependency Management
- Always run `node scripts/check-circular.js` after modifying package.json
- The app uses Yarn but npm commands work fine
- Key dependencies: electron ^28.1.0, axios ^1.6.2, electron-store ^8.1.0

## Troubleshooting

### Common Issues
- **Electron sandbox errors**: Expected in CI environments - app requires GUI. Error: "SUID sandbox helper binary was found, but is not configured correctly"
- **Icon size errors during build**: Linux build limitation (current icon: 16x16/24x24, needs 256x256+), does not affect Windows builds  
- **GitHub API rate limiting**: Handle gracefully in `checkGitHubCommits()` function
- **Missing credentials**: App handles via setup flow in UI
- **Security vulnerability**: Electron 28.1.0 has moderate vulnerability, upgrade to 38.1.0+ available

### Files to Always Check After Changes
- After modifying GitHub API logic: Review `main.js` checkGitHubCommits() function
- After UI changes: Check `renderer.js` event handlers and `index.html` structure  
- After adding IPC: Verify `preload.js` exposes necessary APIs securely
- After package.json changes: Run circular dependency check

## Repository Context
```
Repository root files:
.cache_ggshield    .env.example       .git/              .gitignore         .npmignore         
.npmrc             .yarn/             .yarnrc.yml        README.md          assets/
icon.ico           index.html         main.js            package.json       preload.js
renderer.js        scripts/

Key NPM Scripts:
- start: electron .
- build: electron-builder  
- test: echo "Error: no test specified" && exit 1

Dependencies:
- axios: ^1.6.2
- electron-store: ^8.1.0  
- electron-updater: ^6.1.7

Dev Dependencies:
- electron: ^28.1.0
- electron-packager: ^17.1.2
- electron-builder: ^24.9.1
```