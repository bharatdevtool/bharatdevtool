#!/usr/bin/env node

/**
 * Individual Test Runner for Bharat Dev Tools
 * 
 * This script allows running individual test suites:
 * - JSON Formatter tests
 * - DeepLink Launcher tests
 * - URL Encoder/Decoder tests
 * - QR Code Generator tests
 * 
 * Usage:
 * node run-individual-tests.js json     # Run only JSON formatter tests
 * node run-individual-tests.js deeplink # Run only deeplink launcher tests
 * node run-individual-tests.js url      # Run only URL encoder/decoder tests
 * node run-individual-tests.js qr       # Run only QR code generator tests
 * node run-individual-tests.js all      # Run all test suites
 */

import { DeepLinkTester } from './deeplink-tests.js';
import { URLEncoderTester } from './url-encoder-tests.js';
import { QRTester } from './qr-tests.js';

// Get command line arguments
const args = process.argv.slice(2);
const testSuite = args[0] || 'all';

console.log('🧪 Bharat Dev Tools - Individual Test Runner');
console.log('===========================================\n');

if (testSuite === 'json' || testSuite === 'all') {
  console.log('Running JSON Formatter tests...');
  console.log('Note: JSON formatter tests require the original run-tests.js script');
  console.log('Please run: node run-tests.js\n');
}

if (testSuite === 'deeplink' || testSuite === 'all') {
  console.log('Running DeepLink Launcher tests...\n');
  const deeplinkTester = new DeepLinkTester();
  const deeplinkResults = deeplinkTester.runAllTests();
  
  console.log('\n📊 DeepLink Launcher Test Results:');
  console.log(`Total: ${deeplinkResults.total}`);
  console.log(`✅ Passed: ${deeplinkResults.passed}`);
  console.log(`❌ Failed: ${deeplinkResults.failed}`);
  console.log(`Success Rate: ${((deeplinkResults.passed / deeplinkResults.total) * 100).toFixed(1)}%\n`);
}

if (testSuite === 'url' || testSuite === 'all') {
  console.log('Running URL Encoder/Decoder tests...\n');
  const urlEncoderTester = new URLEncoderTester();
  const urlEncoderResults = urlEncoderTester.runAllTests();
  
  console.log('\n📊 URL Encoder/Decoder Test Results:');
  console.log(`Total: ${urlEncoderResults.total}`);
  console.log(`✅ Passed: ${urlEncoderResults.passed}`);
  console.log(`❌ Failed: ${urlEncoderResults.failed}`);
  console.log(`Success Rate: ${((urlEncoderResults.passed / urlEncoderResults.total) * 100).toFixed(1)}%\n`);
}

if (testSuite === 'qr' || testSuite === 'all') {
  console.log('Running QR Code Generator tests...\n');
  const qrTester = new QRTester();
  const qrResults = qrTester.runAllTests();
  
  console.log('\n📊 QR Code Generator Test Results:');
  console.log(`Total: ${qrResults.total}`);
  console.log(`✅ Passed: ${qrResults.passed}`);
  console.log(`❌ Failed: ${qrResults.failed}`);
  console.log(`Success Rate: ${((qrResults.passed / qrResults.total) * 100).toFixed(1)}%\n`);
}

if (testSuite === 'all') {
  console.log('🎯 For comprehensive testing of all components, run:');
  console.log('node run-all-tests.js');
}

if (!['json', 'deeplink', 'url', 'qr', 'all'].includes(testSuite)) {
  console.log('❌ Invalid test suite specified.');
  console.log('Usage: node run-individual-tests.js [json|deeplink|url|qr|all]');
  process.exit(1);
}
