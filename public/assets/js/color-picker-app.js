// color-picker-app.js - Color Picker Application Logic
// Bharat Dev Tools - Color Picker Tool

// Color utilities are loaded from color-utils.js and available via window.ColorUtils

// Application state
let appState = {
  currentColor: { r: 74, g: 144, b: 226, a: 255 }, // Default: #4A90E2 (soft blue)
  recentColors: [],
  favorites: [],
  history: [], // For undo/redo
  historyIndex: -1,
  isNavigatingHistory: false, // Flag to prevent adding to history during undo/redo
  isUpdatingFromPicker: false, // Flag to prevent update loops between picker and inputs
  isInitialLoad: true // Flag to prevent URL hash update on initial load
};

// iro.js color picker instance
let iroColorPicker = null;
let isInitializingIro = false; // Flag to track initialization state
let isHexEditMode = false; // Flag to track HEX input edit mode

// Image picker state
let imagePickerState = {
  image: null,
  canvas: null,
  ctx: null
};

// Load state from localStorage
function loadState() {
  try {
    const saved = localStorage.getItem('colorPickerState');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.recentColors) appState.recentColors = parsed.recentColors;
      if (parsed.favorites) appState.favorites = parsed.favorites;
    }
  } catch (error) {
    if (typeof window.Analytics !== 'undefined') {
      window.Analytics.track('color_picker_load_state_failed', {
        error: error.message,
        page: getCurrentPageNameForAnalytics()
      });
    }
  }
}

// Save state to localStorage
function saveState() {
  try {
    localStorage.setItem('colorPickerState', JSON.stringify({
      recentColors: appState.recentColors.slice(0, 20),
      favorites: appState.favorites
    }));
  } catch (error) {
    if (typeof window.Analytics !== 'undefined') {
      window.Analytics.track('color_picker_save_state_failed', {
        error: error.message,
        page: getCurrentPageNameForAnalytics()
      });
    }
  }
}

// Get current page name for analytics
function getCurrentPageNameForAnalytics() {
  return 'color_picker';
}

// UI Freeze Detection Utility
function detectUIFreeze(operationName, operationFunction) {
  return new Promise((resolve, reject) => {
    const startTime = performance.now();
    let lastCheckTime = startTime;
    let maxFreezeDuration = 0;
    
    // Use requestIdleCallback or setTimeout to detect freezes
    function checkFreeze() {
      const currentTime = performance.now();
      const timeSinceLastCheck = currentTime - lastCheckTime;
      
      // If more than 100ms passed, UI was likely frozen
      if (timeSinceLastCheck > 100) {
        const freezeDuration = timeSinceLastCheck;
        maxFreezeDuration = Math.max(maxFreezeDuration, freezeDuration);
        
        // Track freeze event
        if (typeof window.Analytics !== 'undefined') {
          window.Analytics.track('ui_freeze', {
            operation: operationName,
            freeze_duration_ms: freezeDuration,
            page: getCurrentPageNameForAnalytics(),
            timestamp: currentTime
          });
        }
        
        // Log to Sentry
        if (typeof Sentry !== 'undefined') {
          Sentry.addBreadcrumb({
            message: 'UI freeze detected',
            category: 'performance',
            level: 'warning',
            data: {
              operation: operationName,
              freezeDuration: freezeDuration,
              page: getCurrentPageNameForAnalytics()
            }
          });
        }
      }
      
      lastCheckTime = currentTime;
    }
    
    // Check for freezes periodically
    const checkInterval = setInterval(checkFreeze, 50);
    
    // Run the operation
    try {
      const result = operationFunction();
      
      // If it's a promise, wait for it
      if (result instanceof Promise) {
        result.then((data) => {
          clearInterval(checkInterval);
          const totalTime = performance.now() - startTime;
          
          // Track completion with freeze info
          if (maxFreezeDuration > 0 && typeof window.Analytics !== 'undefined') {
            window.Analytics.track('operation_complete', {
              operation: operationName,
              total_time_ms: totalTime,
              max_freeze_duration_ms: maxFreezeDuration,
              page: getCurrentPageNameForAnalytics()
            });
          }
          
          resolve(data);
        }).catch((error) => {
          clearInterval(checkInterval);
          reject(error);
        });
      } else {
        clearInterval(checkInterval);
        const totalTime = performance.now() - startTime;
        
        if (maxFreezeDuration > 0 && typeof window.Analytics !== 'undefined') {
          window.Analytics.track('operation_complete', {
            operation: operationName,
            total_time_ms: totalTime,
            max_freeze_duration_ms: maxFreezeDuration,
            page: getCurrentPageNameForAnalytics()
          });
        }
        
        resolve(result);
      }
    } catch (error) {
      clearInterval(checkInterval);
      reject(error);
    }
  });
}

// Initialize color picker from URL hash
function initFromUrl() {
  if (!window.ColorUtils) return;
  const hash = window.location.hash.substring(1);
  if (hash) {
    const color = window.ColorUtils.parseColor(decodeURIComponent(hash));
    if (color) {
      appState.currentColor = color;
      updateColorPicker();
      updateAllDisplays();
    } else {
      // Invalid hash, reset to default
      appState.currentColor = { r: 74, g: 144, b: 226, a: 255 }; // #4A90E2
      window.history.replaceState(null, '', window.location.pathname);
    }
  } else {
    // No hash, ensure default color
    appState.currentColor = { r: 74, g: 144, b: 226, a: 255 }; // #4A90E2
  }
}

// Update URL hash with current color
function updateUrl() {
  if (!window.ColorUtils) return;
  // Don't update URL hash on initial load to prevent random colors on refresh
  if (appState.isInitialLoad) return;
  const hex = window.ColorUtils.formatAsHex(appState.currentColor);
  window.history.replaceState(null, '', `#${hex.substring(1)}`);
}

