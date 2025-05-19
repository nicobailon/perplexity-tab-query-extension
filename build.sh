#!/bin/bash

# Clean dist directory
rm -rf dist
mkdir -p dist

# Build React UI with Vite
npm run build

# Copy other extension files
cp manifest.json dist/
cp background.js dist/
cp -r icons dist/
cp -r utils dist/
cp -r offscreen dist/

# Copy dependencies
mkdir -p dist/node_modules/@mozilla/readability
mkdir -p dist/node_modules/@google/generative-ai
cp node_modules/@mozilla/readability/Readability.js dist/node_modules/@mozilla/readability/
cp -r node_modules/@google/generative-ai/* dist/node_modules/@google/generative-ai/

echo "Build complete! Extension files are in the dist/ directory."
echo "Load the dist/ directory as an unpacked extension in Chrome."