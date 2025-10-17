# Bharat Dev Tools - Test Suite

Comprehensive test suite for the JSON Formatter, Beautifier, Minifier, and Repair tool.

## 🧪 What We Test

This test suite covers all the functionality built in the Bharat Dev Tools project:

### Core JSON Functions
- ✅ **JSON Formatting** - Pretty printing with proper indentation
- ✅ **JSON Minification** - Removing whitespace and compacting
- ✅ **JSON Validation** - Checking if input is valid JSON
- ✅ **JSON Escape/Unescape** - Handling special characters in strings

### JSON Repair (Core Feature)
- ✅ **Trailing Commas** - Remove trailing commas from objects/arrays
- ✅ **Unquoted Keys** - Add quotes to unquoted object keys
- ✅ **JavaScript Values** - Replace `undefined`, `NaN`, `Infinity` with `null`
- ✅ **Comments** - Remove `//` and `/* */` comments
- ✅ **JSONP Unwrapping** - Extract JSON from `callback({...})` format
- ✅ **Single Quotes** - Convert `'` to `"` for JSON compliance
- ✅ **Missing Commas** - Add missing commas between properties
- ✅ **BOM Removal** - Remove Byte Order Mark characters
- ✅ **Bare Objects** - Wrap unquoted object literals in braces

### Advanced Features
- ✅ **Hex Color Preview** - Detect and display color previews for hex values
- ✅ **Search Functionality** - Single character search support
- ✅ **URL Detection** - Identify and handle clickable URLs
- ✅ **Escape Sequence Styling** - Highlight escape sequences in orange
- ✅ **Performance** - Large file handling and optimization
- ✅ **Edge Cases** - Empty input, whitespace, malformed data
- ✅ **Integration** - Complete workflows with multiple features

## 🚀 Running Tests

### Option 1: Web Interface
Open `test/index.html` in your browser and click "Run All Tests" for a visual test interface.

### Option 2: Command Line
```bash
# Navigate to test directory
cd test

# Run all tests
npm test

# Or run directly with Node
node run-tests.js
```

### Option 3: Individual Test Files
```bash
# Run specific test categories
node run-tests.js --format
node run-tests.js --repair
node run-tests.js --colors
```

## 📊 Test Results

The test suite provides detailed feedback:

```
🧪 Bharat Dev Tools - Test Suite
================================

✅ formatJSON - Basic object formatting
✅ minifyJSON - Basic minification
✅ isValidJSON - Valid JSON returns true
✅ repairJSON - Remove trailing commas
✅ repairJSON - Quote unquoted keys
✅ Hex Color Detection - 6 character hex
✅ Search - Single character search
✅ Integration - Complete workflow with hex colors

📊 TEST SUMMARY
============================================================
Total Tests: 45
✅ Passed: 45
❌ Failed: 0
Success Rate: 100.0%

🎉 ALL TESTS PASSED! The JSON formatter is working perfectly.
```

## 🔧 Test Categories

### 1. Basic JSON Operations (8 tests)
- Formatting, minification, validation, escape/unescape

### 2. JSON Repair (12 tests)
- Core repair functionality for broken JSON

### 3. Hex Color Features (4 tests)
- Color detection and preview functionality

### 4. Search & URL Features (4 tests)
- Search functionality and URL detection

### 5. Performance Tests (2 tests)
- Large file handling and optimization

### 6. Edge Cases (3 tests)
- Empty input, whitespace, malformed data

### 7. Integration Tests (2 tests)
- Complete workflows with multiple features

## 🛡️ Regression Prevention

This test suite prevents regressions by:

1. **Comprehensive Coverage** - Tests every function and feature
2. **Edge Case Testing** - Handles unusual inputs and error conditions
3. **Performance Monitoring** - Ensures large files are handled efficiently
4. **Integration Testing** - Verifies features work together correctly
5. **Visual Validation** - Web interface for manual testing

## 🔍 Debugging Failed Tests

If tests fail:

1. **Check the error message** - It shows expected vs actual results
2. **Review the test code** - Each test is clearly documented
3. **Run individual tests** - Isolate specific functionality
4. **Check browser console** - For web interface issues
5. **Verify imports** - Ensure all modules are properly loaded

## 📈 Adding New Tests

To add tests for new features:

1. **Add test function** in `run-tests.js`
2. **Use `runTest()` helper** for consistent reporting
3. **Include assertions** with `assertEqual()` or `assertContains()`
4. **Document the test** with clear description
5. **Update this README** with new test category

Example:
```javascript
runTest('New Feature - Description', () => {
  const input = 'test input';
  const result = newFunction(input);
  return assertEqual(result, 'expected output', 'Clear error message');
});
```

## 🎯 Quality Assurance

This test suite ensures:

- ✅ **No Breaking Changes** - All existing functionality continues to work
- ✅ **Performance Standards** - Large files are handled efficiently  
- ✅ **Error Handling** - Invalid inputs are handled gracefully
- ✅ **Feature Completeness** - All documented features work correctly
- ✅ **Cross-Browser Compatibility** - Works in all modern browsers
- ✅ **Accessibility** - Features work for all users

## 📝 Test Maintenance

- **Run tests before commits** - Prevent regressions
- **Update tests for new features** - Maintain coverage
- **Review failed tests immediately** - Fix issues quickly
- **Monitor performance tests** - Ensure optimization
- **Document test changes** - Keep team informed

---

**Built with ❤️ for developers who need reliable JSON tools.**
