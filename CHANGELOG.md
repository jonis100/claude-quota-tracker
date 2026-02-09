# Change Log

All notable changes to the "Claude Quota Tracker" extension will be documented in this file.

## [1.0.4] - 2026-02-09

### Fixed

- **code-server Support**: Fixed Chromium installation failing in code-server environments
  - Installation command now runs from the extension's directory instead of VS Code's process directory
  - Added extension path context to chromiumService for proper node_modules resolution
  - Enhanced debug logging to show installation working directory
  - Resolves "install dependencies first" error in code-server

### Technical Details

- Added `setExtensionPath()` function to chromiumService for storing extension installation path
- Modified `installChromium()` to use `cwd` option pointing to extension directory
- Extension path is automatically set during activation from `context.extensionPath`
- Maintains backward compatibility (works even if path not set)

## [1.0.3] - 2026-02-05

### Changed

- **Headless Browser**: Switched Playwright quota requests to true headless and eliminating the visible browser window on fetch
- **Code Formatting**: Ran Prettier across the entire codebase for consistent style (quotes, trailing commas, indentation)
- **Default Refresh Interval**: Decreased from 10 minutes back to 5 minutes (300000ms)

## [1.0.2] - 2026-01-22

### Fixed

- **Cloudflare Protection**: Fixed fetch requests being blocked by Cloudflare
  - Improved browser automation stealth to avoid detection
  - Enhanced challenge detection and handling
  - Increased timeouts to accommodate security checks
  - Better error handling and response parsing
- **Excessive API Requests**: Fixed multiple concurrent requests being sent
  - Added concurrent fetch protection to prevent overlapping requests
  - Implemented rate limiting with 10-second minimum interval between fetches
  - Added configuration change debouncing (500ms delay)
  - Fixed multiple auto-refresh timers being created simultaneously
  - Added validation to ensure refresh interval respects minimum threshold
- **Timer Management**: Fixed timer cleanup and memory leak issues
  - Properly clears existing timers before creating new ones
  - Cleanup on extension deactivation

### Changed

- **Fetch Implementation**: Enhanced reliability and error handling
- **Logging**: Improved debug logging for troubleshooting

### Technical Details

- Rate limiting prevents requests faster than every 10 seconds
- All timers properly cleared on configuration changes and deactivation

## [1.0.1] - 2026-01-19

### Added

- **Automatic Chromium Installation**: Extension now prompts users to install Chromium if not available
- **Chromium Verification**: Added file existence check to ensure Chromium is properly installed
- **Usage Period Selection**: New setting to choose between 5-hour or 7-day as primary display in status bar
  - Both periods still visible, but selected one shows with progress bar
  - Configurable via `claudeQuota.usagePeriod` setting

### Changed

- **Default Refresh Interval**: Increased from 5 minutes to 10 minutes (600000ms) to reduce API calls and user interruptions
- **Improved Browser Stealth**: Enhanced browser flags for better invisibility while avoiding detection
- **Better Error Handling**: Clearer error messages when Chromium is not available

### Fixed

- Fixed chromium availability check returning cached results after installation
- Fixed initial quota fetch attempting to run before chromium installation completes
- Improved startup flow to properly handle missing chromium installation

### Configuration

- `claudeQuota.usagePeriod`: Choose between "5-hour" (default) or "7-day" as primary display period

## [1.0.0] - 2026-01-12

### Added

- Initial release of Claude Quota Tracker
- Real-time Claude.ai subscription usage tracking
- Status bar integration with visual progress bars
- 5-hour and 7-day usage window monitoring
- Auto-refresh functionality with configurable intervals
- Color-coded usage warnings (green/yellow/red)
- Manual refresh command
- Detailed usage information view
- Session-based authentication with Claude.ai
- Cloudflare bypass using Playwright browser automation
- Browser session persistence for better performance
- Configurable warning thresholds
- Hover tooltips with detailed usage information and reset times

### Features

- **Status Bar Display**: Shows usage as `Claude: 5h ████████░░ 83% | 7d 22%`
- **Visual Progress Bar**: Unicode-based progress bar for 5-hour window
- **Dual Window Tracking**: Monitor both 5-hour and 7-day usage limits
- **Smart Color Coding**: Visual indicators based on usage percentage
- **Auto-Refresh**: Configurable refresh intervals (default: 5 minutes)
- **Detailed View**: Click status bar for comprehensive usage statistics

### Configuration

- `claudeQuota.sessionKey`: Your Claude.ai session key from browser cookies
- `claudeQuota.organizationId`: Your Claude.ai organization ID
- `claudeQuota.refreshInterval`: Auto-refresh interval in milliseconds (default: 300000 / 5 minutes)
- `claudeQuota.showInStatusBar`: Toggle status bar display (default: true)
- `claudeQuota.warningThreshold`: Warning threshold percentage (default: 80)

### Commands

- `Claude Quota: Refresh Usage`: Manually refresh quota data
- `Claude Quota: Show Details`: Display detailed usage information

### Technical Details

- Uses Playwright Chromium for Cloudflare bypass
- Session persistence for improved performance
- Direct integration with Claude.ai official API
- Local credential storage in VS Code settings

### Known Issues

- Browser window briefly appears when fetching data (required for Cloudflare bypass)
- Session keys expire periodically and need manual renewal
- Requires Playwright Chromium installation (`npx playwright install chromium`)

---

**Note**: This extension is not officially affiliated with Anthropic. It's a community-built tool for tracking Claude.ai subscription usage.
