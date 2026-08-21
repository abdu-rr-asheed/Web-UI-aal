import { describe, it, expect } from 'vitest';
import {
  parseHex,
  compositeOver,
  relativeLuminance,
  contrastRatio,
  reportRatio,
  meets,
} from './contrast.mjs';

/**
 * The AR-07 / AR-08 conformance claim is only as good as this arithmetic.
 * These assertions are against INDEPENDENTLY PUBLISHED reference values, not
 * against whatever the implementation happens to return — a test that merely
 * records current behaviour would pass just as happily with a wrong formula.
 *
 * References:
 *   WCAG 2.2 relative luminance — https://www.w3.org/TR/WCAG22/#dfn-relative-luminance
 *   WCAG 2.2 contrast ratio     — https://www.w3.org/TR/WCAG22/#dfn-contrast-ratio
 */
describe('WCAG contrast', () => {
  describe('relative luminance — normative anchors', () => {
    it('is exactly 1 for white', () => {
      expect(relativeLuminance(parseHex('#ffffff'))).toBe(1);
    });

    it('is exactly 0 for black', () => {
      expect(relativeLuminance(parseHex('#000000'))).toBe(0);
    });

    it('is 0.2158605 for mid grey #808080 (published value)', () => {
      // Note the gap between "mid grey" by hex value and by perceived
      // lightness: 50% grey carries only ~21.6% of white's luminance. Reasoning
      // about contrast from hex intuition is exactly how contrast bugs happen.
      expect(relativeLuminance(parseHex('#808080'))).toBeCloseTo(0.2158605, 6);
    });

    it('weights green most heavily, then red, then blue', () => {
      const r = relativeLuminance(parseHex('#ff0000'));
      const g = relativeLuminance(parseHex('#00ff00'));
      const b = relativeLuminance(parseHex('#0000ff'));
      expect(g).toBeGreaterThan(r);
      expect(r).toBeGreaterThan(b);
      // The coefficients are normative: 0.2126 R, 0.7152 G, 0.0722 B.
      expect(r).toBeCloseTo(0.2126, 4);
      expect(g).toBeCloseTo(0.7152, 4);
      expect(b).toBeCloseTo(0.0722, 4);
    });
  });

  describe('contrast ratio — published reference pairs', () => {
    it('black on white is 21:1, the theoretical maximum', () => {
      expect(reportRatio(contrastRatio('#000000', '#ffffff'))).toBe(21);
    });

    it('a colour against itself is 1:1, the theoretical minimum', () => {
      expect(reportRatio(contrastRatio('#3a7bd5', '#3a7bd5'))).toBe(1);
    });

    it('#767676 on white is 4.54:1 — the smallest grey that passes AA text', () => {
      expect(reportRatio(contrastRatio('#767676', '#ffffff'))).toBe(4.54);
      expect(meets(contrastRatio('#767676', '#ffffff'), 4.5)).toBe(true);
    });

    it('#777777 on white is 4.47:1 — one step lighter, and it fails', () => {
      expect(reportRatio(contrastRatio('#777777', '#ffffff'))).toBe(4.47);
      expect(meets(contrastRatio('#777777', '#ffffff'), 4.5)).toBe(false);
    });

    it('#595959 on white is 7:1 — the AAA threshold grey', () => {
      expect(reportRatio(contrastRatio('#595959', '#ffffff'))).toBe(7);
    });

    it('pure blue on white is 8.59:1', () => {
      expect(reportRatio(contrastRatio('#0000ff', '#ffffff'))).toBe(8.59);
    });

    it('pure red on white is 3.99:1 — fails AA text, which surprises people', () => {
      expect(reportRatio(contrastRatio('#ff0000', '#ffffff'))).toBe(3.99);
      expect(meets(contrastRatio('#ff0000', '#ffffff'), 4.5)).toBe(false);
    });

    it('is order-independent', () => {
      const a = contrastRatio('#1550c4', '#ffffff');
      const b = contrastRatio('#ffffff', '#1550c4');
      expect(a).toBe(b);
    });
  });

  describe('rounding — always against the claim, never toward it', () => {
    it('floors rather than rounds, so 4.4999 never reports as 4.50', () => {
      expect(reportRatio(4.4999)).toBe(4.49);
    });

    it('rejects a ratio that would only pass by rounding up', () => {
      expect(meets(4.4999, 4.5)).toBe(false);
    });

    it('accepts a ratio exactly on the threshold', () => {
      expect(meets(4.5, 4.5)).toBe(true);
    });
  });

  describe('parsing', () => {
    it('expands 3-digit shorthand', () => {
      expect(parseHex('#fff')).toEqual({ r: 255, g: 255, b: 255, a: 1 });
    });

    it('reads 8-digit hex alpha', () => {
      const c = parseHex('#10131abf');
      expect(c.r).toBe(0x10);
      expect(c.a).toBeCloseTo(0.749, 3);
    });

    it('is case-insensitive', () => {
      expect(parseHex('#AABBCC')).toEqual(parseHex('#aabbcc'));
    });

    it('throws on a non-hex value rather than guessing', () => {
      expect(() => parseHex('rebeccapurple')).toThrow(/Not a hex colour/);
      expect(() => parseHex('rgb(1,2,3)')).toThrow(/Not a hex colour/);
    });
  });

  describe('alpha compositing', () => {
    it('leaves an opaque colour untouched', () => {
      const c = parseHex('#123456');
      expect(compositeOver(c, parseHex('#ffffff'))).toEqual({ ...c, a: 1 });
    });

    it('blends 50% black over white to mid grey', () => {
      const out = compositeOver(parseHex('#00000080'), parseHex('#ffffff'));
      expect(out.r).toBeCloseTo(128, -1);
      expect(out.a).toBe(1);
    });

    it('measures translucent colours as composited, not as authored', () => {
      // 50% black over white is mid grey (~3.9:1), NOT black (21:1).
      // Measuring the authored value would overstate contrast by 5x.
      const composited = contrastRatio('#00000080', '#ffffff', '#ffffff');
      expect(reportRatio(composited)).toBeLessThan(5);
      expect(reportRatio(composited)).toBeGreaterThan(3);
    });

    it('gives a different result over a different backdrop', () => {
      const overWhite = contrastRatio('#ffffff80', '#ffffff', '#ffffff');
      const overBlack = contrastRatio('#ffffff80', '#ffffff', '#000000');
      expect(overWhite).not.toBeCloseTo(overBlack, 2);
    });
  });
});
