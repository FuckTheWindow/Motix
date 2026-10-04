import assert from 'node:assert/strict';
import test from 'node:test';
import { MOVIX_DOMAINS } from '../../src/shared/domains';
import { defaultSettings, domainOverrides, migrateSettings, resolveActiveTheme, resolveEnabled, withCustomTheme, withoutCustomTheme } from '../../src/shared/storage';
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

test('custom themes are added or replaced in place, never over a built-in theme', () => {
  const added = withCustomTheme(defaultSettings(), customTheme);
  assert.deepEqual(added.customThemes.map((theme) => theme.name), ['My Theme']);
  const renamed = withCustomTheme(added, { ...customTheme, name: 'Renamed' });
  assert.deepEqual(renamed.customThemes.map((theme) => theme.name), ['Renamed']);
  // Storing a theme does not make it active.
  assert.equal(renamed.globalThemeId, 'original');
  assert.throws(() => withCustomTheme(added, { ...DEFAULT_THEMES[2]!, isCustom: true }), /built-in theme/);
});

test('deleting a custom theme falls back to the original look wherever it was active', () => {
  const settings = { ...withCustomTheme(defaultSettings(), customTheme), globalThemeId: customTheme.id, domainThemes: { [DOMAIN]: customTheme.id, 'other.test': 'ocean-blue' } };
  const deleted = withoutCustomTheme(settings, customTheme.id);
  assert.deepEqual(deleted.customThemes, []);
  assert.equal(deleted.globalThemeId, 'original');
  assert.deepEqual(deleted.domainThemes, { 'other.test': 'ocean-blue' });
});

test('a save for every site reports the other sites whose own choice it replaces', () => {
  const settings = { ...defaultSettings(), domainThemes: { [DOMAIN]: 'ocean-blue', [`sub.${DOMAIN}`]: 'dracula' } };
  assert.deepEqual(domainOverrides(settings, DOMAIN), [`sub.${DOMAIN}`]);
  assert.equal(domainOverrides(settings).length, 2);
});
