import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig({
  configFile: false,
  publicDir: false,
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    lib: {
      entry: fileURLToPath(new URL('./src/content/content-script.tsx', import.meta.url)),
      formats: ['iife'],
      name: 'MotixContent',
      fileName: () => 'content.js',
    },
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
});
