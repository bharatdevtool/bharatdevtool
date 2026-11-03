# Build Process - Single Source of Truth

## Overview

This project uses a **single source of truth** approach to avoid code duplication. The `jsonformatter/index.html` file is automatically generated from the root `index.html` file.

## Architecture

- **Source File**: `index.html` (root directory) - **This is the only file you edit**
- **Generated File**: `jsonformatter/index.html` - **Auto-generated, do not edit manually**
- **Build Script**: `build.js` - Generates the subdirectory file with correct paths

## URLs

Both URLs serve the same content (for SEO purposes):

- `https://bharatdevtool.com/` → Root `index.html`
- `https://bharatdevtool.com/jsonformatter/` → Generated `jsonformatter/index.html`

## How to Use

### Making Changes

1. **Edit only `index.html`** (the root file)
2. **Run the build script**:
   ```bash
   node build.js
   ```
   or
   ```bash
   ./build.js
   ```
3. **Test both URLs** to ensure everything works
4. **Commit both files** (source + generated)

### What Gets Transformed Automatically

The build script automatically:

- ✅ Adds `../` prefix to all asset paths (`assets/` → `../assets/`)
- ✅ Adds `../` prefix to component paths (`components/` → `../components/`)
- ✅ Adds `../` prefix to favicon paths
- ✅ Updates import paths (`from './assets/` → `from '../assets/`)
- ✅ Updates navigation links (`deeplink.html` → `../deeplink.html`)
- ✅ Updates canonical URLs (`/` → `/jsonformatter/`)
- ✅ Updates Open Graph URLs
- ✅ Updates structured data URLs

## Workflow Example

```bash
# 1. Edit the source file
vim index.html

# 2. Build the generated file
node build.js

# 3. Test locally
python3 -m http.server 8000
# Visit http://localhost:8000/ and http://localhost:8000/jsonformatter/

# 4. Commit changes
git add index.html jsonformatter/index.html
git commit -m "Update JSON formatter"
```

## Important Notes

⚠️ **Never edit `jsonformatter/index.html` directly** - your changes will be lost when you run the build script!

✅ **Always edit `index.html`** and run `node build.js` after making changes.

## Troubleshooting

If the generated file has incorrect paths:

1. Check that `index.html` uses relative paths (not absolute)
2. Run `node build.js` again
3. Verify the generated file in `jsonformatter/index.html`

## SEO Benefits

Having both URLs:
- Improves Google visibility
- Allows users to access via different paths
- Both URLs are included in `sitemap.xml` for search engine indexing

