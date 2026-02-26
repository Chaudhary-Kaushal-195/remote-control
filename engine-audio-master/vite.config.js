import { defineConfig } from 'vite';

export default defineConfig({
    base: './',
    build: {
        minify: true,
        target: 'esnext',
        rollupOptions: {
            output: {
                entryFileNames: `assets/engine-audio.js`,
                chunkFileNames: `assets/engine-audio.js`,
                assetFileNames: `assets/[name].[ext]`
            }
        }
    },
});
