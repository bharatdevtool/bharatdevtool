# Version Management Guide

This document explains how to manage versions for Bharat Dev Tools.

## Files Involved

- `version.json` - Contains version information
- `assets/js/version.js` - Version tracking utility that reads version.json

## How to Update Version

When releasing a new version, update `version.json`:

```json
{
  "version": "1.0",
  "buildDate": "2024-01-20",
  "releaseName": "Bug Fix Release",
  "features": [
    "JSON Formatter",
    "QR Code Generator", 
    "DeepLink Launcher",
    "New Feature Name"
  ]
}
```

## What Gets Tracked in Sentry

Every error in Sentry will now include:

### App Information
- Version number (e.g., "1.0.0")
- Build date
- Release name
- Environment (production/development)

### Browser Information
- Browser name and version (Chrome, Firefox, Safari, etc.)
- Operating system
- User agent
- Language
- Platform
- Screen resolution
- Viewport resolution
- Color depth
- Timezone
- Cookie support
- Online status

### Page Information
- Full URL
- Pathname
- Referrer
- Hostname
- Protocol
- Page load time
- Connection type (if available)

### User Context
- Anonymous user ID (persisted in localStorage)
- Username: "anonymous-user"

## Versioning Best Practices

### Semantic Versioning
Use semantic versioning: `MAJOR.MINOR.PATCH`
- **MAJOR**: Breaking changes
- **MINOR**: New features (backward compatible)
- **PATCH**: Bug fixes

### Release Naming
Use descriptive release names:
- "Initial Release"
- "Bug Fix Release"
- "Performance Update"
- "Feature Release: Add New Tool"
- "Security Update"

## Git Integration (Optional)

To automatically update version based on git:

1. Create a build script that generates version.json from git tags
2. Use git tags for releases: `git tag v1.0.0`
3. Automate version bumping in CI/CD pipeline

## Testing Version Tracking

To verify version tracking is working:

1. Open browser console
2. Check for: "Sentry tracking initialized: ..."
3. Go to Sentry dashboard
4. Click on any error
5. Check the "Tags" and "Contexts" tabs

## Troubleshooting

### Version not updating
- Make sure `version.json` exists in root directory
- Check browser console for errors
- Verify `assets/js/version.js` is loaded

### Version shows as "1.0.0" in Sentry
- Default version is hardcoded in `version.js`
- Update `version.json` to change it
- Clear browser cache if needed

## Security Note

No personally identifiable information (PII) is tracked. All user IDs are anonymous and randomly generated.

