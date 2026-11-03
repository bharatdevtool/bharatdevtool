// Common Theme Utility
// This file provides consistent theme management across all pages
// Default: Dark mode (not system-dependent)
// Storage: localStorage

(function() {
  'use strict';

  const THEME_KEY = 'theme';
  const DEFAULT_THEME = 'dark'; // Default to dark mode, not system preference

  /**
   * Initialize theme on page load
   * Loads from localStorage, defaults to dark mode if not set
   */
  function initTheme() {
    const saved = localStorage.getItem(THEME_KEY);
    const theme = saved || DEFAULT_THEME;
    applyTheme(theme);
  }

  /**
   * Apply theme to the document
   * @param {string} theme - 'dark' or 'light'
   */
  function applyTheme(theme) {
    const isDark = theme === 'dark';
    
    // Set data-theme attribute (for CSS variables)
    document.documentElement.setAttribute('data-theme', theme);
    
    // Toggle dark class (for Tailwind CSS)
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    
    // Save to localStorage
    localStorage.setItem(THEME_KEY, theme);
    
    // Update UI elements if they exist
    syncThemeToggleUI();
  }

  /**
   * Toggle between dark and light theme
   */
  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || DEFAULT_THEME;
    const next = current === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    
    // Dispatch custom event for pages that need to react to theme changes
    window.dispatchEvent(new CustomEvent('themechange', { detail: { theme: next } }));
  }

  /**
   * Get current theme
   * @returns {string} 'dark' or 'light'
   */
  function getCurrentTheme() {
    return document.documentElement.getAttribute('data-theme') || DEFAULT_THEME;
  }

  /**
   * Sync theme toggle UI elements
   */
  function syncThemeToggleUI() {
    const isDark = getCurrentTheme() === 'dark';
    
    // Update checkbox toggle if it exists
    const checkboxToggle = document.getElementById('theme-toggle');
    if (checkboxToggle && checkboxToggle.type === 'checkbox') {
      checkboxToggle.checked = isDark;
    }
    
    // Update theme label if it exists
    const themeLabel = document.getElementById('theme-label');
    if (themeLabel) {
      themeLabel.innerHTML = isDark
        ? '<span>Switch</span><span>Light mode</span>'
        : '<span>Switch</span><span>Dark mode</span>';
    }
  }

  /**
   * Initialize theme toggle button click handler
   */
  function initThemeToggleButton() {
    // Use setTimeout to ensure DOM is ready
    setTimeout(function() {
      const themeToggle = document.getElementById('theme-toggle');
      if (themeToggle) {
        // Remove any existing listeners to avoid duplicates
        const newToggle = themeToggle.cloneNode(true);
        themeToggle.parentNode.replaceChild(newToggle, themeToggle);
        
        // Add click handler
        newToggle.addEventListener('click', function(e) {
          // If it's a checkbox, let the default behavior happen first
          if (newToggle.type === 'checkbox') {
            // The checkbox will be updated by syncThemeToggleUI after toggle
          }
          toggleTheme();
        });
      } else {
        // Retry once if element not found (fallback)
        setTimeout(function() {
          const retryToggle = document.getElementById('theme-toggle');
          if (retryToggle) {
            retryToggle.addEventListener('click', function(e) {
              if (retryToggle.type === 'checkbox') {
                // Let checkbox update first
              }
              toggleTheme();
            });
          }
        }, 100);
      }
    }, 10);
  }

  // Initialize theme immediately (before DOMContentLoaded to prevent flash)
  // This should run as early as possible
  if (document.readyState === 'loading') {
    // Apply theme before page renders
    initTheme();
    document.addEventListener('DOMContentLoaded', function() {
      initThemeToggleButton();
      syncThemeToggleUI();
    });
  } else {
    // DOM already loaded
    initTheme();
    initThemeToggleButton();
    syncThemeToggleUI();
  }

  // Export functions to global scope for pages that need them
  window.ThemeManager = {
    init: initTheme,
    toggle: toggleTheme,
    apply: applyTheme,
    getCurrent: getCurrentTheme,
    syncUI: syncThemeToggleUI
  };

  // Also export as legacy function names for backward compatibility
  window.initTheme = initTheme;
  window.toggleTheme = toggleTheme;
})();
