# Analytics Guide - Bharat Dev Tools

## Overview

Bharat Dev Tools uses **Google Analytics 4 (GA4)** for web analytics. Analytics is automatically disabled on `localhost` and `127.0.0.1` to prevent test data from polluting production analytics.

**Measurement ID:** `G-H00TEVH9KG`

---

## How to Enable Analytics on Localhost (For Testing)

### Step 1: Enable Analytics

1. Open `assets/js/analytics.js`
2. Find line 12 with `DISABLED_HOSTNAMES`
3. Comment out the array:

```javascript
const ANALYTICS_CONFIG = {
  GA4_MEASUREMENT_ID: 'G-H00TEVH9KG',
  
  // Temporarily enable for localhost testing
  DISABLED_HOSTNAMES: [], // ['localhost', '127.0.0.1'],
  
  // ... rest of config
};
```

4. Save the file and reload your page

⚠️ **Important:** Remember to revert this change after testing!

---

## How to Verify Analytics (2 Methods)

### Method 1: Browser Console + Network Tab (Quick Verification)

**Step 1: Check Analytics is Loaded**

Open browser console (F12) and run:

```javascript
// Check if analytics loaded
console.log('gtag loaded:', typeof window.gtag !== 'undefined');
console.log('Analytics object:', typeof window.Analytics !== 'undefined');
console.log('DataLayer:', window.dataLayer);
```

**Expected Results:**
- ✅ `gtag loaded: true`
- ✅ `Analytics object: true`
- ✅ `DataLayer: [array with events]`

**Step 2: Check Network Requests**

1. Open **Network** tab in DevTools
2. Filter by: `gtag` or `collect`
3. Reload the page
4. Look for requests to:
   - `https://www.googletagmanager.com/gtag/js?id=G-H00TEVH9KG`
   - `https://www.google-analytics.com/g/collect?...`

**Expected Results:**
- ✅ Should see `gtag/js` request (script load)
- ✅ Should see `collect` requests (events being sent)
- ✅ Status: `200 OK`

**Step 3: Test an Event**

In browser console:

```javascript
// Send a test event
if (window.Analytics) {
  window.Analytics.track('test_event', {
    test: true,
    timestamp: new Date().toISOString()
  });
  console.log('✅ Test event sent!');
  console.log('Latest dataLayer:', window.dataLayer[window.dataLayer.length - 1]);
}
```

**Expected Results:**
- ✅ New entry in `dataLayer`
- ✅ Network request to `google-analytics.com/g/collect` appears

---

### Method 2: Google Analytics DebugView (Real-Time Verification)

**Step 1: Enable Debug Mode**

**Option A: Chrome Extension (Recommended)**
1. Install [Google Analytics Debugger](https://chrome.google.com/webstore/detail/google-analytics-debugger/jnkmfdileelhofjcijamephohjechhna)
2. Enable the extension
3. Visit your website

**Option B: URL Parameter**
Add `?debug_mode=true` to your URL:
```
http://localhost:8000/?debug_mode=true
```

**Step 2: View Events in Real-Time**

1. Go to [Google Analytics](https://analytics.google.com/)
2. Select property: **Bharat Dev Tools** (G-H00TEVH9KG)
3. Navigate to: **Configure → DebugView**
4. Perform actions on your site (click buttons, navigate pages)

**Expected Results:**
- ✅ Page views appear immediately
- ✅ Custom events appear as they happen
- ✅ Event parameters are visible
- ✅ User properties are shown

**Step 3: Verify in Real-Time Report**

1. Go to: **Reports → Realtime**
2. Check:
   - **Users by Page title** - Should show your page name
   - **Event count** - Should increase as you interact
   - **Top events** - Should show events like `format_json`, `button_click_format`, etc.

---

## Post-Verification Actions

### 1. Revert Localhost Changes

**Before committing code:**

1. Open `assets/js/analytics.js`
2. Uncomment the `DISABLED_HOSTNAMES` array:

```javascript
DISABLED_HOSTNAMES: ['localhost', '127.0.0.1'],
```

3. Save and commit

### 2. Verify Production Analytics

After deploying to production:

1. Visit `https://bharatdevtool.com`
2. Open browser console and verify analytics is loaded
3. Check Network tab for GA4 requests
4. Verify events appear in GA4 DebugView/Realtime reports

### 3. Set Up Domain Restrictions (Security)

**In Google Analytics Dashboard:**

1. Go to **Admin** → **Data Streams** → Select your stream
2. Click **Configure tag settings**
3. Add **Allowed domains**:
   ```
   bharatdevtool.com
   www.bharatdevtool.com
   ```
4. Enable **Restrict to known domains**

This prevents unauthorized domains from sending events to your GA4 property.

### 4. Enable Bot Filtering

1. Go to **Admin** → **Data Streams** → **Configure tag settings**
2. Enable **"Exclude all hits from known bots and spiders"**

---

## Quick Reference

### Check Analytics Status

```javascript
// Quick status check
console.log({
  gtag: typeof window.gtag,
  Analytics: typeof window.Analytics,
  dataLayer: window.dataLayer?.length || 0,
  hostname: window.location.hostname,
  enabled: !['localhost', '127.0.0.1'].includes(window.location.hostname)
});
```

### Common Issues

**Issue: Analytics not loading on localhost**
- ✅ This is expected - analytics is disabled by default
- ✅ Enable it using Step 1 above

**Issue: Events not appearing in GA4**
- ✅ Wait 24-48 hours for standard reports (DebugView shows immediately)
- ✅ Check ad blockers (they may block GA4)
- ✅ Verify Measurement ID: `G-H00TEVH9KG`

**Issue: Analytics disabled on production**
- ✅ Check hostname is not in `DISABLED_HOSTNAMES`
- ✅ Verify `analytics.js` is included in HTML

---

## Security Notes

- ✅ **GA4 Measurement IDs are public by design** - this is not a security risk
- ✅ **IP anonymization is enabled** - GDPR compliant
- ✅ **Domain restrictions recommended** - prevents unauthorized events
- ✅ **Bot filtering enabled** - reduces spam traffic

---

## Summary

**To Test Analytics Locally:**
1. Enable in `analytics.js` (comment out `DISABLED_HOSTNAMES`)
2. Verify using Browser Console + Network Tab OR GA4 DebugView
3. Revert changes before committing

**To Verify Production:**
1. Check browser console for `window.gtag`
2. Check Network tab for GA4 requests
3. Verify in GA4 Realtime/DebugView

**Your Analytics ID:** `G-H00TEVH9KG`
