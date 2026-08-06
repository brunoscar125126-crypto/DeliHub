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
    extend: {},
  },
  plugins: [],
};
