// Assembles the loadable extensions in build/chrome and build/firefox from Vite's dist/ output.
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import directory from '../src/shared/domains.json' with { type: 'json' };
import { buildManifest, type Target } from './lib/manifest';

const root = process.cwd();
const pkg = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8')) as { version: string; description: string };

for (const target of ['chrome', 'firefox'] satisfies Target[]) {
  const output = resolve(root, 'build', target);
  await rm(output, { recursive: true, force: true });
  await mkdir(output, { recursive: true });
  await cp(resolve(root, 'dist'), output, { recursive: true });
  await cp(resolve(root, 'src/theme/generated/adapter.css'), resolve(output, 'adapter.css'));
  const manifest = buildManifest(target, { version: pkg.version, description: pkg.description, domains: directory.domains });
  await writeFile(resolve(output, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Motix ${target} build ready at build/${target}`);
}
