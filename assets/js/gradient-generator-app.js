// gradient-generator-app.js - Gradient Generator Application Logic
// Bharat Dev Tools - Gradient Generator Tool

// Application state
let gradientState = {
  type: 'linear',
  angle: 45,
  colorStops: [
    { color: '#FF5733', position: 0 },
    { color: '#4A00E0', position: 100 }
  ],
  history: [],
  favorites: []
};

// Preset gradients
const PRESET_GRADIENTS = [
  {
    name: 'Instagram',
    type: 'linear',
    angle: 45,
    colorStops: [
      { color: '#ff9a9e', position: 0 },
      { color: '#fad0c4', position: 100 }
    ]
  },
  {
    name: 'Sunset',
    type: 'linear',
    angle: 90,
    colorStops: [
      { color: '#4facfe', position: 0 },
      { color: '#00f2fe', position: 100 }
    ]
  },
  {
    name: 'Ocean',
    type: 'linear',
    angle: 120,
    colorStops: [
      { color: '#a1c4fd', position: 0 },
      { color: '#c2e9fb', position: 100 }
    ]
  },
  {
    name: 'Neon',
    type: 'linear',
    angle: 60,
    colorStops: [
      { color: '#f093fb', position: 0 },
      { color: '#f5576c', position: 100 }
    ]
  },
  {
    name: 'Minimal Pastel',
    type: 'linear',
    angle: 135,
    colorStops: [
      { color: '#667eea', position: 0 },
      { color: '#764ba2', position: 100 }
    ]
  }
];

// Get current page name for analytics
function getCurrentPageNameForAnalytics() {
  return 'gradient_generator';
}

// Load state from localStorage
function loadState() {
  try {
    const saved = localStorage.getItem('gradientGeneratorState');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.favorites) gradientState.favorites = parsed.favorites;
      if (parsed.history) gradientState.history = parsed.history.slice(0, 20);
    }
  } catch (error) {
    if (typeof window.Analytics !== 'undefined') {
      window.Analytics.track('gradient_generator_load_state_failed', {
        error: error.message,
        page: getCurrentPageNameForAnalytics()
      });
    }
  }
}

// Save state to localStorage
function saveState() {
  try {
    localStorage.setItem('gradientGeneratorState', JSON.stringify({
      favorites: gradientState.favorites,
      history: gradientState.history.slice(0, 20)
    }));
  } catch (error) {
    if (typeof window.Analytics !== 'undefined') {
      window.Analytics.track('gradient_generator_save_state_failed', {
        error: error.message,
        page: getCurrentPageNameForAnalytics()
      });
    }
  }
}

// Generate CSS gradient string
function generateGradientCSS() {
  const stops = gradientState.colorStops.map(stop => 
    `${stop.color} ${stop.position}%`
  ).join(', ');
  
  if (gradientState.type === 'linear') {
    return `linear-gradient(${gradientState.angle}deg, ${stops})`;
  } else if (gradientState.type === 'radial') {
    return `radial-gradient(circle, ${stops})`;
  } else if (gradientState.type === 'conic') {
    return `conic-gradient(from ${gradientState.angle}deg, ${stops})`;
  }
  return '';
}

// Generate Tailwind gradient
function generateTailwindGradient() {
  const stops = gradientState.colorStops.map(stop => 
    `${stop.color} ${stop.position}%`
  ).join(',');
  
  if (gradientState.type === 'linear') {
    return `bg-[linear-gradient(${gradientState.angle}deg,${stops})]`;
  } else if (gradientState.type === 'radial') {
    return `bg-[radial-gradient(circle,${stops})]`;
  } else if (gradientState.type === 'conic') {
    return `bg-[conic-gradient(from ${gradientState.angle}deg,${stops})]`;
  }
  return '';
}

// Update preview
function updatePreview() {
  const preview = document.getElementById('gradient-preview');
  if (preview) {
    preview.style.background = generateGradientCSS();
  }
}

// Update CSS output
function updateCSSOutput() {
  const cssOutput = document.getElementById('css-output');
  if (cssOutput) {
    cssOutput.textContent = `background: ${generateGradientCSS()};`;
  }
}

