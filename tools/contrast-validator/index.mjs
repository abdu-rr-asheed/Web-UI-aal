#!/usr/bin/env node
/**
 * AAL contrast validator — the TR-07 build-time gate (PRD §10.3).
 *
 * Reads the resolved tokens produced by `npm run tokens:build` and checks every
 * pairing declared in contracts.json, across every shipped theme. A violation
 * fails the build, so a colour that cannot meet WCAG cannot be released.
 *
 * This is the mechanism behind the AR-07 and AR-08 conformance claim: contrast
 * is not reviewed once and asserted forever, it is re-proved on every commit.
 * The JSON report it emits is the dated evidence the dissertation cites.
 *
 * Usage:
 *   node tools/contrast-validator --themes light,dark,high-contrast [--json]
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { contrastRatio, reportRatio, meets, parseHex } from './contrast.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
const CONTRACTS = join(ROOT, 'libs/tokens/src/tokens/contracts.json');
const RESOLVED = join(ROOT, 'dist/tokens/json');
const REPORT_DIR = join(ROOT, 'reports/contrast');

// ---------------------------------------------------------------- args

const argv = process.argv.slice(2);
const argValue = (flag, fallback) => {
  const i = argv.indexOf(flag);
  return i !== -1 && argv[i + 1] ? argv[i + 1] : fallback;
};
const themes = argValue('--themes', 'light,dark,high-contrast').split(',').map((t) => t.trim());
const jsonOnly = argv.includes('--json');

// ---------------------------------------------------------------- load

if (!existsSync(CONTRACTS)) {
  console.error(`contrast-validator: contracts not found at ${CONTRACTS}`);
  process.exit(1);
}
const contracts = JSON.parse(readFileSync(CONTRACTS, 'utf8'));

const tokens = {};
for (const theme of themes) {
  const p = join(RESOLVED, `${theme}.json`);
  if (!existsSync(p)) {
    console.error(
      `contrast-validator: no resolved tokens for theme "${theme}" at ${p}.\n` +
        `Run \`npm run tokens:build\` first.`,
    );
    process.exit(1);
  }
  tokens[theme] = JSON.parse(readFileSync(p, 'utf8'));
}

const commit = (() => {
  try {
    return execSync('git rev-parse --short HEAD', { cwd: ROOT, encoding: 'utf8' }).trim();
  } catch {
    return 'uncommitted';
  }
})();

// ---------------------------------------------------------------- checks

const findings = [];
const results = [];

const push = (f) => findings.push(f);

/** Look up a token in a theme, recording a finding if it is missing. */
function value(theme, path, context) {
  const v = tokens[theme][path];
  if (v === undefined) {
    push({
      severity: 'error',
      kind: 'missing-token',
      theme,
      token: path,
      message: `Token "${path}" is not defined in theme "${theme}" (needed by ${context}).`,
    });
    return null;
  }
  return v;
}

/**
 * Theme key parity. A theme that silently omits a key inherits the base theme's
 * colour, which is exactly how a dark mode ends up with a light-mode value that
 * nobody notices until a user reports it.
 */
function checkParity() {
  const base = themes[0];
  const baseKeys = new Set(Object.keys(tokens[base]));
  for (const theme of themes.slice(1)) {
    const keys = new Set(Object.keys(tokens[theme]));
    for (const k of baseKeys) {
      if (!keys.has(k)) {
        push({
          severity: 'error',
          kind: 'theme-parity',
          theme,
          token: k,
          message: `Theme "${theme}" is missing "${k}", which "${base}" defines. It would silently inherit the ${base} value.`,
        });
      }
    }
    for (const k of keys) {
      if (!baseKeys.has(k)) {
        push({
          severity: 'error',
          kind: 'theme-parity',
          theme,
          token: k,
          message: `Theme "${theme}" defines "${k}", which "${base}" does not. Themes must have identical key sets.`,
        });
      }
    }
  }
}

/** The minimum ratio for a contract in a theme, honouring themeRuleOverrides. */
function ruleFor(theme, ruleName) {
  const override = contracts.themeRuleOverrides?.[theme]?.[ruleName];
  const name = override ?? ruleName;
  const rule = contracts.rules[name];
  if (!rule) throw new Error(`contracts.json: unknown rule "${name}"`);
  return { name, ...rule };
}

function checkContracts() {
  for (const theme of themes) {
    // Translucent tokens are flattened over the theme's page surface before
    // measuring — measuring an un-composited rgba() is measuring a colour that
    // is never actually on screen.
    const backdrop = tokens[theme]['color.surface.default'] ?? '#ffffff';

    for (const c of contracts.contracts) {
      const fg = value(theme, c.fg, `contract "${c.id}"`);
      const bg = value(theme, c.bg, `contract "${c.id}"`);
      if (fg === null || bg === null) continue;

      const rule = ruleFor(theme, c.rule);
      let ratio;
      try {
        ratio = contrastRatio(fg, bg, backdrop);
      } catch (e) {
        push({
          severity: 'error',
          kind: 'unparseable-colour',
          theme,
          contract: c.id,
          message: `${e.message} (contract "${c.id}")`,
        });
        continue;
      }

      const pass = meets(ratio, rule.min);
      const record = {
        theme,
        contract: c.id,
        fg: c.fg,
        fgValue: fg,
        bg: c.bg,
        bgValue: bg,
        rule: rule.name,
        required: rule.min,
        actual: reportRatio(ratio),
        sc: rule.sc,
        level: rule.level,
        requirement: rule.requirement,
        pass,
      };
      results.push(record);

      if (!pass) {
        push({
          severity: 'error',
          kind: 'contrast',
          theme,
          contract: c.id,
          requirement: rule.requirement,
          sc: rule.sc,
          message:
            `[${rule.requirement}] ${theme}/${c.id}: ${reportRatio(ratio)}:1 — needs ${rule.min}:1 ` +
            `(${rule.sc}). ${c.fg} ${fg} on ${c.bg} ${bg}.`,
        });
      }
    }
  }
}

