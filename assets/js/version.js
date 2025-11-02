// version.js - Version tracking utility
let appVersion = {
  version: "1.0",
  buildDate: "2024-01-15",
  releaseName: "Initial Release"
};

async function loadVersion() {
  try {
    // Add cache busting with timestamp to ensure we get the latest version
    // In production, you might want to use the version number instead: ?v=${appVersion.version}
    const cacheBuster = Date.now();
    const response = await fetch(`/version.json?t=${cacheBuster}`);
    if (response.ok) {
      const data = await response.json();
      appVersion = data;
      // Update window.appVersion after fetch completes
      if (typeof window !== 'undefined') {
        window.appVersion = appVersion;
        // Dispatch event to notify that version has been updated
        window.dispatchEvent(new CustomEvent('versionLoaded', { detail: appVersion }));
      }
    }
  } catch (error) {
    // Fallback to default version
    // Track error in GA4 if analytics is available
    if (typeof window !== 'undefined' && window.Analytics) {
      const errorMessage = error.message || String(error);
      const errorName = error.name || 'VersionLoadError';
      
      window.Analytics.trackVersionLoadFailed({
        error_name: errorName,
        error_message: errorMessage,
        error_type: 'version_load_error',
        page: window.getCurrentPageNameForAnalytics ? window.getCurrentPageNameForAnalytics() : 'Unknown',
        url: window.location.href,
        default_version: appVersion.version
      });
    }
    // Note: Error is tracked in GA4, no console logging to keep console clean
  }
}

loadVersion();

function getBrowserInfo() {
  const ua = navigator.userAgent;
  let browser = "Unknown";
  let browserVersion = "Unknown";
  let os = "Unknown";
  
  if (ua.includes("Chrome") && !ua.includes("Edg") && !ua.includes("OPR")) {
    browser = "Chrome";
    browserVersion = ua.match(/Chrome\/(\d+)/)?.[1] || "Unknown";
  } else if (ua.includes("Firefox")) {
    browser = "Firefox";
    browserVersion = ua.match(/Firefox\/(\d+)/)?.[1] || "Unknown";
  } else if (ua.includes("Edg")) {
    browser = "Edge";
    browserVersion = ua.match(/Edg\/(\d+)/)?.[1] || "Unknown";
  } else if (ua.includes("Safari") && !ua.includes("Chrome")) {
    browser = "Safari";
    browserVersion = ua.match(/Version\/(\d+)/)?.[1] || "Unknown";
  } else if (ua.includes("OPR")) {
    browser = "Opera";
    browserVersion = ua.match(/OPR\/(\d+)/)?.[1] || "Unknown";
  }
  
  if (ua.includes("Windows NT")) os = "Windows";
  else if (ua.includes("Mac OS X") || ua.includes("Macintosh")) os = "Mac OS";
  else if (ua.includes("Linux")) os = "Linux";
  else if (ua.includes("Android")) os = "Android";
  else if (ua.includes("iPhone") || ua.includes("iPad")) os = "iOS";
  
  return {
    browser,
    browserVersion,
    os,
    userAgent: ua,
    language: navigator.language,
    platform: navigator.platform,
    cookieEnabled: navigator.cookieEnabled,
    onLine: navigator.onLine,
    screenResolution: `${window.screen.width}x${window.screen.height}`,
    viewportResolution: `${window.innerWidth}x${window.innerHeight}`,
    colorDepth: window.screen.colorDepth + 'bit',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    timezoneOffset: new Date().getTimezoneOffset()
  };
}

function getPageInfo() {
  return {
    url: window.location.href,
    path: window.location.pathname,
    referrer: document.referrer,
    hostname: window.location.hostname,
    protocol: window.location.protocol,
    loadTime: performance.now(),
    connectionType: navigator.connection ? {
      effectiveType: navigator.connection.effectiveType,
      downlink: navigator.connection.downlink,
      rtt: navigator.connection.rtt,
      saveData: navigator.connection.saveData
    } : null
  };
}

// Initialize Sentry tracking - DISABLED on localhost
function initSentryTracking() {
  const hostname = window.location.hostname;
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return;
  }
  
  // Note: Sentry.setTag is not available with Loader Script
  // Only Sentry.getCurrentHub().getClient().setTag() works
  // For now, we'll just provide version as context
}

if (typeof window !== 'undefined') {
  window.appVersion = appVersion;
  window.initSentryTracking = initSentryTracking;
  window.getBrowserInfo = getBrowserInfo;
  window.getPageInfo = getPageInfo;
}
