import { AAL_TOKENS, AAL_THEMES, token, type AalTokenPath } from './tokens.generated';

/**
 * Guards on the generated token surface.
 *
 * These are not tests of the generator — the contrast arithmetic is tested in
 * tools/contrast-validator/contrast.spec.mjs, and the contract checking runs as
 * a build gate. What is tested here is the *contract between layers*: tokens
 * that contracts.json and the components depend on must exist and be named
 * predictably. Deleting one should break a test, not a user's focus indicator.
 */
describe('@aal/tokens generated surface', () => {
  it('generates a non-trivial token set', () => {
    expect(Object.keys(AAL_TOKENS).length).toBeGreaterThan(50);
  });

  it('names every custom property with the --aal- prefix', () => {
    const wrong = Object.values(AAL_TOKENS).filter((v) => !v.startsWith('--aal-'));
    expect(wrong).toEqual([]);
  });

  it('maps a dot path to its kebab-case custom property', () => {
    expect(AAL_TOKENS['color.action.bg']).toBe('--aal-color-action-bg');
  });

  it('token() returns a usable CSS var() reference', () => {
    expect(token('color.text.default')).toBe('var(--aal-color-text-default)');
  });

  it('declares exactly the three selectable themes', () => {
    // forced-colors is a media state, not a selectable theme — if it ever
    // appears here, the theming model has been misunderstood somewhere.
    expect([...AAL_THEMES]).toEqual(['light', 'dark', 'high-contrast']);
  });

  describe('Tier 4 sealed invariants must exist (PRD §10.2)', () => {
    // Components cannot enforce AR-05 / AR-09 if these are missing, and their
    // absence would be silent — the CSS var() would just resolve to nothing.
    const sealed: AalTokenPath[] = [
      'focus.ring.width',
      'focus.ring.offset',
      'color.focus.outer',
      'color.focus.inner',
      'target.min',
      'target.comfortable',
    ];
    it.each(sealed)('%s is present', (path) => {
      expect(AAL_TOKENS[path]).toBeDefined();
    });
  });

  describe('tokens referenced by contrast contracts must exist', () => {
    // Mirrors libs/tokens/src/tokens/contracts.json. If a token is renamed and
    // this list is not updated, the validator reports a missing-token error —
    // this test surfaces the same break at unit-test speed.
    const contracted: AalTokenPath[] = [
      'color.surface.default',
      'color.surface.raised',
      'color.text.default',
      'color.text.muted',
      'color.text.link',
      'color.text.on-action',
      'color.action.bg',
      'color.danger.text',
      'color.border.default',
      'color.field.border',
      'color.selected.border',
    ];
    it.each(contracted)('%s is present', (path) => {
      expect(AAL_TOKENS[path]).toBeDefined();
    });
  });

  it('does not leak Tier 1 palette primitives (PRD §10.2)', () => {
    // Exposing raw palette values would let a component reference a colour
    // directly and bypass every contrast contract.
    const leaked = Object.keys(AAL_TOKENS).filter((k) => k.startsWith('palette.'));
    expect(leaked).toEqual([]);
  });
});
