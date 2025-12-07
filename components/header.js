// Header Component JavaScript for Secondary Pages (using Tailwind CSS)
function createSecondaryHeader() {
  // Remove any existing headers (hardcoded or previously created) to avoid duplicates
  const existingHeaders = document.querySelectorAll('header.bg-white, header.secondary-header');
  existingHeaders.forEach(header => {
    // Only remove if it's not the main index.html header (which has .brand class)
    if (!header.querySelector('.brand')) {
      header.remove();
    }
  });

  // Determine the correct path to root index.html based on current location
  function getRootPath() {
    const pathname = window.location.pathname;
    // Count how many directory levels deep we are
    const pathParts = pathname.split('/').filter(part => part && part !== 'index.html');
    // If we're in a subdirectory (like jsondiff/), go up one level
    if (pathParts.length > 0) {
      return '../index.html';
    }
    // If we're at root, use index.html
    return 'index.html';
  }

  // Determine the correct path to tools.html based on current location
  function getToolsPath() {
    const pathname = window.location.pathname;
    // Count how many directory levels deep we are
    const pathParts = pathname.split('/').filter(part => part && part !== 'index.html');
    // If we're in a subdirectory (like jsondiff/), go up one level
    if (pathParts.length > 0) {
      return '../tools.html';
    }
    // If we're at root, use tools.html
    return 'tools.html';
  }

  const rootPath = getRootPath();
  const toolsPath = getToolsPath();

  const headerHTML = `
    <header class="secondary-header bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="secondary-header-inner flex justify-between items-center h-16 w-full">
          <!-- Back button (mobile only) -->
          <button id="mobile-back-btn" class="mobile-back-button p-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors" onclick="window.history.back()" aria-label="Go back">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-gray-900 dark:text-white">
              <path d="m12 19-7-7 7-7"/>
              <path d="M19 12H5"/>
            </svg>
          </button>
          
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
              <span class="dark:hidden">🌙</span>
              <span class="hidden dark:inline">☀️</span>
            </button>
            
            <!-- Other Tools link -->
            <a href="${toolsPath}" class="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors whitespace-nowrap tools-link-btn">
              Other tools
            </a>
          </div>
        </div>
      </div>
    </header>
  `;

  // Insert header at the beginning of body
  document.body.insertAdjacentHTML('afterbegin', headerHTML);
  
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
          const logoUrl = (window.APP_CONFIG && window.APP_CONFIG.LOGO_URL) || 'https://ik.imagekit.io/bdt/bdt_logo.png';
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
  // Skip header creation only on root index.html (main JSON formatter page)
  const fullPath = window.location.pathname;
  const pathParts = fullPath.split('/').filter(part => part);
  
  // Check if we're on root index.html - skip header creation (it has its own header)
  // Only skip if path is exactly "/" or "/index.html" (root level)
  if (fullPath === '/' || 
      fullPath === '/index.html' ||
      (pathParts.length === 0) ||
      (pathParts.length === 1 && pathParts[0] === 'index.html')) {
    return;
  }
  
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