// Update Tailwind output
function updateTailwindOutput() {
  const tailwindOutput = document.getElementById('tailwind-output');
  if (tailwindOutput) {
    tailwindOutput.textContent = generateTailwindGradient();
  }
}

// Update all displays
function updateAllDisplays() {
  updatePreview();
  updateCSSOutput();
  updateTailwindOutput();
  updateColorStopsUI();
  updateUrl();
  
  // Add to history
  addToHistory();
}

// Update color stops UI
function updateColorStopsUI() {
  const container = document.getElementById('color-stops-container');
  if (!container) return;
  
  container.innerHTML = '';
  gradientState.colorStops.forEach((stop, index) => {
    const stopDiv = document.createElement('div');
    stopDiv.className = 'color-stop-item flex items-center gap-4 mb-4';
    stopDiv.innerHTML = `
      <input type="color" value="${stop.color}" class="color-input w-16 h-16 rounded border-2 border-gray-300 dark:border-gray-600 cursor-pointer" data-index="${index}">
      <input type="text" value="${stop.color}" class="color-hex-input px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono text-sm" data-index="${index}">
      <input type="range" min="0" max="100" value="${stop.position}" class="position-slider flex-1" data-index="${index}">
      <span class="position-value w-16 text-center font-mono text-sm text-gray-700 dark:text-gray-300">${stop.position}%</span>
      <button class="remove-stop-btn px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors" data-index="${index}" ${gradientState.colorStops.length <= 2 ? 'disabled' : ''}>Remove</button>
    `;
    container.appendChild(stopDiv);
  });
  
  // Attach event handlers
  attachColorStopHandlers();
}

// Attach color stop handlers
function attachColorStopHandlers() {
  // Color inputs
  document.querySelectorAll('.color-input').forEach(input => {
    input.addEventListener('input', (e) => {
      const index = parseInt(e.target.dataset.index);
      gradientState.colorStops[index].color = e.target.value;
      updateAllDisplays();
    });
  });
  
  // Hex inputs
  document.querySelectorAll('.color-hex-input').forEach(input => {
    input.addEventListener('input', (e) => {
      const index = parseInt(e.target.dataset.index);
      const color = e.target.value;
      if (/^#?[0-9a-fA-F]{6}$/.test(color) || /^#?[0-9a-fA-F]{3}$/.test(color)) {
        gradientState.colorStops[index].color = color.startsWith('#') ? color : '#' + color;
        updateAllDisplays();
      }
    });
  });
  
  // Position sliders
  document.querySelectorAll('.position-slider').forEach(slider => {
    slider.addEventListener('input', (e) => {
      const index = parseInt(e.target.dataset.index);
      const position = parseInt(e.target.value);
      gradientState.colorStops[index].position = position;
      updateAllDisplays();
    });
  });
  
  // Remove buttons
  document.querySelectorAll('.remove-stop-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const index = parseInt(e.target.dataset.index);
      if (gradientState.colorStops.length > 2) {
        gradientState.colorStops.splice(index, 1);
        updateAllDisplays();
      }
    });
  });
}

// Add color stop
function addColorStop() {
  const newColor = '#000000';
  const newPosition = gradientState.colorStops.length > 0 
    ? Math.min(100, gradientState.colorStops[gradientState.colorStops.length - 1].position + 10)
    : 50;
  gradientState.colorStops.push({ color: newColor, position: newPosition });
  updateAllDisplays();
}

// Update URL
function updateUrl() {
  const params = new URLSearchParams();
  params.set('type', gradientState.type);
  params.set('angle', gradientState.angle);
  params.set('stops', JSON.stringify(gradientState.colorStops));
  window.history.replaceState(null, '', `?${params.toString()}`);
}

// Initialize from URL
function initFromUrl() {
  const params = new URLSearchParams(window.location.search);
  if (params.has('type')) {
    gradientState.type = params.get('type');
  }
  if (params.has('angle')) {
    gradientState.angle = parseInt(params.get('angle'));
  }
  if (params.has('stops')) {
    try {
      gradientState.colorStops = JSON.parse(params.get('stops'));
    } catch (e) {
      // Keep default
    }
  }
}

