# Google Calendar Authentication Setup

## Quick Setup for Live Mode

### Option 1: Service Account (Recommended for CI/Demo)

1. **Create Google Cloud Project**
   ```bash
   # Go to https://console.cloud.google.com/
   # Create new project or select existing
   # Enable Google Calendar API
   ```

2. **Create Service Account**
   ```bash
   # In Google Cloud Console:
   # APIs & Services > Credentials > Create Credentials > Service Account
   # Download JSON key file
   # Save as credentials.json in project root
   ```

3. **Share Calendar**
   ```bash
   # Get service account email from credentials.json
   # Go to Google Calendar settings
   # Share calendar with service account email
   # Grant "Make changes to events" permission
   ```

4. **Run Live Tests**
   ```bash
   MODE=live npm run eval:micro
   ```

### Option 2: OAuth2 (For User-Specific Access)

1. **Create OAuth2 Credentials**
   ```bash
   # In Google Cloud Console:
   # APIs & Services > Credentials > Create Credentials > OAuth 2.0 Client IDs
   # Choose "Desktop application"
   # Download JSON file as oauth-credentials.json
   ```

2. **Get Access Token**
   ```bash
   npm run auth:setup
   # Follow the prompts to authorize and get token
   ```

3. **Run Live Tests**
   ```bash
   MODE=live npm run eval:micro
   ```

## File Structure

```
project-root/
├── credentials.json          # Service account credentials (Option 1)
├── oauth-credentials.json    # OAuth2 credentials (Option 2)
├── token.json               # Access token (Option 2)
└── tests/
    └── micro-eval.mjs       # Evaluation script
```

## Environment Variables

```bash
# Required for live mode
export MODE=live
export GCAL_CAL_ID="primary"  # or your calendar ID
export GCAL_TZ="Europe/London"
export GCAL_EVENT_ID="your-event-id"

# Optional
export BASE_URL="http://localhost:3000"
```

## Troubleshooting

### "Not authenticated" Error
- Make sure you have either `credentials.json` or `token.json`
- Check that your calendar is shared with the service account
- Verify the access token hasn't expired

### "Calendar not found" Error
- Check `GCAL_CAL_ID` environment variable
- Ensure the calendar ID is correct
- Verify permissions on the calendar

### "Event not found" Error
- Check `GCAL_EVENT_ID` environment variable
- Ensure the event exists in the specified calendar
- Verify the event ID format

## Security Notes

- Never commit `credentials.json`, `oauth-credentials.json`, or `token.json` to version control
- Add these files to `.gitignore`
- Use environment variables for sensitive data in production
- Rotate credentials regularly

## For Demo Purposes

For your Loom demo, you can:
1. Use **mock mode** for the main demo (fast, deterministic)
2. Show **live mode** briefly if you have authentication set up
3. Mention that live mode requires proper Google Calendar API setup

```bash
# Demo commands
MODE=mock npm run eval:micro                                    # Fast demo
MODE=live npm run eval:micro -- --cases=happy_within_hours_no_conflict  # Live check
```
