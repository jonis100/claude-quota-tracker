# Claude Quota Tracker

Track your Claude.ai subscription usage directly in VS Code with real-time quota monitoring.

## Features

- **Real-time Usage Tracking**: Monitor your Claude.ai quota usage directly in VS Code's status bar
- **Visual Progress Bar**: See your 5-hour and 7-day usage limits at a glance with visual progress bars
- **Auto-refresh**: Configurable auto-refresh intervals (default: 5 minutes)
- **Color-coded Warnings**: Status bar changes color based on usage thresholds
- **Detailed Tooltips**: Hover for detailed usage information and reset times
- **Manual Refresh**: Click the status bar to manually refresh quota data

## Installation

1. Install the extension from the VS Code Marketplace
2. Configure your Claude.ai credentials (see Configuration section below)

## Configuration

### Getting Your Credentials

To use this extension, you need two values from your Claude.ai account:

#### 1. Session Key

1. Open [https://claude.ai](https://claude.ai) in your browser and log in
2. Open Developer Tools (F12 or Right-click → Inspect)
3. Go to the **Application** tab (Chrome/Edge) or **Storage** tab (Firefox)
4. Navigate to **Cookies** → `https://claude.ai`
5. Find the cookie named `sessionKey`
6. Copy its **Value** (starts with `sk-ant-sid01-`)

#### 2. Organization ID

##### Option 1

1. Still in Developer Tools, go to the **Network** tab
2. Visit [https://claude.ai/settings/usage](https://claude.ai/settings/usage)
3. Look for a request to `usage` in the Network tab
4. Click on it and check the **Request URL**
5. Copy the UUID from the URL (format: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`)

**Example URL**: `https://claude.ai/api/organizations/9f3c2a6e-4b7d-4c5f-8f0a-2f5e6c1a9d42/usage`
**Organization ID**: `9f3c2a6e-4b7d-4c5f-8f0a-2f5e6c1a9d42`

##### Option 2

1. Copy from `Organization ID` row in https://claude.ai/settings/account

### Setting Up in VS Code

1. Open VS Code Settings (Ctrl+, or Cmd+,)
2. Search for "Claude Quota"
3. Set your `Session Key` and `Organization ID`
4. Optionally configure:
   - **Refresh Interval**: How often to check usage (in minutes, default: 5)
   - **Warning Threshold**: When to show yellow/red warning (default: 80%)

Alternatively, add these to your `settings.json`:

```json
{
  "claudeQuota.sessionKey": "sk-ant-sid01-YOUR_SESSION_KEY_HERE",
  "claudeQuota.organizationId": "your-org-id-here",
  "claudeQuota.refreshInterval": 5,
  "claudeQuota.warningThreshold": 80
}
```

## Usage

Once configured, the extension will automatically:

- Display your Claude usage in the status bar
- Show a progress bar for your 5-hour window usage
- Display 7-day window percentage
- Auto-refresh at the configured interval
- Change colors based on usage (green → yellow → red)

**Status Bar Format**: `Claude: 5h ████████░░ 83% | 7d 22%`

### Commands

Access via Command Palette (Ctrl/Cmd + Shift + P):

- **Claude Quota: Refresh Usage** - Manually refresh quota data
- **Claude Quota: Show Details** - Show detailed usage information

## Requirements

- VS Code 1.75.0 or higher
- Active Claude.ai subscription
- Valid session credentials
- Internet connection

## Privacy & Security

- Your credentials are stored locally in VS Code settings
- All requests are made directly to Claude.ai official API
- No data is collected or sent to third parties
- **Note**: Your session key is sensitive - treat it like a password

## Troubleshooting

### "Session key and organization ID not configured"

Make sure you've set both credentials in Settings → Claude Quota

### Quota not updating

- Check your internet connection
- Verify your session key is valid (they can expire)
- Get a new session key from your browser if expired

### HTTP 403 errors

Your session key may have expired. Get a fresh session key from browser cookies.

## Known Issues

- A browser window briefly may appears when fetching data (required to bypass Cloudflare protection)
- Session keys expire periodically and need to be updated

## Release Notes

### 1.0.0

Initial release:

- Real-time Claude.ai quota tracking
- 5-hour and 7-day usage windows with visual progress bars
- Auto-refresh functionality
- Color-coded usage warnings
- Configurable thresholds and intervals

## Support

For issues or feature requests, please visit the GitHub repository.

---

**Note**: This extension is not officially affiliated with Anthropic. It's a community-built tool to help developers track their Claude.ai subscription usage.

**Enjoy tracking your Claude usage!**