// Add to history
function addToHistory() {
  const gradient = {
    type: gradientState.type,
    angle: gradientState.angle,
    colorStops: [...gradientState.colorStops],
    css: generateGradientCSS()
  };
  
  // Remove duplicates
  gradientState.history = gradientState.history.filter(g => g.css !== gradient.css);
  gradientState.history.unshift(gradient);
  gradientState.history = gradientState.history.slice(0, 20);
  saveState();
}

// Copy to clipboard
function copyToClipboard(text, message = 'Copied!') {
  navigator.clipboard.writeText(text).then(() => {
    showToast(message);
    if (typeof window.Analytics !== 'undefined') {
      window.Analytics.track('gradient_generator_copy', {
        page: getCurrentPageNameForAnalytics()
      });
    }
  }).catch(error => {
    if (typeof window.Analytics !== 'undefined') {
      window.Analytics.track('gradient_generator_copy_failed', {
        error: error.message,
        page: getCurrentPageNameForAnalytics()
      });
    }
  });
}

// Show toast
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

// Load preset
function loadPreset(preset) {
  gradientState.type = preset.type;
  gradientState.angle = preset.angle;
  gradientState.colorStops = preset.colorStops.map(s => ({ ...s }));
  updateAllDisplays();
}

// Generate random gradient
function generateRandomGradient() {
  const types = ['linear', 'radial', 'conic'];
  gradientState.type = types[Math.floor(Math.random() * types.length)];
  gradientState.angle = Math.floor(Math.random() * 360);
  
  const numStops = 2 + Math.floor(Math.random() * 3);
  gradientState.colorStops = [];
  for (let i = 0; i < numStops; i++) {
    const color = '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
    const position = Math.floor((i / (numStops - 1)) * 100);
    gradientState.colorStops.push({ color, position });
  }
  
  updateAllDisplays();
}

// Setup event handlers
function setupEventHandlers() {
  // Gradient type
  document.querySelectorAll('input[name="gradient-type"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      gradientState.type = e.target.value;
      updateAllDisplays();
    });
  });
  
  // Angle slider
  const angleSlider = document.getElementById('angle-slider');
  if (angleSlider) {
    angleSlider.addEventListener('input', (e) => {
      gradientState.angle = parseInt(e.target.value);
      document.getElementById('angle-value').textContent = `${gradientState.angle}°`;
      updateAllDisplays();
    });
  }
  
  // Add color stop button
  const addStopBtn = document.getElementById('add-color-stop');
  if (addStopBtn) {
    addStopBtn.addEventListener('click', addColorStop);
  }
  
  // Copy buttons
  document.querySelectorAll('.copy-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const container = btn.parentElement;
      if (container) {
        const textElement = container.querySelector('code, pre');
        if (textElement) {
          const text = textElement.textContent.trim();
          if (text) {
            copyToClipboard(text, 'Copied!');
            btn.classList.add('copied');
            setTimeout(() => btn.classList.remove('copied'), 2000);
          }
        }
      }
    });
  });
  
  // Preset buttons
  document.querySelectorAll('.preset-gradient').forEach(preset => {
    preset.addEventListener('click', () => {
      const presetName = preset.dataset.preset;
      const presetData = PRESET_GRADIENTS.find(p => p.name === presetName);
      if (presetData) {
        loadPreset(presetData);
      }
    });
  });
  
  // Random gradient button
  const randomBtn = document.getElementById('random-gradient');
  if (randomBtn) {
    randomBtn.addEventListener('click', generateRandomGradient);
  }
  
  // Reset button
  const resetBtn = document.getElementById('reset-gradient');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      gradientState.type = 'linear';
      gradientState.angle = 45;
      gradientState.colorStops = [
        { color: '#FF5733', position: 0 },
        { color: '#4A00E0', position: 100 }
      ];
      updateAllDisplays();
    });
  }
}

// Initialize app
function initApp() {
  loadState();
  initFromUrl();
  setupEventHandlers();
  // Ensure DOM is ready before updating
  setTimeout(() => {
    updateAllDisplays();
  }, 100);
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

