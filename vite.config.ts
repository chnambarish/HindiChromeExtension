import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { copyFileSync } from 'fs';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'copy-background',
      writeBundle() {
        // Copy the plain JavaScript background script
        copyFileSync(
          resolve(__dirname, 'src/background/background.js'),
          resolve(__dirname, 'dist/background.js')
        );
      },
    },
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  build: {
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'src/popup/popup.html'),
        options: resolve(__dirname, 'src/options/options.html'),
      },
      output: {
        entryFileNames: `[name]/[name].js`,
        chunkFileNames: 'chunks/[name].[hash].js',
        assetFileNames: (asset) => {
          if (asset.name?.endsWith('.html')) {
            return 'src/[name]/[name].[ext]';
          }
          return 'assets/[name].[hash].[ext]';
        },
      },
    },
    outDir: 'dist',
    emptyOutDir: true,
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
  },
});
