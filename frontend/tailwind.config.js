import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Caminhos absolutos (em vez de relativos ao cwd) — evita que o JIT do
// Tailwind escaneie o diretório errado dependendo de como/de onde o
// processo do Vite é iniciado.
const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('tailwindcss').Config} */
export default {
  content: [path.join(__dirname, 'index.html'), path.join(__dirname, 'src/**/*.{js,jsx}')],
  theme: {
    extend: {
      // Design tokens do refactor visual — usar essas classes (bg-surface,
      // text-text-secondary, border-border, etc.) em vez de cores soltas
      // tipo stone-200/orange-500 daqui pra frente, pra manter consistência.
      colors: {
        background: '#F8F9FB',
        surface: '#FFFFFF',
        'surface-muted': '#F5F6F8',
        // Laranja/dourado e marrom-escuro extraídos da logo oficial do
        // DeliHub — identidade visual da marca (ver LogoDeliHub.jsx).
        primary: {
          DEFAULT: '#F5A623',
          hover: '#DB8F13',
        },
        'text-primary': '#2B1810',
        'text-secondary': '#71717A',
        border: '#E4E4E7',
        success: '#10B981',
        warning: '#F59E0B',
        danger: '#F43F5E',
      },
      borderRadius: {
        card: '14px',
        control: '10px',
      },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,0.05)',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
