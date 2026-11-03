// image-color-extractor.js - Image Color Extraction Utilities
// Bharat Dev Tools - Color Picker Tool

/**
 * Extract color from image at specific coordinates
 * @param {HTMLImageElement|HTMLCanvasElement} image - Image element or canvas
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @returns {{r: number, g: number, b: number, a: number}|null} - RGB color object
 */
function extractColorFromImage(image, x, y) {
  if (!window.ColorUtils) return null;
  
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    canvas.width = image.width || image.naturalWidth;
    canvas.height = image.height || image.naturalHeight;
    
    ctx.drawImage(image, 0, 0);
    
    const imageData = ctx.getImageData(x, y, 1, 1);
    const data = imageData.data;
    
    return {
      r: data[0],
      g: data[1],
      b: data[2],
      a: data[3]
    };
  } catch (error) {
    if (typeof window.Analytics !== 'undefined') {
      window.Analytics.track('image_color_extraction_failed', {
        error: error.message,
        page: 'color_picker'
      });
    }
    return null;
  }
}

/**
 * Extract dominant colors from image using simple frequency analysis
 * @param {HTMLImageElement|HTMLCanvasElement} image - Image element
 * @param {number} count - Number of colors to extract
 * @returns {Array<{r: number, g: number, b: number, a: number}>} - Array of RGB colors
 */
function extractDominantColors(image, count = 5) {
  if (!window.ColorUtils) return [];
  
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    // Limit canvas size for performance
    const maxSize = 200;
    const scale = Math.min(maxSize / image.width, maxSize / image.height, 1);
    
    canvas.width = Math.floor(image.width * scale);
    canvas.height = Math.floor(image.height * scale);
    
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    const colorMap = new Map();
    
    // Sample pixels (every 10th pixel for performance)
    for (let i = 0; i < data.length; i += 40) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      
      // Quantize colors to reduce noise
      const quantizedR = Math.floor(r / 10) * 10;
      const quantizedG = Math.floor(g / 10) * 10;
      const quantizedB = Math.floor(b / 10) * 10;
      const key = `${quantizedR},${quantizedG},${quantizedB}`;
      
      if (colorMap.has(key)) {
        colorMap.set(key, colorMap.get(key) + 1);
      } else {
        colorMap.set(key, 1);
      }
    }
    
    // Sort by frequency and get top colors
    const sortedColors = Array.from(colorMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, count)
      .map(entry => {
        const [r, g, b] = entry[0].split(',').map(Number);
        return { r, g, b, a: 255 };
      });
    
    return sortedColors;
  } catch (error) {
    if (typeof window.Analytics !== 'undefined') {
      window.Analytics.track('dominant_color_extraction_failed', {
        error: error.message,
        page: 'color_picker'
      });
    }
    return [];
  }
}

/**
 * Create image element from file
 * @param {File} file - Image file
 * @returns {Promise<HTMLImageElement>} - Promise resolving to image element
 */
function createImageFromFile(file) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('File is not an image'));
      return;
    }
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

// Make functions available globally
window.ImageColorExtractor = {
  extractColorFromImage,
  extractDominantColors,
  createImageFromFile
};


