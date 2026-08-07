import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';
import tailwindConfig from './tailwind.config.js';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // autoUpdate: o SW novo assume assim que a página recarrega, sem
      // precisar de um botão "atualizar disponível" — mais simples pro
      // estágio atual do projeto (single-tenant, sem usuários em produção
      // concorrente pra coordenar).
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'DeliHub',
        short_name: 'DeliHub',
        description: 'Painel unificado de pedidos, cardápio e horário de funcionamento — iFood, 99Food e mais.',
        lang: 'pt-BR',
        // Mesmos tokens de frontend/tailwind.config.js (primary/background).
        theme_color: '#F5A623',
        background_color: '#F8F9FB',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      // Service worker básico: só pré-cacheia o build (JS/CSS/HTML/ícones)
      // via Workbox padrão do plugin — sem estratégia de cache pra chamadas
      // de API (GET /api/... nunca passa pelo SW), pra nunca servir pedido
      // desatualizado offline por engano.
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
      },
    }),
  ],
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
