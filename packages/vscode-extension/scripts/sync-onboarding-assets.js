#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const checkMode = process.argv.includes('--check');
const packageRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(packageRoot, '..', '..');
const sourceRoot = path.join(repoRoot, '.codex-onboarding');
const targetRoot = path.join(packageRoot, 'onboarding-assets');

function collectFileMap(rootDir) {
  const files = new Map();

  function walk(currentDir) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const absolutePath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        walk(absolutePath);
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      const relativePath = path
        .relative(rootDir, absolutePath)
        .split(path.sep)
        .join('/');
      files.set(relativePath, fs.readFileSync(absolutePath));
    }
  }

  walk(rootDir);
  return files;
}

function verifyMirrorSync() {
  if (!fs.existsSync(targetRoot)) {
    console.error(`Target onboarding mirror not found: ${targetRoot}`);
    console.error('Run: npm run sync:onboarding-assets');
    process.exit(1);
  }

  const sourceFiles = collectFileMap(sourceRoot);
  const targetFiles = collectFileMap(targetRoot);

  const differences = [];
  for (const [relativePath, sourceContent] of sourceFiles.entries()) {
    if (!targetFiles.has(relativePath)) {
      differences.push(`Missing in mirror: ${relativePath}`);
      continue;
    }

    const targetContent = targetFiles.get(relativePath);
    if (Buffer.compare(sourceContent, targetContent) !== 0) {
      differences.push(`Content mismatch: ${relativePath}`);
    }
  }

  for (const relativePath of targetFiles.keys()) {
    if (!sourceFiles.has(relativePath)) {
      differences.push(`Unexpected file in mirror: ${relativePath}`);
    }
  }

  if (differences.length > 0) {
    console.error('Onboarding asset mirror is out of sync.');
    for (const item of differences) {
      console.error(`- ${item}`);
    }
    console.error('Run: npm run sync:onboarding-assets');
    process.exit(1);
  }

  console.log(`Onboarding asset mirror is in sync: ${sourceRoot} == ${targetRoot}`);
}

if (!fs.existsSync(sourceRoot)) {
  console.error(`Source onboarding root not found: ${sourceRoot}`);
  process.exit(1);
}

if (checkMode) {
  verifyMirrorSync();
  process.exit(0);
}

fs.rmSync(targetRoot, { recursive: true, force: true });
fs.mkdirSync(targetRoot, { recursive: true });

fs.cpSync(sourceRoot, targetRoot, {
  recursive: true,
  dereference: true
});

console.log(`Synced onboarding assets: ${sourceRoot} -> ${targetRoot}`);
