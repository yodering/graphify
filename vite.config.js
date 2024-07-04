import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    define: {
      'import.meta.env.VITE_SPOTIFY_REDIRECT_URI': JSON.stringify(env.VITE_SPOTIFY_REDIRECT_URI)
    },
    build: {
      outDir: 'dist',
      rollupOptions: {
        input: {
          main: 'index.html',
        },
        output: {
          entryFileNames: 'assets/js/[name].js',
          chunkFileNames: 'assets/js/[name].js',
          assetFileNames: 'assets/[ext]/[name].[ext]',
        },
      },
    },
    base: '/',
  }
})