// Track tool visit for returning user routing
(function () {
  try {
    var maxAge = 31536000; // 1 year
    document.cookie = 'bdt_visited=1;path=/;max-age=' + maxAge + ';SameSite=Lax';
    var p = window.location.pathname;
    // The homepage and info pages are not tools: don't let them overwrite the last tool used.
    var isHome = p === '/' || p === '/index.html';
    if (!isHome && p.indexOf('privacy.html') === -1 && p.indexOf('feedback.html') === -1 && p.indexOf('about.html') === -1) {
      document.cookie = 'bdt_last_tool=' + encodeURIComponent(p) + ';path=/;max-age=' + maxAge + ';SameSite=Lax';
    }
  } catch (e) {}
})();

// share.js lives next to the other shared scripts; resolve it relative to this file.
var BDT_SHARE_SRC = (function () {
  try {
    var src = document.currentScript && document.currentScript.src;
    return src ? src.replace(/components\/header\.js(\?.*)?$/, 'assets/js/share.js') : null;
  } catch (e) { return null; }
})();

function loadShareScript(onReady) {
  if (window.BDTShare) return onReady();
  if (!BDT_SHARE_SRC) return;
  var s = document.createElement('script');
  s.src = BDT_SHARE_SRC;
  s.defer = true;
  s.onload = onReady;
  document.head.appendChild(s);
}

// Shared header for static HTML pages (using Tailwind CSS). The JSON Formatter has its own.
function createSecondaryHeader() {
  // Remove any existing headers (hardcoded or previously created) to avoid duplicates
  const existingHeaders = document.querySelectorAll('header.bg-white, header.secondary-header');
  existingHeaders.forEach(header => {
    // Only remove if it's not the main index.html header (which has .brand class)
    if (!header.querySelector('.brand')) {
      header.remove();
    }
  });

  // The homepage is the tool directory, so the logo and "All tools" both go there.
  // Root-relative: every page is served from the site root (bharatdevtool.com/…).
  const rootPath = '/';
  const isHome = window.location.pathname === '/' || window.location.pathname === '/index.html';

  const headerHTML = `
    <header class="secondary-header${isHome ? ' is-home' : ''} bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="secondary-header-inner flex justify-between items-center h-16 w-full">
          <!-- Back button (mobile only; not on the homepage) -->
          ${isHome ? '' : `<button id="mobile-back-btn" class="mobile-back-button p-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors" onclick="window.history.back()" aria-label="Go back">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-gray-900 dark:text-white">
              <path d="m12 19-7-7 7-7"/>
              <path d="M19 12H5"/>
            </svg>
          </button>`}
          
          <!-- Logo -->
          <div class="secondary-header-logo flex items-center">
            <a href="${rootPath}" class="flex items-center space-x-3">
              <img src="" 
                   data-logo="true"
                   alt="Bharat Dev Tools Logo" 
                   class="logo">
              <span class="text-xl font-bold text-gray-900 dark:text-white">Bharat Dev Tools</span>
            </a>
          </div>
          
          <!-- Header actions -->
          <div class="secondary-header-actions flex items-center space-x-4">
            <!-- Theme toggle -->
            <button id="theme-toggle" class="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
              <span class="dark:hidden"><svg class="bdt-i" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="display:inline-block;vertical-align:-0.125em;flex-shrink:0"><path d="M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401"/></svg></span>
              <span class="hidden dark:inline"><svg class="bdt-i" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="display:inline-block;vertical-align:-0.125em;flex-shrink:0"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg></span>
            </button>
            
            <!-- All Tools link (hidden on the homepage, which is the tool list) -->
            ${isHome ? '' : `<a href="${rootPath}" class="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors whitespace-nowrap tools-link-btn">
              All tools
            </a>`}
          </div>
        </div>
      </div>
    </header>
  `;

  // Insert header at the beginning of body
  document.body.insertAdjacentHTML('afterbegin', headerHTML);

  // "Share this tool" button (WhatsApp, Telegram, X, LinkedIn, copy link)
  loadShareScript(function () {
    var actions = document.querySelector('.secondary-header-actions');
    if (actions && window.BDTShare) window.BDTShare.mountButton(actions, { before: actions.firstElementChild });
  });
  
  // Trigger logo loader for the newly inserted logo
  // Wait a bit to ensure logo-loader.js has loaded
  setTimeout(() => {
    if (typeof window.initLogo === 'function') {
      window.initLogo();
    } else {
      // Fallback: manually set logo if logo-loader hasn't loaded yet
      const logoImages = document.querySelectorAll('img[data-logo="true"]');
      logoImages.forEach(img => {
        if (!img.src || img.src === window.location.href || img.src === '') {
          const logoUrl = (window.APP_CONFIG && window.APP_CONFIG.LOGO_URL) || 'https://ik.imagekit.io/bdt/bdt_logo_v3_400.png';
          img.src = logoUrl;
        }
      });
    }
  }, 50);
  
  // Initialize theme toggle functionality
  initHeaderThemeToggle();
}

function initHeaderThemeToggle() {
  // Theme management is now handled by the common theme.js utility
  // This function just ensures the toggle button is connected if theme.js hasn't loaded yet
  // If theme.js is loaded, it will handle everything automatically
  
  // Wait a bit to see if theme.js has initialized
  setTimeout(function() {
    const themeToggle = document.getElementById("theme-toggle");
    if (themeToggle && !themeToggle.hasAttribute('data-theme-initialized')) {
      // If theme.js hasn't initialized this button yet, do it here as fallback
      if (typeof window.ThemeManager === 'undefined') {
        // Fallback: basic theme toggle if theme.js not loaded
        function initTheme() {
          const saved = localStorage.getItem('theme');
          const theme = saved || 'dark'; // Default to dark
          const isDark = theme === 'dark';
          
          if (isDark) {
            document.documentElement.classList.add('dark');
            document.documentElement.setAttribute('data-theme', 'dark');
          } else {
            document.documentElement.classList.remove('dark');
            document.documentElement.setAttribute('data-theme', 'light');
          }
        }

        function toggleTheme() {
          const current = document.documentElement.getAttribute('data-theme') || 'dark';
          const next = current === 'dark' ? 'light' : 'dark';
          const isDark = next === 'dark';
          
          if (isDark) {
            document.documentElement.classList.add('dark');
          } else {
            document.documentElement.classList.remove('dark');
          }
          document.documentElement.setAttribute('data-theme', next);
          localStorage.setItem('theme', next);
        }

        initTheme();
        
        const newToggle = themeToggle.cloneNode(true);
        themeToggle.parentNode.replaceChild(newToggle, themeToggle);
        newToggle.addEventListener("click", toggleTheme);
      }
    }
  }, 50);
}

// Initialize header when DOM is loaded and Tailwind is ready
function initHeader() {
  // Wait for Tailwind to be available
  if (typeof tailwind !== 'undefined') {
    createSecondaryHeader();
  } else {
    // If Tailwind isn't ready yet, wait a bit and try again
    setTimeout(() => {
      if (typeof tailwind !== 'undefined') {
        createSecondaryHeader();
      } else {
        // Fallback: create header anyway (Tailwind might be loaded via CDN)
        createSecondaryHeader();
      }
    }, 100);
  }
}

// Initialize header when DOM is loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initHeader);
} else {
  // DOM is already loaded
  initHeader();
}

