import assert from 'node:assert/strict';
import test from 'node:test';
import { buildAdapter, rewriteColors, rewriteRadius, scopeSelector } from '../../scripts/lib/build-adapter';

const tokensOf = (value: string, kind: 'bg' | 'fg' | 'bd' | 'sh' = 'bg') => {
  const tokens = new Set<string>();
  return { value: rewriteColors(value, kind, tokens), tokens: [...tokens] };
};

test('every colour notation becomes a token that falls back to the original colour', () => {
  assert.deepEqual(tokensOf('rgba(220,38,38,var(--tw-bg-opacity,1))'), { value: 'rgba(var(--mx-bg-220-38-38, 220,38,38),var(--tw-bg-opacity,1))', tokens: ['bg-220-38-38'] });
  assert.equal(tokensOf('rgb(0 0 0 / .6)').value, 'rgba(var(--mx-bg-0-0-0, 0,0,0),.6)');
  assert.equal(tokensOf('#fff', 'fg').value, 'rgba(var(--mx-fg-255-255-255, 255,255,255),1)');
  assert.equal(tokensOf('#dc262680').value, 'rgba(var(--mx-bg-220-38-38, 220,38,38),0.502)');
  assert.equal(tokensOf('white', 'fg').value, 'rgba(var(--mx-fg-255-255-255, 255,255,255),1)');
  assert.equal(tokensOf('0 0 10px rgba(229,9,20,.5), 0 1px #000', 'sh').value, '0 0 10px rgba(var(--mx-sh-229-9-20, 229,9,20),.5), 0 1px rgba(var(--mx-sh-0-0-0, 0,0,0),1)');
});

test('values without a literal colour, or with a url, are left alone', () => {
  for (const value of ['transparent', 'currentColor', 'var(--media-color)', 'rgb(var(--media-color-surface))', 'url(a.png) #fff', 'nowrap']) {
    assert.equal(tokensOf(value).value, undefined, value);
  }
});

test('radii scale, except zero and pill shapes', () => {
  assert.equal(rewriteRadius('.5rem'), 'calc(.5rem * var(--mx-radius-scale, 1))');
  assert.equal(rewriteRadius('4px 0'), 'calc(4px * var(--mx-radius-scale, 1)) 0');
  for (const value of ['9999px', '0', '50%', 'inherit', 'var(--radius)']) assert.equal(rewriteRadius(value), undefined, value);
});

test('selectors are scoped to the themed document', () => {
  assert.equal(scopeSelector('.bg-black'), 'html[data-motix-theme] .bg-black');
  assert.equal(scopeSelector('html[data-no-blur] .x'), 'html[data-motix-theme][data-no-blur] .x');
  assert.equal(scopeSelector(':root'), 'html[data-motix-theme]');
  assert.equal(scopeSelector('.dark .x'), 'html[data-motix-theme].dark .x');
  assert.equal(scopeSelector('.darker'), 'html[data-motix-theme] .darker');
});

test('the adapter keeps only colour and radius declarations, with their conditions', () => {
  const { css, tokens } = buildAdapter(`
    .bg-red-600{--tw-bg-opacity:1;background-color:rgba(220,38,38,var(--tw-bg-opacity,1));display:block}
    .hover\\:text-white:hover,.x{color:#fff}
    .flex{display:flex}
    @media (min-width:768px){.md\\:rounded-lg{border-radius:.5rem}}
    @keyframes pulse{from{color:#fff}to{color:#000}}
    .video-js .vjs-play-progress{background-color:#e50914}
    .section-title{--custom-token:#fff}
  `);
  const rules = css.trim().split('\n').slice(1);
  assert.deepEqual(rules, [
    'html[data-motix-theme] .bg-red-600{background-color:rgba(var(--mx-bg-220-38-38, 220,38,38),var(--tw-bg-opacity,1))!important}',
    'html[data-motix-theme] .hover\\:text-white:hover,html[data-motix-theme] .x{color:rgba(var(--mx-fg-255-255-255, 255,255,255),1)!important}',
    '@media (min-width:768px){html[data-motix-theme] .md\\:rounded-lg{border-radius:calc(.5rem * var(--mx-radius-scale, 1))!important}}',
  ]);
  assert.deepEqual(tokens, ['bg-220-38-38', 'fg-255-255-255']);
});
