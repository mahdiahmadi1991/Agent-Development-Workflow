#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const packageRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(packageRoot, '..', '..');
const sourceRoot = path.join(repoRoot, '.codex-onboarding');
const targetRoot = path.join(packageRoot, 'onboarding-assets');

if (!fs.existsSync(sourceRoot)) {
  console.error(`Source onboarding root not found: ${sourceRoot}`);
  process.exit(1);
}

fs.rmSync(targetRoot, { recursive: true, force: true });
fs.mkdirSync(targetRoot, { recursive: true });

fs.cpSync(sourceRoot, targetRoot, {
  recursive: true,
  dereference: true
});

console.log(`Synced onboarding assets: ${sourceRoot} -> ${targetRoot}`);
