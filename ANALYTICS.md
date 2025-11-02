# Analytics Documentation

## Overview

Bharat Dev Tools uses **Google Analytics 4 (GA4)** for privacy-friendly web analytics. All analytics code is centralized in `assets/js/analytics.js` for easy maintenance and consistency across the application.

## Features

✅ **Automatic Initialization** - Loads on all pages without additional setup  
✅ **Localhost Protection** - Automatically disabled in development environments  
✅ **IP Anonymization** - User IP addresses are anonymized for privacy  
✅ **Custom Events** - Ready-to-use event tracking for key user actions  
✅ **Error Handling** - Graceful failures in development or when GA4 is unavailable  

## Configuration

### Measurement ID
Located in `assets/js/analytics.js`:
```javascript
const ANALYTICS_CONFIG = {
  GA4_MEASUREMENT_ID: 'G-H00TEVH9KG',
  // ...
};
```

### Adding to HTML Pages

Simply include the analytics script in the `<head>` section:

```html
<!-- Analytics Script -->
<script src="assets/js/analytics.js"></script>
```

The script is already included in:
- `index.html`
- `deeplink.html`
- `simple-qr.html`
- `about.html`
- `feedback.html`
- `privacy.html`

## Usage Guide

### Basic Page View Tracking

Page views are tracked automatically with user-friendly names and **performance metrics**! 

#### Page Names in GA4

| File | Page Name in GA4 |
|------|------------------|
| `index.html` | JSON Formatter |
| `deeplink.html` | DeepLink Launcher |
| `simple-qr.html` | QR Code Generator |
| `about.html` | About |
| `feedback.html` | Feedback |
| `privacy.html` | Privacy Policy |

#### Performance Metrics Tracked

Every page view automatically includes these **performance metrics**:

**Timing Metrics** (in milliseconds):
- `dns_lookup_time` - DNS resolution time
- `server_connection_time` - Time to connect to server
- `time_to_first_byte` - Server response time
- `download_time` - Time to download page
- `dom_processing_time` - DOM parsing time
- `page_load_time` - Total page load time

**User Info**:
- `connection_type` - Network connection (4g, 3g, 2g, etc.)
- `screen_width` / `screen_height` - Device screen size
- `viewport_width` / `viewport_height` - Browser viewport size

**No additional code needed** - this happens automatically when each page loads!

### Custom Event Tracking

Use the `Analytics` helper object for easy event tracking:

```javascript
// Track a generic event
Analytics.track('event_name', { 
  parameter1: 'value1',
  parameter2: 'value2' 
});

// Use predefined helper methods
Analytics.trackFormatJson({ 
  line_count: 50,
  error_count: 0 
});
```

### Available Helper Methods

#### JSON Formatter Events
- `Analytics.trackFormatJson(params)` - Track JSON formatting
- `Analytics.trackMinifyJson(params)` - Track JSON minification
- `Analytics.trackEscapeJson(params)` - Track JSON escaping
- `Analytics.trackUnescapeJson(params)` - Track JSON unescaping
- `Analytics.trackUploadFile(params)` - Track file uploads
- `Analytics.trackFetchFromUrl(params)` - Track URL fetching
- `Analytics.trackDownloadJson(params)` - Track JSON downloads
- `Analytics.trackCopyContent(params)` - Track content copying
- `Analytics.trackFullscreenMode(params)` - Track fullscreen toggles

#### DeepLink Launcher Events
- `Analytics.trackEncodeDeeplink(params)` - Track deeplink encoding
- `Analytics.trackDecodeDeeplink(params)` - Track deeplink decoding
- `Analytics.trackLaunchDeeplink(params)` - Track deeplink launches
- `Analytics.trackGenerateQrFromDeeplink(params)` - Track QR generation from deeplink
- `Analytics.trackDownloadHistoryCsv(params)` - Track CSV downloads
- `Analytics.trackImportHistoryCsv(params)` - Track CSV imports

#### QR Generator Events
- `Analytics.trackGenerateQrCode(params)` - Track QR code generation
- `Analytics.trackDownloadQrCode(params)` - Track QR code downloads
- `Analytics.trackCopyQrUrl(params)` - Track QR URL copying

#### General Events
- `Analytics.trackThemeToggle(params)` - Track theme changes
- `Analytics.trackBookmarkAdd(params)` - Track bookmark additions
- `Analytics.trackFeedbackSubmit(params)` - Track feedback submissions

### Event Constants

For consistency, use predefined event constants:

```javascript
// Access event names
window.ANALYTICS_EVENTS.FORMAT_JSON
window.ANALYTICS_EVENTS.MINIFY_JSON
// ... etc
```

## Example Implementations

### Example 1: Track Format Button Click

```javascript
document.getElementById('format-btn').addEventListener('click', function() {
  // Your formatting logic here...
  
  // Track the event
  Analytics.trackFormatJson({
    line_count: lines.length,
    char_count: content.length,
    has_errors: errors.length > 0
  });
});
```

### Example 2: Track Theme Toggle

```javascript
document.getElementById('theme-toggle').addEventListener('click', function() {
  const newTheme = theme === 'dark' ? 'light' : 'dark';
  
  // Track the event
  Analytics.trackThemeToggle({
    theme: newTheme,
    previous_theme: theme
  });
});
```

### Example 3: Track File Upload

```javascript
document.getElementById('upload-file').addEventListener('change', function(e) {
  const file = e.target.files[0];
  
  // Process file...
  
  // Track the event
  Analytics.trackUploadFile({
    file_name: file.name,
    file_size: file.size,
    file_type: file.type
  });
});
```

## Privacy & Compliance

### Privacy Features
- ✅ IP anonymization enabled
- ✅ Only aggregates traffic patterns
- ✅ No personally identifiable information collected
- ✅ No content tracking (JSON data is never sent)
- ✅ Disabled on localhost/development

### User Opt-Out

Users can opt out of analytics in several ways:
1. **Browser Settings** - Disable cookies
2. **Google Analytics Opt-Out** - Install the [official browser add-on](https://tools.google.com/dlpage/gaoptout)
3. **Development Environment** - Analytics automatically disabled

### Privacy Policy

Our privacy policy mentions GA4 usage. See `privacy.html` section 3.

## Development

### Testing Locally

Analytics is automatically disabled when running on:
- `localhost`
- `127.0.0.1`

To test analytics, you need to:
1. Deploy to a staging/production environment
2. Or temporarily modify `DISABLED_HOSTNAMES` in `analytics.js`

### Debugging

In development, you'll see console logs:
```
Analytics disabled for localhost/development environment
```

## Maintenance

### Changing the Measurement ID

Update `ANALYTICS_CONFIG.GA4_MEASUREMENT_ID` in `assets/js/analytics.js`.

### Adding New Events

1. Add event name to `ANALYTICS_EVENTS` object:
```javascript
const ANALYTICS_EVENTS = {
  // ... existing events
  MY_NEW_EVENT: 'my_new_event'
};
```

2. Add helper method to `Analytics` object:
```javascript
const Analytics = {
  // ... existing methods
  trackMyNewEvent: (params) => trackEvent(ANALYTICS_EVENTS.MY_NEW_EVENT, params)
};
```

3. Use in your code:
```javascript
Analytics.trackMyNewEvent({ custom_param: 'value' });
```

## References

- [Google Analytics 4 Documentation](https://developers.google.com/analytics/devguides/collection/ga4)
- [GA4 Events Documentation](https://developers.google.com/analytics/devguides/collection/ga4/events)
- [Privacy Controls for GA4](https://support.google.com/analytics/answer/9019185)