// Update color picker inputs
function updateColorPicker() {
  if (!window.ColorUtils) return;
  const rgb = appState.currentColor;
  
  // Ensure RGB values are valid numbers
  if (!rgb || typeof rgb.r !== 'number' || typeof rgb.g !== 'number' || typeof rgb.b !== 'number') {
    return;
  }
  
  // Ensure alpha is set (default to 255 if not provided)
  if (rgb.a === undefined || rgb.a === null) {
    rgb.a = 255;
  }
  
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
  
  // Only update HEX input if not in edit mode
  if (!isHexEditMode) {
    const hexInput = document.getElementById('color-hex');
    if (hexInput) {
      hexInput.value = window.ColorUtils.formatAsHex(rgb);
    }
  }
  document.getElementById('color-r').value = rgb.r;
  document.getElementById('color-g').value = rgb.g;
  document.getElementById('color-b').value = rgb.b;
  document.getElementById('color-a').value = Math.round((rgb.a / 255) * 100);
  
  document.getElementById('color-h').value = hsl.h;
  document.getElementById('color-s').value = hsl.s;
  document.getElementById('color-l').value = hsl.l;
  
  // Update color preview
  const preview = document.getElementById('color-preview');
  if (preview) {
    // Ensure RGB values are valid
    const r = Math.max(0, Math.min(255, rgb.r || 0));
    const g = Math.max(0, Math.min(255, rgb.g || 0));
    const b = Math.max(0, Math.min(255, rgb.b || 0));
    const alpha = (rgb.a !== undefined && rgb.a !== null) ? Math.max(0, Math.min(1, rgb.a / 255)) : 1;
    const bgColor = `rgba(${r}, ${g}, ${b}, ${alpha})`;
    preview.style.backgroundColor = bgColor;
    
    // Ensure the element is visible
    preview.style.display = 'block';
    preview.style.opacity = '1';
    preview.style.visibility = 'visible';
  }
  
  // Update iro.js color picker if initialized
  // Skip during initialization to prevent race conditions
  if (iroColorPicker && !appState.isUpdatingFromPicker && !isInitializingIro) {
    const hex = window.ColorUtils.formatAsHex(rgb);
    // Set flag to prevent picker from updating inputs
    appState.isUpdatingFromPicker = true;
    // Update color - this will update both Wheel and Box positions
    iroColorPicker.color.set({
      hex: hex,
      alpha: rgb.a / 255
    });
    // Reset flag after a short delay
    setTimeout(() => {
      appState.isUpdatingFromPicker = false;
    }, 50); // Small delay to ensure iro.js update is complete
    
    // Update transparency value display
    const transparencyValueEl = document.getElementById('transparency-value');
    if (transparencyValueEl && transparencyValueEl.tagName === 'INPUT') {
      const alpha = rgb.a / 255;
      transparencyValueEl.value = Math.round(alpha * 100);
    }
  }
}

// Convert RGB to HSL (helper)
function rgbToHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;
  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

/**
 * Initialize iro.js color picker
 * Follows cursor rules: error handling, analytics tracking, production-ready
 */
function initializeIroColorPicker() {
  if (typeof iro === 'undefined' || typeof iro.ColorPicker === 'undefined') {
    // iro.js not loaded yet, retry after a delay (max 10 retries = 2 seconds)
    if (!initializeIroColorPicker.retryCount) {
      initializeIroColorPicker.retryCount = 0;
    }
    if (initializeIroColorPicker.retryCount < 20) {
      initializeIroColorPicker.retryCount++;
      setTimeout(initializeIroColorPicker, 100);
      return;
    } else {
      // Fallback: show error message
      const container = document.getElementById('iro-color-picker');
      if (container) {
        container.innerHTML = '<div class="text-center p-4 text-red-600 dark:text-red-400">Failed to load color picker. Please refresh the page.</div>';
      }
      return;
    }
  }
  
  try {
    const container = document.getElementById('iro-color-picker');
    if (!container) {
      if (typeof window.Analytics !== 'undefined') {
        window.Analytics.track('color_picker_iro_init_failed', {
          error: 'Container element not found',
          page: getCurrentPageNameForAnalytics()
        });
      }
      return;
    }
    
    // Get initial color
    const initialHex = window.ColorUtils ? window.ColorUtils.formatAsHex(appState.currentColor) : '#4A90E2';
    const initialAlpha = appState.currentColor.a !== undefined ? appState.currentColor.a / 255 : 1;
    
    // Calculate responsive width for mobile
    const isMobile = window.innerWidth < 640;
    const pickerWidth = isMobile ? Math.min(280, window.innerWidth - 32) : 300;
    
    // Initialize iro.js color picker
    iroColorPicker = new iro.ColorPicker(container, {
      width: pickerWidth,
      color: {
        hex: initialHex,
        alpha: initialAlpha
      },
      layout: [
        {
          component: iro.ui.Wheel
        },
        {
          component: iro.ui.Box
        },
        {
          component: iro.ui.Slider,
          options: {
            sliderType: 'alpha'
          }
        }
      ],
      layoutDirection: 'vertical'
    });
    
    // Set initialization flag
    isInitializingIro = true;
    
    // Ensure the color is properly set after initialization
    // Use requestAnimationFrame to ensure DOM is fully rendered before setting color
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (iroColorPicker) {
          // Convert to HSV format which works better for Box component
          const rgb = window.ColorUtils ? window.ColorUtils.hexToRgb(initialHex) : null;
          if (rgb) {
            const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
            // Set color using HSV format to ensure Box component renders correctly
            iroColorPicker.color.set({
              h: hsl.h,
              s: hsl.s,
              v: hsl.l, // Value = lightness for HSV
              alpha: initialAlpha
            });
          } else {
            // Fallback to hex if conversion fails
            iroColorPicker.color.set({
              hex: initialHex,
              alpha: initialAlpha
            });
          }
          // Clear initialization flag after a short delay
          setTimeout(() => {
            isInitializingIro = false;
          }, 100);
        }
      });
    });
    
    // Handle window resize for mobile responsiveness
    let resizeTimeout;
    window.addEventListener('resize', function() {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(function() {
        if (iroColorPicker && container) {
          const newWidth = window.innerWidth < 640 
            ? Math.min(280, window.innerWidth - 32) 
            : 300;
          iroColorPicker.resize(newWidth);
        }
      }, 250);
    });
    
    // Debounce function for color updates
    let colorUpdateTimeout = null;
    
    // Handle color changes from iro.js with debouncing
    iroColorPicker.on('color:change', function(color) {
      // Skip if we're updating from input field to avoid loops
      if (appState.isUpdatingFromPicker) {
        return;
      }
      
      // Clear previous timeout
      if (colorUpdateTimeout) {
        clearTimeout(colorUpdateTimeout);
      }
      
      // Debounce updates - only update when user stops moving (300ms delay)
      colorUpdateTimeout = setTimeout(() => {
        try {
          // Get alpha from iro.js color object (includes slider changes)
          const alpha = color.alpha !== undefined ? Math.round(color.alpha * 255) : 255;
          
          // Convert iro.js color to RGB
          const rgb = window.ColorUtils ? window.ColorUtils.hexToRgb(color.hexString) : null;
          if (rgb) {
            // Set alpha value from slider
            rgb.a = alpha;
            appState.currentColor = rgb;
            // Set flag to prevent loop when updating inputs
            appState.isUpdatingFromPicker = true;
            updateAllDisplays();
            // Reset flag after update
            setTimeout(() => {
              appState.isUpdatingFromPicker = false;
            }, 50); // Small delay to ensure all updates propagate
            
            // Update transparency value display
            const transparencyValueEl = document.getElementById('transparency-value');
            if (transparencyValueEl && transparencyValueEl.tagName === 'INPUT') {
              transparencyValueEl.value = Math.round(color.alpha * 100);
            }
          }
        } catch (error) {
          if (typeof window.Analytics !== 'undefined') {
            window.Analytics.track('color_picker_iro_change_error', {
              error: error.message,
              page: getCurrentPageNameForAnalytics()
            });
          }
        }
      }, 300); // 300ms debounce delay
    });
    
    // Track successful initialization
    if (typeof window.Analytics !== 'undefined') {
      window.Analytics.track('color_picker_iro_initialized', {
        page: getCurrentPageNameForAnalytics()
      });
    }
  } catch (error) {
    if (typeof window.Analytics !== 'undefined') {
      window.Analytics.track('color_picker_iro_init_failed', {
        error: error.message,
        page: getCurrentPageNameForAnalytics()
      });
    }
    
    // Log to Sentry if available
    if (typeof Sentry !== 'undefined') {
      Sentry.captureException(error, {
        tags: { component: 'color_picker', operation: 'iro_init' },
        extra: { page: getCurrentPageNameForAnalytics() }
      });
    }
  }
}

