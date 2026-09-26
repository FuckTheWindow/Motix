import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const target = process.argv[2];
if (target !== 'chrome' && target !== 'firefox') throw new Error('Usage: node scripts/package.mjs chrome|firefox');
const root = process.cwd();
const output = resolve(root, 'build', target);
await mkdir(output, { recursive: true });
await cp(resolve(root, 'dist'), output, { recursive: true, force: true });
await cp(resolve(root, 'public/service-worker.js'), resolve(output, 'service-worker.js'));
const manifest = await readFile(resolve(root, `manifest.${target}.json`), 'utf8');
JSON.parse(manifest);
await writeFile(resolve(output, 'manifest.json'), manifest);
console.log(`Motix ${target} build ready at build/${target}`);