/**
 * Focus ring (AR-05). The two-tone ring passes against a background when AT
 * LEAST ONE tone reaches the ratio — that is the entire point of two tones:
 * the pair survives whatever surface the consumer puts behind the control.
 */
function checkFocusRing() {
  const spec = contracts.focusRing;
  if (!spec) return;

  for (const theme of themes) {
    const backdrop = tokens[theme]['color.surface.default'] ?? '#ffffff';
    const rule = ruleFor(theme, spec.rule);
    const tones = spec.tones.map((t) => ({ path: t, value: value(theme, t, 'focus ring') }));
    if (tones.some((t) => t.value === null)) continue;

    for (const bgPath of spec.against) {
      const bg = value(theme, bgPath, 'focus ring');
      if (bg === null) continue;

      const measured = tones.map((t) => ({
        tone: t.path,
        ratio: reportRatio(contrastRatio(t.value, bg, backdrop)),
      }));
      const best = measured.reduce((a, b) => (b.ratio > a.ratio ? b : a));
      const pass = best.ratio >= rule.min;

      results.push({
        theme,
        contract: `focus-ring-vs-${bgPath}`,
        fg: best.tone,
        fgValue: tones.find((t) => t.path === best.tone).value,
        bg: bgPath,
        bgValue: bg,
        rule: rule.name,
        required: rule.min,
        actual: best.ratio,
        sc: rule.sc,
        level: rule.level,
        requirement: 'AR-05',
        pass,
        tones: measured,
      });

      if (!pass) {
        push({
          severity: 'error',
          kind: 'focus-ring',
          theme,
          contract: `focus-ring-vs-${bgPath}`,
          requirement: 'AR-05',
          sc: rule.sc,
          message:
            `[AR-05] ${theme}: neither focus tone is visible against ${bgPath} (${bg}). ` +
            `Best ${best.tone} = ${best.ratio}:1, needs ${rule.min}:1. ` +
            `A focus indicator the user cannot see is not a focus indicator.`,
        });
      }
    }
  }
}

/** Sanity: every colour token must actually parse, even if no contract uses it. */
function checkParseable() {
  for (const theme of themes) {
    for (const [path, v] of Object.entries(tokens[theme])) {
      if (!path.startsWith('color.')) continue;
      try {
        parseHex(v);
      } catch {
        push({
          severity: 'error',
          kind: 'unparseable-colour',
          theme,
          token: path,
          message: `Token "${path}" in theme "${theme}" is "${v}", which is not a hex colour. Contrast cannot be verified for it.`,
        });
      }
    }
  }
}

// ---------------------------------------------------------------- run

checkParity();
checkParseable();
checkContracts();
checkFocusRing();

const passCount = results.filter((r) => r.pass).length;
const report = {
  schemaVersion: '1.0',
  tool: 'aal-contrast-validator',
  spec: 'WCAG 2.2 relative luminance / contrast ratio',
  commit,
  themes,
  summary: {
    checks: results.length,
    passed: passCount,
    failed: results.length - passCount,
    errors: findings.length,
  },
  exemptions: contracts.exemptions ?? [],
  results,
  findings,
};

mkdirSync(REPORT_DIR, { recursive: true });
writeFileSync(join(REPORT_DIR, `${commit}.json`), JSON.stringify(report, null, 2) + '\n');
writeFileSync(join(REPORT_DIR, 'latest.json'), JSON.stringify(report, null, 2) + '\n');

if (jsonOnly) {
  console.log(JSON.stringify(report, null, 2));
} else if (findings.length === 0) {
  const min = results.reduce((a, r) => (r.actual < a.actual ? r : a), results[0]);
  console.log(
    `contrast: ${passCount}/${results.length} checks pass across ${themes.length} themes ` +
      `(tightest: ${min.theme}/${min.contract} at ${min.actual}:1, needs ${min.required}:1) ` +
      `-> reports/contrast/${commit}.json`,
  );
} else {
  console.error(`\n════ CONTRAST GATE FAILED — ${findings.length} violation(s) ════\n`);
  const byTheme = {};
  for (const f of findings) (byTheme[f.theme] ??= []).push(f);
  for (const [theme, fs] of Object.entries(byTheme)) {
    console.error(`── theme: ${theme}`);
    for (const f of fs) console.error(`   ${f.message}`);
    console.error('');
  }
  console.error(
    'Fix the token values. Do not relax a contract or add an exemption to go green —\n' +
      'an exemption is a documented accessibility decision, not a way past the build\n' +
      '(PRD §12.4). Report: reports/contrast/latest.json\n',
  );
}

process.exit(findings.length === 0 ? 0 : 1);
