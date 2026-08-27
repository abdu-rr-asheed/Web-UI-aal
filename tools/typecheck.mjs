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

/**
 * The library tsconfigs resolve sibling @aal/* packages to dist/, not to
 * source — deliberately, so a library build never pulls a sibling's sources
 * across its rootDir (see libs/components/tsconfig.lib.json). A built tree is
 * therefore a PRECONDITION of type checking, not an optional convenience.
 *
 * Without this guard the failure mode is ~200 "Cannot find module '@aal/...'"
 * errors followed by a cascade of "Object is of type 'unknown'", which reads
 * like the code is broken rather than like a step was skipped. That is exactly
 * how it was misread in CI: the static job ran typecheck before any build and
 * failed on every push to main from 22 to 27 August 2026.
 */
const REQUIRED_DIST = ['tokens', 'a11y-core', 'primitives', 'components'];
const missing = REQUIRED_DIST.filter((p) => !existsSync(join('dist', p)));

if (missing.length) {
  console.error(
    [
      `typecheck: dist/${missing.join(', dist/')} not built.`,
      'The @aal/* libraries type-check against their BUILT output, not their sources.',
      'Run `npm run build` first.',
    ].join('\n'),
  );
  process.exit(1);
}

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