// Update all color displays
function updateAllDisplays(skipHistory = false) {
  updateColorPicker();
  updatePalettes();
  updateContrast();
  updateColorBlindness();
  updateExports();
  updateUrl();
  
  // Add to recent colors
  addToRecentColors(appState.currentColor);
  
  // Add to history for undo/redo (unless navigating history)
  if (!skipHistory && !appState.isNavigatingHistory) {
    addToHistory();
  }
}

// Update palette displays
function updatePalettes() {
  if (!window.ColorUtils) return;
  
  // Wrap heavy palette generation operations with UI freeze detection
  detectUIFreeze('update_palettes', () => {
    const rgb = { r: appState.currentColor.r, g: appState.currentColor.g, b: appState.currentColor.b };
    
    // Lighter shades
    const lighter = window.ColorUtils.generateLighterShades(rgb, 5);
    updatePaletteDisplay('lighter-shades', lighter);
    
    // Darker shades
    const darker = window.ColorUtils.generateDarkerShades(rgb, 5);
    updatePaletteDisplay('darker-shades', darker);
    
    // Complementary
    const comp = window.ColorUtils.generateComplementary(rgb);
    updatePaletteDisplay('complementary', [comp]);
    
    // Monochrome
    const mono = window.ColorUtils.generateMonochrome(rgb, 5);
    updatePaletteDisplay('monochrome', mono);
    
    // Split complementary
    const split = window.ColorUtils.generateSplitComplementary(rgb);
    updatePaletteDisplay('split-complementary', split);
    
    // Triadic
    const triadic = window.ColorUtils.generateTriadic(rgb);
    updatePaletteDisplay('triadic', triadic);
    
    // Tetradic
    const tetradic = window.ColorUtils.generateTetradic(rgb);
    updatePaletteDisplay('tetradic', tetradic);
    
    // Tailwind shades
    const tailwind = window.ColorUtils.generateTailwindShades(rgb);
    updateTailwindDisplay(tailwind);
    
    // Material palette
    const material = window.ColorUtils.generateMaterialPalette(rgb);
    updateMaterialDisplay(material);
  }).catch((error) => {
    if (typeof window.Analytics !== 'undefined') {
      window.Analytics.track('palette_update_failed', {
        error: error.message,
        page: getCurrentPageNameForAnalytics()
      });
    }
  });
}

// Update palette display
function updatePaletteDisplay(containerId, colors) {
  if (!window.ColorUtils) return;
  const container = document.getElementById(containerId);
  if (!container) return;
  
  container.innerHTML = '';
  colors.forEach(color => {
    const item = document.createElement('div');
    item.className = 'palette-item';
    item.style.backgroundColor = window.ColorUtils.formatAsRgb(color);
    item.title = window.ColorUtils.formatAsHex(color);
    item.addEventListener('click', () => {
      appState.currentColor = color;
      updateAllDisplays();
      copyToClipboard(window.ColorUtils.formatAsHex(color), 'Color copied!');
    });
    container.appendChild(item);
  });
}

// Update Tailwind display
function updateTailwindDisplay(shades) {
  if (!window.ColorUtils) return;
  const container = document.getElementById('tailwind-shades');
  if (!container) return;
  
  container.innerHTML = '';
  Object.keys(shades).sort((a, b) => parseInt(a) - parseInt(b)).forEach(key => {
    const color = shades[key];
    const item = document.createElement('div');
    item.className = 'shade-item';
    item.innerHTML = `
      <div class="shade-color" style="background-color: ${window.ColorUtils.formatAsRgb(color)}"></div>
      <div class="shade-info">
        <div class="shade-label">${key}</div>
        <div class="shade-value">${window.ColorUtils.formatAsHex(color)}</div>
      </div>
    `;
    item.addEventListener('click', () => {
      appState.currentColor = color;
      updateAllDisplays();
      copyToClipboard(window.ColorUtils.formatAsHex(color), 'Color copied!');
    });
    container.appendChild(item);
  });
}

// Update Material display
function updateMaterialDisplay(palette) {
  if (!window.ColorUtils) return;
  const container = document.getElementById('material-palette');
  if (!container) return;
  
  container.innerHTML = '';
  const order = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', 'A100', 'A200', 'A400', 'A700'];
  order.forEach(key => {
    if (!palette[key]) return;
    const color = palette[key];
    const item = document.createElement('div');
    item.className = 'shade-item';
    item.innerHTML = `
      <div class="shade-color" style="background-color: ${window.ColorUtils.formatAsRgb(color)}"></div>
      <div class="shade-info">
        <div class="shade-label">${key}</div>
        <div class="shade-value">${window.ColorUtils.formatAsHex(color)}</div>
      </div>
    `;
    item.addEventListener('click', () => {
      appState.currentColor = color;
      updateAllDisplays();
      copyToClipboard(window.ColorUtils.formatAsHex(color), 'Color copied!');
    });
    container.appendChild(item);
  });
}

// Update contrast display
function updateContrast() {
  if (!window.ColorUtils) return;
  const rgb = { r: appState.currentColor.r, g: appState.currentColor.g, b: appState.currentColor.b };
  const white = { r: 255, g: 255, b: 255 };
  const black = { r: 0, g: 0, b: 0 };
  
  const whiteRatio = window.ColorUtils.getContrastRatio(rgb, white);
  const blackRatio = window.ColorUtils.getContrastRatio(rgb, black);
  
  document.getElementById('contrast-white').textContent = whiteRatio.toFixed(2);
  document.getElementById('contrast-black').textContent = blackRatio.toFixed(2);
  
  const whiteAA = window.ColorUtils.meetsWCAGAA(whiteRatio, false);
  const whiteAAA = window.ColorUtils.meetsWCAGAAA(whiteRatio, false);
  const blackAA = window.ColorUtils.meetsWCAGAA(blackRatio, false);
  const blackAAA = window.ColorUtils.meetsWCAGAAA(blackRatio, false);
  
  document.getElementById('contrast-white-aa').textContent = whiteAA ? '✓' : '✗';
  document.getElementById('contrast-white-aaa').textContent = whiteAAA ? '✓' : '✗';
  document.getElementById('contrast-black-aa').textContent = blackAA ? '✓' : '✗';
  document.getElementById('contrast-black-aaa').textContent = blackAAA ? '✓' : '✗';
}

/**
 * Update color blindness simulator display
 * Follows cursor rules: error handling, analytics
 */
