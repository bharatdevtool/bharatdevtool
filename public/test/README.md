# Bharat Dev Tools - Test Suite

This directory contains comprehensive test suites for all components of the Bharat Dev Tools project.

## Test Structure

### Test Files

- **`run-tests.js`** - Original JSON formatter tests (legacy)
- **`run-all-tests.js`** - Comprehensive test runner for all components
- **`run-individual-tests.js`** - Individual test suite runner
- **`deeplink-tests.js`** - DeepLink launcher test class
- **`qr-tests.js`** - QR code generator test class

### Test Classes

#### DeepLinkTester
Tests for deeplink launcher functionality:
- URL encoding/decoding
- Deep link validation
- Complex deeplink scenarios
- Edge cases
- Performance tests
- Integration scenarios

#### QRTester  
Tests for QR code generator functionality:
- URL parameter handling
- QR code generation
- Share functionality
- Complex scenarios
- Edge cases
- Performance tests
- Integration scenarios

## Running Tests

### Run All Tests (Recommended)
```bash
node run-all-tests.js
```
This runs all test suites: JSON formatter, deeplink launcher, and QR code generator.

### Run Individual Test Suites
```bash
# Run only JSON formatter tests
node run-tests.js

# Run only deeplink launcher tests
node run-individual-tests.js deeplink

# Run only QR code generator tests  
node run-individual-tests.js qr

# Run all test suites
node run-individual-tests.js all
```

## Test Coverage

### DeepLink Launcher Tests
- ✅ URL encoding/decoding with special characters
- ✅ Deep link validation for various schemes
- ✅ Complex deeplink scenarios with multiple parameters
- ✅ Edge cases (empty strings, malformed URLs, control characters)
- ✅ Performance tests for large batches
- ✅ Integration workflows

### QR Code Generator Tests
- ✅ URL parameter handling and decoding
- ✅ QR code generation for various input types
- ✅ Share functionality and Web Share API
- ✅ Complex scenarios (long text, JSON data, base64)
- ✅ Edge cases (empty input, null values, non-strings)
- ✅ Performance tests for multiple generations
- ✅ Integration workflows

### JSON Formatter Tests (Original)
- ✅ Basic JSON formatting and minification
- ✅ JSON validation and error handling
- ✅ JSON repair functionality
- ✅ Hex color preview detection
- ✅ Search and URL detection
- ✅ Performance and edge cases
- ✅ Integration scenarios

## Test Features

### Comprehensive Coverage
- **Edge Cases**: Empty inputs, malformed data, special characters
- **Performance**: Large data sets, batch operations, timing tests
- **Integration**: Complete workflows, cross-component interactions
- **Complex Scenarios**: Real-world use cases, complex data structures

### Robust Testing
- **Error Handling**: Tests for invalid inputs and error conditions
- **Unicode Support**: International characters and emoji
- **Special Characters**: URLs with query parameters, fragments, etc.
- **Large Data**: Performance testing with large datasets

### Easy Maintenance
- **Modular Design**: Separate test classes for each component
- **Clear Structure**: Organized test categories and descriptions
- **Detailed Output**: Comprehensive test results and failure reporting
- **Independent Execution**: Can run individual test suites or all together

## Adding New Tests

### For New Components
1. Create a new test class following the pattern of `DeepLinkTester` or `QRTester`
2. Implement `runTest()`, `assertEqual()`, `assertContains()` methods
3. Add test categories (e.g., `testBasicFunctionality()`, `testEdgeCases()`)
4. Include the new test class in `run-all-tests.js`

### For Existing Components
1. Add new test methods to existing test classes
2. Follow the naming convention: `test[FeatureName]()`
3. Include comprehensive edge cases and error conditions
4. Add performance tests for new functionality

## Test Results

### Success Criteria
- All tests should pass with 100% success rate
- Performance tests should complete within specified time limits
- Edge cases should be handled gracefully
- Integration workflows should work end-to-end

### Failure Handling
- Failed tests are clearly identified with error messages
- Test results show success rate and failure details
- Failed tests are categorized by component
- Detailed error messages help identify issues

## Continuous Integration

These tests are designed to:
- Run in CI/CD pipelines
- Catch regressions early
- Ensure code quality
- Validate all functionality
- Test edge cases that might be missed manually

The test suite provides comprehensive coverage to ensure that any code changes don't break existing functionality and that all components work correctly together.