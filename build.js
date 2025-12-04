#!/usr/bin/env node

/**
 * Comprehensive Build Script for Bharat Dev Tools
 * 
 * This script handles all pre-release tasks:
 * 1. Version management (auto-update buildDate)
 * 2. HTML generation (jsonformatter/index.html)
 * 3. Sitemap generation (with lastmod dates)
 * 4. Test execution (optional, can skip with --skip-tests)
 * 5. File validation (check required files exist)
 * 6. Pre-release checks
 * 
 * Usage:
 *   node build.js              # Full build with tests
 *   node build.js --skip-tests # Build without running tests
 *   node build.js --release    # Build for release (runs all checks)
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const SOURCE_FILE = 'index.html';
const OUTPUT_FILE = 'jsonformatter/index.html';
const BASE_URL = 'https://bharatdevtool.com';
const VERSION_FILE = 'version.json';

// Parse command line arguments
const args = process.argv.slice(2);
const skipTests = args.includes('--skip-tests');
const isRelease = args.includes('--release');

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function error(message) {
  log(`❌ ${message}`, 'red');
}

function success(message) {
  log(`✅ ${message}`, 'green');
}

function info(message) {
  log(`ℹ️  ${message}`, 'cyan');
}

function warning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

// ============================================================================
// 1. VERSION MANAGEMENT
// ============================================================================

function updateVersion() {
  log('\n📦 Updating version.json...', 'blue');
  
  if (!fs.existsSync(VERSION_FILE)) {
    error(`${VERSION_FILE} not found!`);
    process.exit(1);
  }
  
  const versionData = JSON.parse(fs.readFileSync(VERSION_FILE, 'utf8'));
  const today = new Date().toISOString().split('T')[0];
  
  // Update buildDate to today
  versionData.buildDate = today;
  
  fs.writeFileSync(VERSION_FILE, JSON.stringify(versionData, null, 2) + '\n', 'utf8');
  success(`Updated buildDate to ${today}`);
  info(`Version: ${versionData.version} | Release: ${versionData.releaseName}`);
  
  return versionData;
}

// ============================================================================
// 2. HTML GENERATION
// ============================================================================

function transformHTML(content, isSubdirectory) {
  if (!isSubdirectory) {
    return content; // Root file stays as-is
  }

  let transformed = content;

  // Transform asset paths: add ../ prefix
  transformed = transformed.replace(/href="(assets\/)/g, 'href="../$1');
  transformed = transformed.replace(/href="(components\/)/g, 'href="../$1');
  transformed = transformed.replace(/href="(favicon)/g, 'href="../$1');
  transformed = transformed.replace(/src="(assets\/)/g, 'src="../$1');
  transformed = transformed.replace(/src="(components\/)/g, 'src="../$1');
  
  // Transform import paths
  transformed = transformed.replace(/from '\.\/assets\//g, "from '../assets/");
  transformed = transformed.replace(/from "\.\/assets\//g, 'from "../assets/');
  
  // Transform navigation links
  transformed = transformed.replace(/href="(deeplink\.html)/g, 'href="../$1');
  transformed = transformed.replace(/href="(url-encoder\.html)/g, 'href="../$1');
  transformed = transformed.replace(/href="(simple-qr\.html)/g, 'href="../$1');
  
  // Transform canonical URLs
  transformed = transformed.replace(
    /href="https:\/\/bharatdevtool\.com\/"/g,
    'href="https://bharatdevtool.com/jsonformatter/"'
  );
  
  // Transform Open Graph URLs
  transformed = transformed.replace(
    /content="https:\/\/bharatdevtool\.com\/"/g,
    'content="https://bharatdevtool.com/jsonformatter/"'
  );
  
  // Transform structured data URLs
  transformed = transformed.replace(
    /"url": "https:\/\/bharatdevtool\.com\/"/g,
    '"url": "https://bharatdevtool.com/jsonformatter/"'
  );

  return transformed;
}

function generateHTML() {
  log('\n🔨 Generating HTML files...', 'blue');
  
  if (!fs.existsSync(SOURCE_FILE)) {
    error(`${SOURCE_FILE} not found!`);
    process.exit(1);
  }

  const sourceContent = fs.readFileSync(SOURCE_FILE, 'utf8');
  
  const outputDir = path.dirname(OUTPUT_FILE);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const transformedContent = transformHTML(sourceContent, true);
  fs.writeFileSync(OUTPUT_FILE, transformedContent, 'utf8');

  success(`Generated ${OUTPUT_FILE}`);
}

// ============================================================================
// 3. SITEMAP GENERATION
// ============================================================================

function generateSitemap() {
  log('\n🗺️  Generating sitemap.xml...', 'blue');
  
  const sitemapEntries = [
    { loc: '/', file: 'index.html', changefreq: 'weekly', priority: '1.0' },
    { loc: '/jsonformatter/', file: 'jsonformatter/index.html', changefreq: 'weekly', priority: '1.0' },
    { loc: '/jsondiff/', file: 'jsondiff/index.html', changefreq: 'weekly', priority: '0.8' },
    { loc: '/about.html', file: 'about.html', changefreq: 'yearly', priority: '0.6' },
    { loc: '/privacy.html', file: 'privacy.html', changefreq: 'yearly', priority: '0.5' },
    { loc: '/feedback.html', file: 'feedback.html', changefreq: 'monthly', priority: '0.6' },
    { loc: '/simple-qr.html', file: 'simple-qr.html', changefreq: 'weekly', priority: '0.8' },
    { loc: '/qr-decoder.html', file: 'qr-decoder.html', changefreq: 'weekly', priority: '0.8' },
    { loc: '/deeplink.html', file: 'deeplink.html', changefreq: 'weekly', priority: '0.8' },
    { loc: '/url-encoder.html', file: 'url-encoder.html', changefreq: 'weekly', priority: '0.8' },
    { loc: '/tools.html', file: 'tools.html', changefreq: 'monthly', priority: '0.7' },
  ];

  let sitemapXml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  sitemapXml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

  sitemapEntries.forEach(entry => {
    const filePath = entry.file;
    let lastmod = new Date().toISOString().split('T')[0];
    
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      lastmod = stats.mtime.toISOString().split('T')[0];
    }
    
    sitemapXml += '  <url>\n';
    sitemapXml += `    <loc>${BASE_URL}${entry.loc}</loc>\n`;
    sitemapXml += `    <lastmod>${lastmod}</lastmod>\n`;
    sitemapXml += `    <changefreq>${entry.changefreq}</changefreq>\n`;
    sitemapXml += `    <priority>${entry.priority}</priority>\n`;
    sitemapXml += '  </url>\n';
  });

  sitemapXml += '</urlset>\n';

  fs.writeFileSync('sitemap.xml', sitemapXml, 'utf8');
  success('Generated sitemap.xml');
}

// ============================================================================
// 4. FILE VALIDATION
// ============================================================================

function validateFiles() {
  log('\n🔍 Validating required files...', 'blue');
  
  const requiredFiles = [
    'index.html',
    'version.json',
    'sitemap.xml',
    'robots.txt',
    'favicon.ico',
    'favicon.svg',
    'assets/js/version.js',
    'assets/js/analytics.js',
    'assets/js/config.js',
    'components/header.js',
    'components/footer.js',
  ];
  
  const requiredDirs = [
    'assets/css',
    'assets/js',
    'assets/img/og',
  ];
  
  let allValid = true;
  
  // Check files
  requiredFiles.forEach(file => {
    if (!fs.existsSync(file)) {
      error(`Missing required file: ${file}`);
      allValid = false;
    } else {
      success(`Found: ${file}`);
    }
  });
  
  // Check directories
  requiredDirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      error(`Missing required directory: ${dir}`);
      allValid = false;
    } else {
      success(`Found: ${dir}/`);
    }
  });
  
  // Check OG image
  const ogImage = 'assets/img/og/og-image.jpg';
  if (!fs.existsSync(ogImage)) {
    warning(`OG image not found: ${ogImage} (recommended for social sharing)`);
  } else {
    success(`Found OG image: ${ogImage}`);
  }
  
  return allValid;
}

// ============================================================================
// 5. TEST EXECUTION
// ============================================================================

function runTests() {
  log('\n🧪 Running test suite...', 'blue');
  
  const testDir = 'test';
  if (!fs.existsSync(testDir)) {
    warning('Test directory not found, skipping tests');
    return true;
  }
  
  const testScriptPath = path.join(testDir, 'run-all-tests.js');
  if (!fs.existsSync(testScriptPath)) {
    error(`Test script not found: ${testScriptPath}`);
    return false;
  }
  
  try {
    // Run tests from root directory, test script will handle its own imports
    info('Running: node test/run-all-tests.js');
    execSync(`node "${testScriptPath}"`, { 
      stdio: 'inherit',
      cwd: process.cwd() // Stay in root directory
    });
    
    success('All tests passed!');
    return true;
  } catch (testError) {
    error('Tests failed! Please fix errors before release.');
    if (isRelease) {
      process.exit(1);
    }
    return false;
  }
}

// ============================================================================
// 6. PRE-RELEASE CHECKS
// ============================================================================

function preReleaseChecks() {
  log('\n🔎 Running pre-release checks...', 'blue');
  
  let allChecksPassed = true;
  
  // Check version.json format
  try {
    const versionData = JSON.parse(fs.readFileSync(VERSION_FILE, 'utf8'));
    if (!versionData.version || !versionData.buildDate || !versionData.releaseName) {
      error('version.json missing required fields (version, buildDate, releaseName)');
      allChecksPassed = false;
    } else {
      success('version.json format valid');
    }
  } catch (e) {
    error(`Invalid JSON in ${VERSION_FILE}: ${e.message}`);
    allChecksPassed = false;
  }
  
  // Check sitemap.xml format
  try {
    const sitemapContent = fs.readFileSync('sitemap.xml', 'utf8');
    if (!sitemapContent.includes('<urlset')) {
      error('sitemap.xml appears to be invalid');
      allChecksPassed = false;
    } else {
      success('sitemap.xml format valid');
    }
  } catch (e) {
    error(`Error reading sitemap.xml: ${e.message}`);
    allChecksPassed = false;
  }
  
  // Check for common issues in HTML
  const htmlFiles = ['index.html', 'deeplink.html', 'url-encoder.html', 'simple-qr.html', 'qr-decoder.html', 'tools.html'];
  htmlFiles.forEach(file => {
    if (fs.existsSync(file)) {
      const content = fs.readFileSync(file, 'utf8');
      
      // Check for og:image
      if (!content.includes('og:image')) {
        warning(`${file} missing og:image meta tag`);
      }
      
      // Check for canonical URL
      if (!content.includes('canonical')) {
        warning(`${file} missing canonical URL`);
      }
      
      // Check for meta description
      if (!content.includes('meta name="description"')) {
        warning(`${file} missing meta description`);
      }
    }
  });
  
  return allChecksPassed;
}

// ============================================================================
// MAIN BUILD FUNCTION
// ============================================================================

function build() {
  log('🚀 Starting build process...', 'blue');
  log(`Mode: ${isRelease ? 'RELEASE' : 'DEVELOPMENT'}`, 'cyan');
  if (skipTests) {
    log('Tests: SKIPPED', 'yellow');
  }
  
  const startTime = Date.now();
  
  try {
    // 1. Update version
    const versionData = updateVersion();
    
    // 2. Generate HTML
    generateHTML();
    
    // 3. Generate sitemap
    generateSitemap();
    
    // 4. Validate files
    if (!validateFiles()) {
      error('File validation failed!');
      if (isRelease) {
        process.exit(1);
      }
    }
    
    // 5. Run tests (unless skipped)
    if (!skipTests) {
      if (!runTests()) {
        if (isRelease) {
          error('Cannot proceed with release - tests failed!');
          process.exit(1);
        }
      }
    }
    
    // 6. Pre-release checks (if release mode)
    if (isRelease) {
      if (!preReleaseChecks()) {
        error('Pre-release checks failed!');
        process.exit(1);
      }
    }
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    log('\n' + '='.repeat(50), 'green');
    success(`Build completed successfully in ${duration}s`);
    log('='.repeat(50), 'green');
    
    if (isRelease) {
      log('\n📦 Ready for release!', 'green');
      info(`Version: ${versionData.version}`);
      info(`Release: ${versionData.releaseName}`);
      info(`Build Date: ${versionData.buildDate}`);
      log('\nNext steps:', 'cyan');
      log('  1. Review changes: git status');
      log('  2. Commit: git add . && git commit -m "Release v' + versionData.version + '"');
      log('  3. Tag: git tag v' + versionData.version);
      log('  4. Push: git push && git push --tags');
    }
    
  } catch (err) {
    error(`Build failed: ${err.message}`);
    console.error(err);
    process.exit(1);
  }
}

// Run the build
build();