function updateColorBlindness() {
  if (!window.ColorUtils || !window.ColorBlindnessSimulator) {
    return;
  }
  
  try {
    // Use full RGB with alpha for normal vision
    const rgb = { 
      r: appState.currentColor.r || 0, 
      g: appState.currentColor.g || 0, 
      b: appState.currentColor.b || 0, 
      a: appState.currentColor.a !== undefined ? appState.currentColor.a : 255 
    };
    const alpha = rgb.a / 255;
    
    // Normal vision
    const normalEl = document.getElementById('color-blind-normal');
    if (normalEl) {
      normalEl.style.backgroundColor = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
    }
    
    // Protanopia - simulate color blindness (alpha doesn't affect color blindness simulation)
    const protanopia = window.ColorBlindnessSimulator.simulateProtanopia(rgb);
    const protanopiaEl = document.getElementById('color-blind-protanopia');
    if (protanopiaEl && protanopia) {
      protanopiaEl.style.backgroundColor = `rgba(${protanopia.r}, ${protanopia.g}, ${protanopia.b}, ${alpha})`;
    }
    
    // Deuteranopia
    const deuteranopia = window.ColorBlindnessSimulator.simulateDeuteranopia(rgb);
    const deuteranopiaEl = document.getElementById('color-blind-deuteranopia');
    if (deuteranopiaEl && deuteranopia) {
      deuteranopiaEl.style.backgroundColor = `rgba(${deuteranopia.r}, ${deuteranopia.g}, ${deuteranopia.b}, ${alpha})`;
    }
    
    // Tritanopia
    const tritanopia = window.ColorBlindnessSimulator.simulateTritanopia(rgb);
    const tritanopiaEl = document.getElementById('color-blind-tritanopia');
    if (tritanopiaEl && tritanopia) {
      tritanopiaEl.style.backgroundColor = `rgba(${tritanopia.r}, ${tritanopia.g}, ${tritanopia.b}, ${alpha})`;
    }
  } catch (error) {
    if (typeof window.Analytics !== 'undefined') {
      window.Analytics.track('color_blindness_update_failed', {
        error: error.message,
        page: getCurrentPageNameForAnalytics()
      });
    }
    
    // Log to console in debug mode
    const DEBUG_MODE = window.location.hostname === 'localhost' || 
                       window.location.hostname === '127.0.0.1' ||
                       window.location.search.includes('debug=true');
    if (DEBUG_MODE) {
      console.error('[DEBUG] Color blindness update failed:', error);
    }
  }
}

// Update export displays
function updateExports() {
  if (!window.ColorUtils) return;
  const rgb = appState.currentColor;
  const hex = window.ColorUtils.formatAsHex(rgb);
  
  // CSS Variables
  const lighter = window.ColorUtils.generateLighterShades(rgb, 1)[0];
  const darker = window.ColorUtils.generateDarkerShades(rgb, 1)[0];
  const cssVars = `--primary: ${hex};
--primary-dark: ${window.ColorUtils.formatAsHex(darker)};
--primary-light: ${window.ColorUtils.formatAsHex(lighter)};`;
  document.getElementById('export-css-vars').textContent = cssVars;
  
  // SCSS
  const scss = `$primary: ${hex};
$primary-dark: ${window.ColorUtils.formatAsHex(darker)};
$primary-light: ${window.ColorUtils.formatAsHex(lighter)};`;
  document.getElementById('export-scss').textContent = scss;
  
  // Tailwind config
  const tailwind = `colors: {
  primary: {
    500: '${hex}',
    600: '${window.ColorUtils.formatAsHex(darker)}',
    400: '${window.ColorUtils.formatAsHex(lighter)}'
  }
}`;
  document.getElementById('export-tailwind').textContent = tailwind;
  
  // JSON
  const json = JSON.stringify({
    primary: hex,
    primaryDark: window.ColorUtils.formatAsHex(darker),
    primaryLight: window.ColorUtils.formatAsHex(lighter)
  }, null, 2);
  document.getElementById('export-json').textContent = json;
  
  // GIMP Palette (GPL)
  const gpl = `GIMP Palette
Name: Color Palette
Columns: 0
# Generated by Bharat Dev Tools Color Picker
${Math.round(rgb.r).toString().padStart(3)} ${Math.round(rgb.g).toString().padStart(3)} ${Math.round(rgb.b).toString().padStart(3)} Untitled`;
  const gplEl = document.getElementById('export-gpl');
  if (gplEl) {
    gplEl.textContent = gpl;
  }
  
  // Figma JSON
  const figma = JSON.stringify({
    name: 'Color Palette',
    colors: [
      {
        name: 'Primary',
        color: {
          r: rgb.r / 255,
          g: rgb.g / 255,
          b: rgb.b / 255
        }
      }
    ]
  }, null, 2);
  const figmaEl = document.getElementById('export-figma');
  if (figmaEl) {
    figmaEl.textContent = figma;
  }
}

// Add to recent colors
function addToRecentColors(color) {
  if (!window.ColorUtils) return;
  const hex = window.ColorUtils.formatAsHex(color);
  appState.recentColors = appState.recentColors.filter(c => window.ColorUtils.formatAsHex(c) !== hex);
  appState.recentColors.unshift(color);
  appState.recentColors = appState.recentColors.slice(0, 20);
  saveState();
  updateRecentColors();
}

// Update recent colors display
function updateRecentColors() {
  if (!window.ColorUtils) return;
  const container = document.getElementById('recent-colors');
  if (!container) return;
  
  container.innerHTML = '';
  appState.recentColors.forEach(color => {
    const item = document.createElement('div');
    item.className = 'recent-color-item';
    item.style.backgroundColor = window.ColorUtils.formatAsRgb(color);
    item.title = window.ColorUtils.formatAsHex(color);
    item.addEventListener('click', () => {
      appState.currentColor = color;
      updateAllDisplays();
    });
    container.appendChild(item);
  });
}

// Copy to clipboard with toast
function copyToClipboard(text, message = 'Copied!') {
  navigator.clipboard.writeText(text).then(() => {
    showToast(message);
    if (typeof window.Analytics !== 'undefined') {
      window.Analytics.track('color_picker_copy', {
        format: 'hex',
        page: getCurrentPageNameForAnalytics()
      });
    }
  }).catch(error => {
    if (typeof window.Analytics !== 'undefined') {
      window.Analytics.track('color_picker_copy_failed', {
        error: error.message,
        page: getCurrentPageNameForAnalytics()
      });
    }
  });
}

// Show toast notification
function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'toast show';
  toast.textContent = message;
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 2000);
}

/**
 * Initialize image color picker
 * Follows cursor rules: error handling, analytics, production-ready
 */
