import { build } from 'vite';
await build({
  configFile: false,
  build: {
    ssr: 'scripts/generate-data.ts',
    outDir: '.cache/generator',
    emptyOutDir: false,
    minify: false,
  },
});
await import('../.cache/generator/generate-data.js');
