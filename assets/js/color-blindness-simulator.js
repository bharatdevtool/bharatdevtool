// color-blindness-simulator.js - Color Blindness Simulation Utilities
// Bharat Dev Tools - Color Picker Tool

/**
 * Simulate color blindness (Protanopia - red-blind)
 * @param {{r: number, g: number, b: number}} rgb - RGB color
 * @returns {{r: number, g: number, b: number}} - Simulated RGB color
 */
function simulateProtanopia(rgb) {
  // Matrix for protanopia simulation
  const matrix = [
    [0.567, 0.433, 0.000],
    [0.558, 0.442, 0.000],
    [0.000, 0.242, 0.758]
  ];
  
  return applyColorMatrix(rgb, matrix);
}

/**
 * Simulate color blindness (Deuteranopia - green-blind)
 * @param {{r: number, g: number, b: number}} rgb - RGB color
 * @returns {{r: number, g: number, b: number}} - Simulated RGB color
 */
function simulateDeuteranopia(rgb) {
  // Matrix for deuteranopia simulation
  const matrix = [
    [0.625, 0.375, 0.000],
    [0.700, 0.300, 0.000],
    [0.000, 0.300, 0.700]
  ];
  
  return applyColorMatrix(rgb, matrix);
}

/**
 * Simulate color blindness (Tritanopia - blue-blind)
 * @param {{r: number, g: number, b: number}} rgb - RGB color
 * @returns {{r: number, g: number, b: number}} - Simulated RGB color
 */
function simulateTritanopia(rgb) {
  // Matrix for tritanopia simulation
  const matrix = [
    [0.950, 0.050, 0.000],
    [0.000, 0.433, 0.567],
    [0.000, 0.475, 0.525]
  ];
  
  return applyColorMatrix(rgb, matrix);
}

/**
 * Apply color transformation matrix
 * @param {{r: number, g: number, b: number}} rgb - RGB color
 * @param {Array<Array<number>>} matrix - 3x3 transformation matrix
 * @returns {{r: number, g: number, b: number}} - Transformed RGB color
 */
function applyColorMatrix(rgb, matrix) {
  const r = Math.round(
    matrix[0][0] * rgb.r + matrix[0][1] * rgb.g + matrix[0][2] * rgb.b
  );
  const g = Math.round(
    matrix[1][0] * rgb.r + matrix[1][1] * rgb.g + matrix[1][2] * rgb.b
  );
  const b = Math.round(
    matrix[2][0] * rgb.r + matrix[2][1] * rgb.g + matrix[2][2] * rgb.b
  );
  
  return {
    r: Math.max(0, Math.min(255, r)),
    g: Math.max(0, Math.min(255, g)),
    b: Math.max(0, Math.min(255, b))
  };
}

// Make functions available globally
window.ColorBlindnessSimulator = {
  simulateProtanopia,
  simulateDeuteranopia,
  simulateTritanopia
};


