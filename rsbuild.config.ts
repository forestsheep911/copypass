import { defineConfig } from '@rsbuild/core';
import { pluginReact } from '@rsbuild/plugin-react';
import { pluginLess } from '@rsbuild/plugin-less';
import { pluginTypeCheck } from '@rsbuild/plugin-type-check';

export default defineConfig({
  plugins: [
    pluginReact(),
    pluginLess(),
    pluginTypeCheck(),
  ],
  html: {
    template: './src/renderer/index.html',
  },
  source: {
    entry: {
      index: './src/renderer/index.tsx',
    },
  },
  output: {
    distPath: {
      root: 'dist/renderer',
    },
    target: 'web',
    assetPrefix: './',
  },
  server: {
    port: 3000,
    host: 'localhost',
  },
  dev: {
    writeToDisk: true,
  },
  tools: {
    rspack: {
      target: 'electron-renderer',
      node: {
        global: true,
      },
    },
  },
}); 