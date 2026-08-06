import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';
import tailwindConfig from './tailwind.config.js';

export default defineConfig({
  plugins: [react()],
  // Passa o plugin/config do Tailwind explicitamente em vez de depender da
  // auto-descoberta do postcss.config.js (que busca a partir do cwd do
  // processo, subindo na árvore — quebra se o Vite for iniciado com o cwd
  // fora de frontend/).
  css: {
    postcss: {
      plugins: [tailwindcss(tailwindConfig), autoprefixer()],
    },
  },
  server: { port: 5173 },
});
