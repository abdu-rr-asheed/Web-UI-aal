#!/usr/bin/env node
/**
 * AAL pre-commit accessibility gate (PRD §12.3, BR-01).
 *
 * Wired as a Claude Code PreToolUse hook on Bash. It inspects the command,
 * and when it is a `git commit` it runs the fast half of the quality gate.
 * Exit 2 blocks the commit and returns stderr to Claude as feedback.
 *
 * Fast checks only (target <30s): lint, stylelint, types, contrast validator,
 * unit tests. The heavy gate — Playwright across three browsers, Lighthouse,
 * Pa11y — stays in CI (.github/workflows/pr-validate.yml) and in /a11y-audit.
 *
 * Every step is skipped gracefully if its tooling does not exist yet, so this
 * works from the very first commit through to the finished library.
 */

import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = process.cwd();

const readStdin = () =>
  new Promise((res) => {
    let d = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (c) => (d += c));
    process.stdin.on('end', () => res(d));
    setTimeout(() => res(d), 2000).unref?.();
  });

/**
 * Projects touched by the staged change, so the gate tests what you edited
 * rather than the whole workspace. Angular CLI has no `affected` graph, but a
 * path->project map is enough and keeps this step honest AND fast.
 *
 * Conservative: an edit outside any project (root config, tools/) returns null,
 * meaning "test everything" — better a slow gate than a missed regression.
 */
const affectedProjects = () => {
  let staged = '';
  try {
    staged = execSync('git diff --cached --name-only', { cwd: ROOT, encoding: 'utf8' });
  } catch {
    return null;
  }
  const files = staged.split('\n').filter(Boolean);
  if (files.length === 0) return null;

  const projects = new Set();
  for (const f of files) {
    const m = /^(libs|apps)\/([^/]+)\//.exec(f);
    if (m) {
      projects.add(m[2]);
      continue;
    }
    // Anything outside a project can affect all of them (tsconfig, deps, tokens).
    if (!/^(docs|research|reports|e2e|\.github|\.claude)\//.test(f) && !/^(PRD|CLAUDE|README)\.md$/.test(f)) {
      return null;
    }
  }
  // Everything downstream of a layer must be retested when that layer changes.
  const downstream = {
    tokens: ['a11y-core', 'primitives', 'components', 'docs'],
    'a11y-core': ['primitives', 'components', 'docs'],
    primitives: ['components', 'docs'],
    components: ['docs'],
  };
  for (const p of [...projects]) (downstream[p] ?? []).forEach((d) => projects.add(d));
  return [...projects];
};

const pkgScripts = () => {
  const p = resolve(ROOT, 'package.json');
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, 'utf8')).scripts ?? {};
  } catch {
    return null;
  }
};

const main = async () => {
  let cmd = '';
  try {
    const raw = await readStdin();
    cmd = raw ? (JSON.parse(raw)?.tool_input?.command ?? '') : '';
  } catch {
    process.exit(0); // unparseable payload is not the commit's fault
  }

  // Only gate real commits. Ignore `git commit --help`, `git log`, etc.
  if (!/\bgit\s+(-\S+\s+)*commit\b/.test(cmd)) process.exit(0);
  if (/--no-verify|--amend\s+--no-edit/.test(cmd)) process.exit(0);

  const scripts = pkgScripts();
  if (scripts === null) process.exit(0); // pre-workspace: nothing to check yet

  const affected = affectedProjects();
  const testCommand = () =>
    affected === null
      ? 'npm run test:ci --silent'
      : affected.map((p) => `npx ng test ${p} --watch=false`).join(' && ');

  /** [label, shell command, requirement ID, run only if this exists] */
  const steps = [
    ['ESLint (a11y rules + layer boundaries)', 'npm run lint --silent', 'AR-*, §7.6', () => 'lint' in scripts && ['eslint.config.js', 'eslint.config.mjs', 'eslint.config.cjs', '.eslintrc.json'].some((f) => existsSync(resolve(ROOT, f)))],
    ['Stylelint (focus/token guards)', 'npm run lint:styles --silent', 'AR-05, §10.5', () => existsSync(resolve(ROOT, '.stylelintrc.json')) || existsSync(resolve(ROOT, 'stylelint.config.js'))],
    ['TypeScript', 'npm run typecheck --silent', '—', () => existsSync(resolve(ROOT, 'tools/typecheck.mjs'))],
    ['Contrast validator (all themes)', 'npm run tokens:validate --silent', 'TR-07', () => 'tokens:validate' in scripts],
    ['Build-tooling tests', 'npm run test:tools --silent', 'TR-07', () => 'test:tools' in scripts],
    [
      `Unit + component a11y${affected ? ` [${affected.join(', ') || 'none affected'}]` : ' [all]'}`,
      testCommand(),
      'TR-01, TR-05',
      () => 'test:ci' in scripts && (affected === null || affected.length > 0),
    ],
  ];

  const failures = [];
  const skipped = [];

  for (const [label, command, req, shouldRun] of steps) {
    if (!shouldRun()) {
      skipped.push(label);
      continue;
    }
    try {
      execSync(command, { cwd: ROOT, stdio: 'pipe', encoding: 'utf8' });
    } catch (e) {
      const out = `${e.stdout ?? ''}${e.stderr ?? ''}`.trim();
      failures.push({ label, req, out: out.split('\n').slice(-40).join('\n') });
    }
  }

  if (failures.length === 0) {
    if (skipped.length) {
      console.error(`[AAL gate] passed. Not yet wired: ${skipped.join(', ')}.`);
    }
    process.exit(0);
  }

  console.error(
    [
      '',
      '════ AAL pre-commit gate FAILED ════',
      '',
      ...failures.flatMap((f) => [`── ${f.label}  (${f.req})`, f.out, '']),
      'Fix the component. Do NOT weaken the gate (CLAUDE.md, PRD §12.4).',
      'Critical and serious accessibility violations can never be waived.',
      'To bypass deliberately — and say why in the commit message — use --no-verify.',
      '',
    ].join('\n'),
  );
  process.exit(2); // 2 = block the tool call, feed stderr back to Claude
};

main();
