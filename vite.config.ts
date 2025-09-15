import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

const root = resolve(__dirname, 'src');
const outDir = resolve(__dirname, 'dist');

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    outDir,
    emptyOutDir: true,
    rollupOptions: {
      input: {
        options: resolve(root, 'options', 'index.html'),
        background: resolve(root, 'background', 'index.ts'),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          // Use the name of the entry point file (e.g., 'background') as the output file name
          return `${chunkInfo.name}.js`;
        },
        chunkFileNames: `assets/js/[name].js`,
        assetFileNames: `assets/[name].[ext]`,
      },
    },
  },
});
