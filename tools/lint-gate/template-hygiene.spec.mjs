import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const BACKTICK = String.fromCharCode(96);

const walk = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)],
  );

/**
 * Source hygiene checks that TypeScript catches only indirectly.
 *
 * These are not style rules. Each one encodes a mistake that actually happened
 * during development and cost real time to diagnose, because the resulting
 * error message pointed somewhere other than the cause.
 */
describe('inline Angular templates', () => {
  /**
   * A backtick inside an inline `template:` literal TERMINATES the literal,
   * and everything after it is parsed as JavaScript. TypeScript does report an
   * error, but it points dozens of lines away from the real problem — usually
   * at a stray word in the markup.
   *
   * This bit three separate times in Sprint 2, always in a prose comment
   * written in the natural style of the surrounding code documentation. The
   * habit is correct everywhere except inside a template literal, which is
   * exactly why it kept recurring. Failing here names the actual cause.
   */
  it('contain no backticks', () => {
    const offenders = [];

    const sources = walk(join(ROOT, 'libs')).filter(
      (f) => f.endsWith('.ts') && !f.endsWith('.spec.ts'),
    );

    for (const file of sources) {
      const source = readFileSync(file, 'utf8');
      const match = /template:\s*`([\s\S]*?)\n {2}`,/.exec(source);
      if (match?.[1].includes(BACKTICK)) {
        offenders.push(file.slice(ROOT.length + 1));
      }
    }

    expect(
      offenders,
      'A backtick inside an inline template terminates the literal. Use plain quotes in template comments.',
    ).toEqual([]);
  });
});