function initializeImagePicker() {
  const imageUpload = document.getElementById('image-upload');
  const imageCanvas = document.getElementById('image-canvas');
  const imageContainer = document.getElementById('image-picker-container');
  const clearImageBtn = document.getElementById('clear-image-btn');
  const magnifier = document.getElementById('color-magnifier');
  const pickedColorInfo = document.getElementById('picked-color-info');
  const extractBtn = document.getElementById('extract-dominant-colors-btn');
  
  if (!imageUpload || !imageCanvas) return;
  
  // Image upload handler
  imageUpload.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    try {
      if (!window.ImageColorExtractor) {
        showToast('Image color extractor not loaded');
        return;
      }
      
      const img = await window.ImageColorExtractor.createImageFromFile(file);
      
      // Calculate canvas size (max 800px width for performance)
      const maxWidth = 800;
      const scale = Math.min(maxWidth / img.width, 1);
      const canvasWidth = Math.floor(img.width * scale);
      const canvasHeight = Math.floor(img.height * scale);
      
      imageCanvas.width = canvasWidth;
      imageCanvas.height = canvasHeight;
      
      const ctx = imageCanvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvasWidth, canvasHeight);
      
      imagePickerState.image = img;
      imagePickerState.canvas = imageCanvas;
      imagePickerState.ctx = ctx;
      
      imageContainer.classList.remove('hidden');
      
      // Scroll to image container with smooth behavior
      setTimeout(() => {
        imageContainer.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'start',
          inline: 'nearest'
        });
      }, 100);
      
      if (typeof window.Analytics !== 'undefined') {
        window.Analytics.track('image_uploaded', {
          width: canvasWidth,
          height: canvasHeight,
          page: getCurrentPageNameForAnalytics()
        });
      }
    } catch (error) {
      showToast('Failed to load image');
      if (typeof window.Analytics !== 'undefined') {
        window.Analytics.track('image_upload_failed', {
          error: error.message,
          page: getCurrentPageNameForAnalytics()
        });
      }
    }
  });
  
  // Canvas click handler for color picking
  imageCanvas.addEventListener('click', (e) => {
    if (!imagePickerState.ctx || !imagePickerState.canvas) return;
    
    const rect = imageCanvas.getBoundingClientRect();
    const scaleX = imageCanvas.width / rect.width;
    const scaleY = imageCanvas.height / rect.height;
    const x = Math.floor((e.clientX - rect.left) * scaleX);
    const y = Math.floor((e.clientY - rect.top) * scaleY);
    
    // Extract color directly from canvas
    const imageData = imagePickerState.ctx.getImageData(x, y, 1, 1);
    const data = imageData.data;
    const color = {
      r: data[0],
      g: data[1],
      b: data[2],
      a: data[3]
    };
    
    if (window.ColorUtils) {
      appState.currentColor = color;
      if (iroColorPicker) {
        const hex = window.ColorUtils.formatAsHex(color);
        iroColorPicker.color.set({
          hex: hex,
          alpha: color.a / 255
        });
      }
      updateAllDisplays();
      
      if (typeof window.Analytics !== 'undefined') {
        window.Analytics.track('color_picked_from_image', {
          page: getCurrentPageNameForAnalytics()
        });
      }
    }
  });
  
  // Mouse move handler for magnifier
  imageCanvas.addEventListener('mousemove', (e) => {
    if (!imagePickerState.ctx) return;
    
    const rect = imageCanvas.getBoundingClientRect();
    const scaleX = imageCanvas.width / rect.width;
    const scaleY = imageCanvas.height / rect.height;
    const x = Math.floor((e.clientX - rect.left) * scaleX);
    const y = Math.floor((e.clientY - rect.top) * scaleY);
    
    // Position magnifier just below cursor, or above if near bottom of screen
    const magnifierSize = 100;
    const offset = 15; // Distance from cursor
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    
    // Check if we're near the bottom of the viewport
    const isNearBottom = e.clientY > viewportHeight - magnifierSize - offset - 50;
    // Check if we're near the right edge
    const isNearRight = e.clientX > viewportWidth - magnifierSize - 20;
    
    let left, top;
    
    if (isNearBottom) {
      // Position above cursor
      top = e.clientY - magnifierSize - offset;
    } else {
      // Position below cursor
      top = e.clientY + offset;
    }
    
    if (isNearRight) {
      // Position to the left of cursor
      left = e.clientX - magnifierSize - offset;
    } else {
      // Position to the right of cursor (or center horizontally)
      left = e.clientX - magnifierSize / 2;
    }
    
    // Ensure magnifier stays within viewport bounds
    left = Math.max(10, Math.min(left, viewportWidth - magnifierSize - 10));
    top = Math.max(10, Math.min(top, viewportHeight - magnifierSize - 10));
    
    magnifier.style.left = left + 'px';
    magnifier.style.top = top + 'px';
    magnifier.classList.remove('hidden');
    
    // Create magnified view
    const magCanvas = document.createElement('canvas');
    magCanvas.width = 100;
    magCanvas.height = 100;
    const magCtx = magCanvas.getContext('2d');
    
    const magSize = 20;
    const sourceX = Math.max(0, Math.min(imageCanvas.width - magSize, x - magSize / 2));
    const sourceY = Math.max(0, Math.min(imageCanvas.height - magSize, y - magSize / 2));
    
    magCtx.drawImage(
      imageCanvas,
      sourceX, sourceY, magSize, magSize,
      0, 0, 100, 100
    );
    
    magnifier.innerHTML = '';
    magnifier.appendChild(magCanvas);
    
    // Show color info
    if (imagePickerState.ctx) {
      const imageData = imagePickerState.ctx.getImageData(x, y, 1, 1);
      const data = imageData.data;
      const color = {
        r: data[0],
        g: data[1],
        b: data[2],
        a: data[3]
      };
      
      if (window.ColorUtils) {
        const hex = window.ColorUtils.formatAsHex(color);
        const rgb = window.ColorUtils.formatAsRgb(color);
        
        document.getElementById('picked-color-hex').textContent = hex;
        document.getElementById('picked-color-rgb').textContent = rgb;
        pickedColorInfo.classList.remove('hidden');
      }
    }
  });
  
  imageCanvas.addEventListener('mouseleave', () => {
    magnifier.classList.add('hidden');
    pickedColorInfo.classList.add('hidden');
  });
  
  // Extract dominant colors
  if (extractBtn) {
    extractBtn.addEventListener('click', async () => {
      if (!window.ImageColorExtractor || !imagePickerState.image) return;
      
      try {
        // Wrap heavy color extraction with UI freeze detection
        const colors = await detectUIFreeze('extract_dominant_colors', () => {
          return window.ImageColorExtractor.extractDominantColors(imagePickerState.image, 5);
        });
        
        const container = document.getElementById('dominant-colors-container');
        
        if (container) {
          container.innerHTML = '';
          container.classList.remove('hidden');
          
          colors.forEach(color => {
            if (!window.ColorUtils) return;
            const item = document.createElement('div');
            const hex = window.ColorUtils.formatAsHex(color);
            item.className = 'dominant-color-item';
            item.style.backgroundColor = window.ColorUtils.formatAsRgb(color);
            item.dataset.hex = hex;
            item.title = hex;
            item.addEventListener('click', () => {
              appState.currentColor = color;
              if (iroColorPicker) {
                iroColorPicker.color.set({
                  hex: hex,
                  alpha: color.a / 255
                });
              }
              updateAllDisplays();
            });
            container.appendChild(item);
          });
          
          if (typeof window.Analytics !== 'undefined') {
            window.Analytics.track('dominant_colors_extracted', {
              count: colors.length,
              page: getCurrentPageNameForAnalytics()
            });
          }
        }
      } catch (error) {
        showToast('Failed to extract colors');
        if (typeof window.Analytics !== 'undefined') {
          window.Analytics.track('dominant_colors_extraction_failed', {
            error: error.message,
            page: getCurrentPageNameForAnalytics()
          });
        }
      }
    });
  }
  
  // Clear image
  if (clearImageBtn) {
    clearImageBtn.addEventListener('click', () => {
      imageUpload.value = '';
      imageContainer.classList.add('hidden');
      imagePickerState.image = null;
      imagePickerState.canvas = null;
      imagePickerState.ctx = null;
      
      // Scroll back to top of color picker section
      const colorPickerSection = document.querySelector('.bg-white.dark\\:bg-gray-800.rounded-2xl');
      if (colorPickerSection) {
        colorPickerSection.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'start'
        });
      }
    });
  }
}

