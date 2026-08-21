#!/usr/bin/env node
/**
 * Fast TypeScript check across every project in the workspace.
 *
 * Why not `tsc -b`: build mode requires an explicit `rootDir` in each project
 * config, which the Angular schematics do not set (TS6 raises TS5011). Angular
 * owns those files, so we type-check with `--noEmit -p` per project instead of
 * fighting the schematic.
 *
 * Scope note: this checks TypeScript only. Template type checking (strictTemplates)
 * is done by the Angular compiler during `ng build` and `ng test`, which are
 * separate gate steps. Neither replaces the other.
 */

import { execFileSync } from 'node:child_process';
import { readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

// Invoke TypeScript's JS entry point with node directly. Going through `npx`
// or `.bin/tsc` would need shell:true — deprecated in Node 24, and on Windows
// execFile cannot run a .cmd shim at all. This path works on both platforms.
const TSC = join('node_modules', 'typescript', 'bin', 'tsc');

const roots = ['libs', 'apps'];
const configs = [];

for (const root of roots) {
  if (!existsSync(root)) continue;
  for (const project of readdirSync(root, { withFileTypes: true })) {
    if (!project.isDirectory()) continue;
    for (const name of ['tsconfig.lib.json', 'tsconfig.app.json', 'tsconfig.spec.json']) {
      const p = join(root, project.name, name);
      if (existsSync(p)) configs.push(p);
    }
  }
}

if (configs.length === 0) {
  console.log('typecheck: no project tsconfigs found — nothing to do.');
  process.exit(0);
}

const failures = [];
for (const config of configs) {
  try {
    execFileSync(process.execPath, [TSC, '--noEmit', '-p', config], {
      stdio: 'pipe',
      encoding: 'utf8',
    });
  } catch (e) {
    failures.push(`── ${config}\n${`${e.stdout ?? ''}${e.stderr ?? ''}`.trim()}`);
  }
}

if (failures.length) {
  console.error(failures.join('\n\n'));
  console.error(`\ntypecheck: ${failures.length} of ${configs.length} projects failed.`);
  process.exit(1);
}

console.log(`typecheck: ${configs.length} projects clean.`);
