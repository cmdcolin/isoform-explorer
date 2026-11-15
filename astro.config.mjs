import { defineConfig } from 'astro/config'

export default defineConfig({
  site: 'https://cmdcolin.github.io',
  base: '/isoform-explorer',
  trailingSlash: 'always',
  srcDir: './web',
  publicDir: './site',
  outDir: './dist',
  build: { inlineStylesheets: 'never' },
})