/**
 * Add to history for undo/redo
 */
function addToHistory() {
  const color = { ...appState.currentColor };
  const hex = window.ColorUtils ? window.ColorUtils.formatAsHex(color) : '';
  
  // Remove any future history if we're not at the end
  if (appState.historyIndex < appState.history.length - 1) {
    appState.history = appState.history.slice(0, appState.historyIndex + 1);
  }
  
  // Don't add if same as last color
  if (appState.history.length > 0) {
    const lastHex = window.ColorUtils ? window.ColorUtils.formatAsHex(appState.history[appState.history.length - 1]) : '';
    if (lastHex === hex) return;
  }
  
  appState.history.push(color);
  appState.historyIndex = appState.history.length - 1;
  
  // Limit history size
  if (appState.history.length > 50) {
    appState.history.shift();
    appState.historyIndex = appState.history.length - 1;
  }
}

/**
 * Undo color change
 */
function undoColor() {
  if (appState.historyIndex > 0) {
    appState.isNavigatingHistory = true;
    appState.historyIndex--;
    appState.currentColor = { ...appState.history[appState.historyIndex] };
    if (iroColorPicker && window.ColorUtils) {
      const hex = window.ColorUtils.formatAsHex(appState.currentColor);
      iroColorPicker.color.set({
        hex: hex,
        alpha: appState.currentColor.a / 255
      });
    }
    updateAllDisplays(true);
    appState.isNavigatingHistory = false;
  }
}

/**
 * Redo color change
 */
function redoColor() {
  if (appState.historyIndex < appState.history.length - 1) {
    appState.isNavigatingHistory = true;
    appState.historyIndex++;
    appState.currentColor = { ...appState.history[appState.historyIndex] };
    if (iroColorPicker && window.ColorUtils) {
      const hex = window.ColorUtils.formatAsHex(appState.currentColor);
      iroColorPicker.color.set({
        hex: hex,
        alpha: appState.currentColor.a / 255
      });
    }
    updateAllDisplays(true);
    appState.isNavigatingHistory = false;
  }
}

/**
 * Setup keyboard shortcuts
 */
function setupKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    // Ctrl/Cmd + Z for undo
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      undoColor();
      if (typeof window.Analytics !== 'undefined') {
        window.Analytics.track('keyboard_shortcut_undo', {
          page: getCurrentPageNameForAnalytics()
        });
      }
    }
    
    // Ctrl/Cmd + Shift + Z or Ctrl/Cmd + Y for redo
    if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
      e.preventDefault();
      redoColor();
      if (typeof window.Analytics !== 'undefined') {
        window.Analytics.track('keyboard_shortcut_redo', {
          page: getCurrentPageNameForAnalytics()
        });
      }
    }
    
    // Ctrl/Cmd + C to copy current color (when not in input)
    if ((e.ctrlKey || e.metaKey) && e.key === 'c' && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
      if (window.ColorUtils) {
        const hex = window.ColorUtils.formatAsHex(appState.currentColor);
        copyToClipboard(hex, 'Color copied!');
      }
    }
  });
}

/**
 * Export as Adobe Swatch (ASE) file
 */
