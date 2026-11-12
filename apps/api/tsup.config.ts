import {defineConfig} from 'tsup'

// Generar bundle ESM de servidor, incorporando los contratos internos del monorepo.
export default defineConfig({
  entry: ['src/server.ts'],
  format: ['esm'],
  platform: 'node',
  target: 'node22',
  outDir: 'dist',
  clean: true,
  splitting: false,
  noExternal: ['@atlas/contracts','@atlas/fixtures']
})
