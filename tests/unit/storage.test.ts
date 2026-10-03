import assert from 'node:assert/strict';
import test from 'node:test';
import { MOVIX_DOMAINS } from '../../src/shared/domains';
import { defaultSettings, migrateSettings, resolveActiveTheme, resolveEnabled } from '../../src/shared/storage';
import { DEFAULT_THEMES } from '../../src/theme/presets';

const DOMAIN = MOVIX_DOMAINS[0]!;
const customTheme = { ...DEFAULT_THEMES[1]!, id: 'my-theme', name: 'My Theme', isCustom: true };

test('defaults are enabled, on the Original theme, with the player left alone', () => {
  const settings = defaultSettings();
  assert.equal(settings.globalThemeId, 'original');
  assert.equal(settings.motixEnabled, true);
  assert.equal(settings.themePlayer, false);
  assert.deepEqual(migrateSettings(settings), settings);
});

test('corrupt or missing stored values fall back to defaults', () => {
  for (const raw of [undefined, null, 'text', 42, [], { globalThemeId: 7, domainThemes: 'x', customThemes: {} }]) {
    assert.deepEqual(migrateSettings(raw), defaultSettings());
  }
});

test('schema v1 settings are migrated without losing the user choices', () => {
  const migrated = migrateSettings({
    schemaVersion: 1,
    themeId: 'retro-green',
    enabled: false,
    domainThemes: { [DOMAIN.toUpperCase()]: 'ocean-blue', 'evil.test': 'ocean-blue', [`sub.${DOMAIN}`]: 'does-not-exist' },
    disabledDomains: [DOMAIN],
    supportedDomains: ['movix.gone'],
    customCss: { 'retro-green': 'x' },
  });
  assert.equal(migrated.schemaVersion, 2);
  assert.equal(migrated.globalThemeId, 'retro-green');
  assert.equal(migrated.motixEnabled, false);
  assert.deepEqual(migrated.domainThemes, { [DOMAIN]: 'ocean-blue' });
  assert.deepEqual(migrated.perDomainEnabled, { [DOMAIN]: false });
  assert.equal('supportedDomains' in migrated, false);
  assert.equal('customCss' in migrated, false);
});

test('invalid custom themes are dropped and references to them reset', () => {
  const migrated = migrateSettings({ globalThemeId: 'broken', customThemes: [customTheme, { id: 'broken', colors: {} }] });
  assert.deepEqual(migrated.customThemes.map((theme) => theme.id), ['my-theme']);
  assert.equal(migrated.globalThemeId, 'original');
});

test('a per-domain theme wins over the global theme', () => {
  const settings = { ...defaultSettings(), globalThemeId: 'retro-green', domainThemes: { [DOMAIN]: 'ocean-blue' } };
  assert.equal(resolveActiveTheme(settings, DOMAIN.toUpperCase()).id, 'ocean-blue');
  assert.equal(resolveActiveTheme(settings, `other.${DOMAIN}`).id, 'retro-green');
  assert.equal(resolveActiveTheme(settings).id, 'retro-green');
});

test('a per-domain switch wins over the global switch', () => {
  const settings = { ...defaultSettings(), motixEnabled: false, perDomainEnabled: { [DOMAIN]: true } };
  assert.equal(resolveEnabled(settings, DOMAIN), true);
  assert.equal(resolveEnabled(settings, MOVIX_DOMAINS[1]), false);
  assert.equal(resolveEnabled(settings), false);
});