function exportAsASE() {
  if (!window.ColorUtils) return;
  
  try {
    const rgb = appState.currentColor;
    const hex = window.ColorUtils.formatAsHex(rgb);
    
    // ASE file format (simplified - single color)
    const r = rgb.r / 255;
    const g = rgb.g / 255;
    const b = rgb.b / 255;
    
    // ASE file structure (binary)
    const name = 'Color';
    const nameBytes = new TextEncoder().encode(name);
    const nameLength = nameBytes.length;
    
    // Create binary data
    const buffer = new ArrayBuffer(4 + 4 + 2 + nameLength + 1 + 2 + 2 + 4 + 4 + 4);
    const view = new DataView(buffer);
    let offset = 0;
    
    // Block type (0x0001 = color entry)
    view.setUint16(offset, 0x0001, false);
    offset += 2;
    
    // Block length (will calculate)
    const blockLengthOffset = offset;
    offset += 2;
    
    // Color name length
    view.setUint16(offset, nameLength, false);
    offset += 2;
    
    // Color name
    for (let i = 0; i < nameLength; i++) {
      view.setUint16(offset, nameBytes[i], false);
      offset += 2;
    }
    
    // Color model (RGB = 'RGB ')
    view.setUint32(offset, 0x52474220, false); // 'RGB '
    offset += 4;
    
    // RGB values (float)
    view.setFloat32(offset, r, false);
    offset += 4;
    view.setFloat32(offset, g, false);
    offset += 4;
    view.setFloat32(offset, b, false);
    offset += 4;
    
    // Color type (0 = global)
    view.setUint16(offset, 0, false);
    offset += 2;
    
    // Calculate block length
    const blockLength = offset - blockLengthOffset - 2;
    view.setUint16(blockLengthOffset, blockLength, false);
    
    // Create file header
    const header = new ArrayBuffer(4 + 4);
    const headerView = new DataView(header);
    headerView.setUint32(0, 0x41534546, false); // 'ASEF'
    headerView.setUint32(4, 0x00010000, false); // Version 1.0
    headerView.setUint16(8, 1, false); // Number of blocks
    
    // Combine header and block
    const finalBuffer = new Uint8Array(header.byteLength + buffer.byteLength);
    finalBuffer.set(new Uint8Array(header), 0);
    finalBuffer.set(new Uint8Array(buffer), header.byteLength);
    
    // Download file
    const blob = new Blob([finalBuffer], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'color.ase';
    a.click();
    URL.revokeObjectURL(url);
    
    if (typeof window.Analytics !== 'undefined') {
      window.Analytics.track('export_ase', {
        page: getCurrentPageNameForAnalytics()
      });
    }
  } catch (error) {
    showToast('Failed to export ASE file');
    if (typeof window.Analytics !== 'undefined') {
      window.Analytics.track('export_ase_failed', {
        error: error.message,
        page: getCurrentPageNameForAnalytics()
      });
    }
  }
}

/**
 * Export as GIMP Palette (GPL) file
 */
function exportAsGPL() {
  if (!window.ColorUtils) return;
  
  try {
    const rgb = appState.currentColor;
    const gpl = `GIMP Palette
Name: Color Palette
Columns: 0
# Generated by Bharat Dev Tools Color Picker
${Math.round(rgb.r).toString().padStart(3)} ${Math.round(rgb.g).toString().padStart(3)} ${Math.round(rgb.b).toString().padStart(3)} Untitled`;
    
    const blob = new Blob([gpl], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'color.gpl';
    a.click();
    URL.revokeObjectURL(url);
    
    if (typeof window.Analytics !== 'undefined') {
      window.Analytics.track('export_gpl', {
        page: getCurrentPageNameForAnalytics()
      });
    }
  } catch (error) {
    showToast('Failed to export GPL file');
    if (typeof window.Analytics !== 'undefined') {
      window.Analytics.track('export_gpl_failed', {
        error: error.message,
        page: getCurrentPageNameForAnalytics()
      });
    }
  }
}

// HEX color validation regex (supports 3, 6, and 8 digit hex with alpha)
const HEX_COLOR_REGEX = /^#?([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/;

// Validate HEX color format
function isValidHexColor(hex) {
  if (!hex || typeof hex !== 'string') return false;
  // Remove # if present for validation
  const cleanHex = hex.startsWith('#') ? hex.substring(1) : hex;
  return HEX_COLOR_REGEX.test('#' + cleanHex);
}

// Event handlers
function setupEventHandlers() {
  // Hex input with edit mode
  const hexInput = document.getElementById('color-hex');
  const hexEditBtn = document.getElementById('hex-edit-btn');
  const hexDoneBtn = document.getElementById('hex-done-btn');
  const hexErrorMsg = document.getElementById('hex-error-msg');
  
  if (hexInput && hexEditBtn && hexDoneBtn) {
    // Enter edit mode
    hexEditBtn.addEventListener('click', () => {
      isHexEditMode = true;
      hexInput.removeAttribute('readonly');
      hexInput.focus();
      hexInput.select();
      hexEditBtn.classList.add('hidden');
      hexDoneBtn.classList.remove('hidden');
      hexErrorMsg.classList.add('hidden');
      
      if (typeof window.Analytics !== 'undefined') {
        window.Analytics.track('hex_edit_mode_entered', {
          page: getCurrentPageNameForAnalytics()
        });
      }
    });
    
    // Validate and apply color on Done
    hexDoneBtn.addEventListener('click', () => {
      const inputValue = hexInput.value.trim();
      
      if (!isValidHexColor(inputValue)) {
        hexErrorMsg.textContent = 'Invalid HEX color format. Use #RRGGBB, #RGB, or #RRGGBBAA (with alpha)';
        hexErrorMsg.classList.remove('hidden');
        hexInput.classList.add('border-red-500');
        
        if (typeof window.Analytics !== 'undefined') {
          window.Analytics.track('hex_validation_failed', {
            input: inputValue.substring(0, 20),
            page: getCurrentPageNameForAnalytics()
          });
        }
        return;
      }
      
      // Parse and apply color
      if (window.ColorUtils) {
        const color = window.ColorUtils.parseColor(inputValue);
        if (color) {
          // Ensure alpha is set (default to 255 if not provided)
          if (color.a === undefined || color.a === null) {
            color.a = 255;
          }
          appState.currentColor = color;
          
          // Immediately update color preview
          const preview = document.getElementById('color-preview');
          if (preview) {
            const r = Math.max(0, Math.min(255, color.r || 0));
            const g = Math.max(0, Math.min(255, color.g || 0));
            const b = Math.max(0, Math.min(255, color.b || 0));
            const alpha = Math.max(0, Math.min(1, color.a / 255));
            preview.style.backgroundColor = `rgba(${r}, ${g}, ${b}, ${alpha})`;
            preview.style.display = 'block';
            preview.style.opacity = '1';
            preview.style.visibility = 'visible';
          }
          
          // Update iro.js if initialized
          if (iroColorPicker) {
            const hex = window.ColorUtils.formatAsHex(color);
            iroColorPicker.color.set({
              hex: hex,
              alpha: color.a / 255
            });
          }
          updateAllDisplays();
          
          // Exit edit mode
          isHexEditMode = false;
          hexInput.setAttribute('readonly', 'readonly');
          hexEditBtn.classList.remove('hidden');
          hexDoneBtn.classList.add('hidden');
          hexErrorMsg.classList.add('hidden');
          hexInput.classList.remove('border-red-500');
          
          if (typeof window.Analytics !== 'undefined') {
            window.Analytics.track('hex_color_applied', {
              page: getCurrentPageNameForAnalytics()
            });
          }
        } else {
          hexErrorMsg.textContent = 'Invalid color value';
          hexErrorMsg.classList.remove('hidden');
          hexInput.classList.add('border-red-500');
        }
      }
    });
    
    // Real-time validation while typing in edit mode
    hexInput.addEventListener('input', (e) => {
      if (!isHexEditMode) return;
      
      const inputValue = e.target.value.trim();
      
      if (inputValue === '') {
        hexErrorMsg.classList.add('hidden');
        hexInput.classList.remove('border-red-500');
        hexDoneBtn.disabled = true;
        hexDoneBtn.classList.add('opacity-50', 'cursor-not-allowed');
        return;
      }
      
      if (isValidHexColor(inputValue)) {
        hexErrorMsg.classList.add('hidden');
        hexInput.classList.remove('border-red-500');
        hexDoneBtn.disabled = false;
        hexDoneBtn.classList.remove('opacity-50', 'cursor-not-allowed');
      } else {
        hexErrorMsg.textContent = 'Invalid HEX color format. Use #RRGGBB, #RGB, or #RRGGBBAA (with alpha)';
        hexErrorMsg.classList.remove('hidden');
        hexInput.classList.add('border-red-500');
        hexDoneBtn.disabled = true;
        hexDoneBtn.classList.add('opacity-50', 'cursor-not-allowed');
      }
    });
    
    // Handle Enter key in edit mode
    hexInput.addEventListener('keydown', (e) => {
      if (isHexEditMode && e.key === 'Enter') {
        e.preventDefault();
        hexDoneBtn.click();
      }
      // Escape to cancel edit mode
      if (isHexEditMode && e.key === 'Escape') {
        e.preventDefault();
        // Restore original value
        if (window.ColorUtils) {
          hexInput.value = window.ColorUtils.formatAsHex(appState.currentColor);
        }
        isHexEditMode = false;
        hexInput.setAttribute('readonly', 'readonly');
        hexEditBtn.classList.remove('hidden');
        hexDoneBtn.classList.add('hidden');
        hexErrorMsg.classList.add('hidden');
        hexInput.classList.remove('border-red-500');
        hexDoneBtn.disabled = false;
        hexDoneBtn.classList.remove('opacity-50', 'cursor-not-allowed');
      }
    });
    
    // Add copy button for hex input
    const hexCopyBtn = hexInput.closest('.flex').querySelector('.copy-btn');
    if (hexCopyBtn) {
      hexCopyBtn.addEventListener('click', () => {
        copyToClipboard(hexInput.value, 'HEX copied!');
        hexCopyBtn.classList.add('copied');
        setTimeout(() => hexCopyBtn.classList.remove('copied'), 2000);
      });
    }
  }
  
  // Transparency input (editable percentage)
  const transparencyInput = document.getElementById('transparency-value');
  if (transparencyInput && transparencyInput.tagName === 'INPUT') {
    transparencyInput.addEventListener('input', (e) => {
      const value = parseInt(e.target.value);
      if (!isNaN(value) && value >= 0 && value <= 100) {
        const alpha = Math.round((value / 100) * 255);
        appState.currentColor.a = alpha;
        // Update iro.js if initialized
        if (iroColorPicker) {
          appState.isUpdatingFromPicker = true;
          iroColorPicker.color.set({
            hex: window.ColorUtils ? window.ColorUtils.formatAsHex(appState.currentColor) : '#4A90E2',
            alpha: value / 100
          });
          setTimeout(() => {
            appState.isUpdatingFromPicker = false;
          }, 50);
        }
        updateAllDisplays();
      }
    });
    
    // Handle Enter key
    transparencyInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.target.blur();
      }
    });
  }
  
  // RGB inputs
  ['r', 'g', 'b', 'a'].forEach(channel => {
    const input = document.getElementById(`color-${channel}`);
    if (input) {
      input.addEventListener('input', (e) => {
        const value = channel === 'a' ? Math.round((parseInt(e.target.value) / 100) * 255) : parseInt(e.target.value);
        appState.currentColor[channel] = value;
        // Update iro.js if initialized
        if (iroColorPicker && window.ColorUtils) {
          const hex = window.ColorUtils.formatAsHex(appState.currentColor);
          iroColorPicker.color.set({
            hex: hex,
            alpha: appState.currentColor.a / 255
          });
        }
        updateAllDisplays();
      });
    }
  });
  
  // HSL inputs
  ['h', 's', 'l'].forEach(channel => {
    const input = document.getElementById(`color-${channel}`);
    if (input) {
      input.addEventListener('input', (e) => {
        const hsl = rgbToHsl(appState.currentColor.r, appState.currentColor.g, appState.currentColor.b);
        hsl[channel] = parseInt(e.target.value);
        const rgb = hslToRgb(hsl.h, hsl.s, hsl.l);
        appState.currentColor = { ...rgb, a: appState.currentColor.a };
        // Update iro.js if initialized
        if (iroColorPicker && window.ColorUtils) {
          const hex = window.ColorUtils.formatAsHex(appState.currentColor);
          iroColorPicker.color.set({
            hex: hex,
            alpha: appState.currentColor.a / 255
          });
        }
        updateAllDisplays();
      });
    }
  });
  
  // RGB copy button
  const rgbCopyBtn = document.getElementById('rgb-copy-btn');
  if (rgbCopyBtn && window.ColorUtils) {
    rgbCopyBtn.addEventListener('click', () => {
      const rgbValue = window.ColorUtils.formatAsRgb(appState.currentColor);
      copyToClipboard(rgbValue, 'RGB copied!');
      rgbCopyBtn.classList.add('copied');
      setTimeout(() => rgbCopyBtn.classList.remove('copied'), 2000);
    });
  }
  
  // HSL copy button
  const hslCopyBtn = document.getElementById('hsl-copy-btn');
  if (hslCopyBtn && window.ColorUtils) {
    hslCopyBtn.addEventListener('click', () => {
      const hslValue = window.ColorUtils.formatAsHsl(appState.currentColor);
      copyToClipboard(hslValue, 'HSL copied!');
      hslCopyBtn.classList.add('copied');
      setTimeout(() => hslCopyBtn.classList.remove('copied'), 2000);
    });
  }
  
  // Lightness is handled by iro.js value slider
  // No separate lightness slider needed
  
  // iro.js handles color wheel interactions automatically
  // No manual click handler needed
  
  // Copy buttons - set up after formats are updated (skip buttons with specific handlers)
  setTimeout(() => {
    document.querySelectorAll('.copy-btn').forEach(btn => {
      // Skip buttons that have specific handlers (rgb-copy-btn, hsl-copy-btn)
      if (btn.id === 'rgb-copy-btn' || btn.id === 'hsl-copy-btn') {
        return;
      }
      // Skip HEX copy button (it's already handled above)
      const hexEditBtn = btn.closest('.flex')?.querySelector('#hex-edit-btn');
      if (hexEditBtn) {
        return;
      }
      btn.addEventListener('click', (e) => {
        // Find the associated text element
        const container = btn.parentElement;
        if (container) {
          const textElement = container.querySelector('code, pre, input');
          if (textElement) {
            const text = textElement.textContent || textElement.value;
            if (text) {
              copyToClipboard(text.trim(), 'Copied!');
              btn.classList.add('copied');
              setTimeout(() => btn.classList.remove('copied'), 2000);
            }
          }
        }
      });
    });
  }, 100);
  
  // Preset colors
  document.querySelectorAll('.preset-color').forEach(preset => {
    preset.addEventListener('click', () => {
      if (!window.ColorUtils) return;
      const color = window.ColorUtils.parseColor(preset.dataset.color);
      if (color) {
        appState.currentColor = color;
        // Update iro.js if initialized
        if (iroColorPicker) {
          const hex = window.ColorUtils.formatAsHex(color);
          iroColorPicker.color.set({
            hex: hex,
            alpha: color.a / 255
          });
        }
        updateAllDisplays();
      }
    });
  });
  
  
  // Export buttons
  const aseBtn = document.getElementById('export-ase-btn');
  if (aseBtn) {
    aseBtn.addEventListener('click', exportAsASE);
  }
  
  const gplDownloadBtn = document.getElementById('export-gpl-download-btn');
  if (gplDownloadBtn) {
    gplDownloadBtn.addEventListener('click', exportAsGPL);
  }
  
  // Initialize image picker
  initializeImagePicker();
  
  // Setup keyboard shortcuts
  setupKeyboardShortcuts();
}

