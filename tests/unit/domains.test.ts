import assert from 'node:assert/strict';
import test from 'node:test';
import { buildManifest } from '../../scripts/lib/manifest';
import { isThemesPath, returnPath, themesUrlFrom } from '../../src/content/route-detector';
import { isSupportedMovixDomain, isValidHostname, MOVIX_DOMAINS } from '../../src/shared/domains';
import fakeDomains from '../fixtures/fake-domains.json' with { type: 'json' };

test('every synced domain and its subdomains are supported', () => {
  assert.ok(MOVIX_DOMAINS.length > 0);
  for (const domain of MOVIX_DOMAINS) {
    assert.equal(isValidHostname(domain), true, domain);
    assert.equal(isSupportedMovixDomain(domain), true, domain);
    assert.equal(isSupportedMovixDomain(`player.${domain}`), true, domain);
    assert.equal(isSupportedMovixDomain(domain.toUpperCase()), true, domain);
    assert.equal(isSupportedMovixDomain(`${domain}.`), true, domain);
  }
});

test('lookalike hosts are rejected', () => {
  const [domain] = MOVIX_DOMAINS;
  assert.equal(isSupportedMovixDomain(`fake-${domain}`), false);
  assert.equal(isSupportedMovixDomain(`${domain}.evil.test`), false);
  assert.equal(isSupportedMovixDomain(`evil.test/${domain}`), false);
  assert.equal(isSupportedMovixDomain('movix.online'), false, 'the directory itself is not a Movix site');
  assert.equal(isSupportedMovixDomain('not a host'), false);
  assert.equal(isSupportedMovixDomain(''), false);
});

test('none of the fake domains Movix warns about is supported', () => {
  assert.ok(fakeDomains.length > 0);
  for (const fake of fakeDomains) assert.equal(isSupportedMovixDomain(fake), false, fake);
});

test('both manifests are generated from the same domain list', () => {
  const input = { version: '1.2.3', description: 'test', domains: ['movix.example', 'movix.test'] };
  const chrome = buildManifest('chrome', input) as { content_scripts: Array<{ matches: string[]; run_at: string }>; web_accessible_resources: Array<{ matches: string[] }>; permissions: string[] };
  const firefox = buildManifest('firefox', input) as typeof chrome & { browser_specific_settings: unknown };
  const expected = ['*://*.movix.example/*', '*://*.movix.test/*'];
  for (const manifest of [chrome, firefox]) {
    assert.deepEqual(manifest.content_scripts[0]!.matches, expected);
    assert.deepEqual(manifest.web_accessible_resources[0]!.matches, expected);
    assert.equal(manifest.content_scripts[0]!.run_at, 'document_start');
    assert.deepEqual(manifest.permissions, ['storage', 'activeTab']);
  }
  assert.equal('browser_specific_settings' in chrome, false);
  assert.ok(firefox.browser_specific_settings);
});

test('/themes route detection works with or without trailing slash', () => {
  assert.equal(isThemesPath('/themes'), true);
  assert.equal(isThemesPath('/themes/'), true);
  assert.equal(isThemesPath('/themes/extra'), false);
  assert.equal(isThemesPath('/movies'), false);
});

test('opening the editor remembers the page it was opened from', () => {
  const url = themesUrlFrom('/movie/42', '?tab=cast');
  assert.equal(url, '/themes?return=%2Fmovie%2F42%3Ftab%3Dcast');
  assert.equal(returnPath(url.slice(url.indexOf('?'))), '/movie/42?tab=cast');
  assert.equal(themesUrlFrom('/themes/', '?return=%2Fx'), '/themes/?return=%2Fx', 'already on the editor: nothing to remember');
});

test('the editor only ever returns to a path on the same site', () => {
  assert.equal(returnPath('?return=%2Fmovie%2F42%3Ftab%3Dcast'), '/movie/42?tab=cast');
  for (const search of ['', '?return=', '?return=%2F%2Fevil.test', '?return=https%3A%2F%2Fevil.test', '?return=%2F%5Cevil.test', '?return=javascript%3Aalert(1)']) {
    assert.equal(returnPath(search), '/', search);
  }
});