// Helper: HSL to RGB
function hslToRgb(h, s, l) {
  h /= 360;
  s /= 100;
  l /= 100;
  let r, g, b;
  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }
  return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
}

/**
 * Initialize app
 * Follows cursor rules: error handling, analytics, production-ready
 */
function initApp() {
  try {
    loadState();
    initFromUrl();
    setupEventHandlers();
    
    // Wait for dependencies to load (iro.js, ColorUtils, etc.)
    function waitForDependencies() {
      if (typeof iro !== 'undefined' && 
          typeof iro.ColorPicker !== 'undefined' && 
          window.ColorUtils) {
        // Initialize iro.js color picker
        initializeIroColorPicker();
        
        // Initialize history with current color
        addToHistory();
        
        // Delay updateAllDisplays to ensure iro.js is fully initialized
        setTimeout(() => {
          updateAllDisplays();
          updateRecentColors();
          // Mark initial load as complete after first update
          appState.isInitialLoad = false;
        }, 200); // Wait for initialization to complete
      } else {
        // Retry after 100ms (max 50 retries = 5 seconds)
        if (!waitForDependencies.retryCount) {
          waitForDependencies.retryCount = 0;
        }
        if (waitForDependencies.retryCount < 50) {
          waitForDependencies.retryCount++;
          setTimeout(waitForDependencies, 100);
        } else {
          // Show error message if dependencies don't load
          const container = document.getElementById('iro-color-picker');
          if (container) {
            container.innerHTML = '<div class="text-center p-4 text-red-600 dark:text-red-400">Failed to load color picker. Please refresh the page.</div>';
          }
        }
      }
    }
    
    // Start waiting for dependencies
    waitForDependencies();
  } catch (error) {
    if (typeof window.Analytics !== 'undefined') {
      window.Analytics.track('color_picker_init_failed', {
        error: error.message,
        page: getCurrentPageNameForAnalytics()
      });
    }
    
    // Log to Sentry if available
    if (typeof Sentry !== 'undefined') {
      Sentry.captureException(error, {
        tags: { component: 'color_picker', operation: 'init' },
        extra: { page: getCurrentPageNameForAnalytics() }
      });
    }
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

