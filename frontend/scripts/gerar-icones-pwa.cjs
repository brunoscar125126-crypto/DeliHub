// Regera os ícones PWA (public/pwa-*.png, apple-touch-icon.png) a partir das
// fontes SVG em pwa-assets/. Rodar só quando a marca-ícone mudar:
//   node scripts/gerar-icones-pwa.cjs
const sharp = require('sharp');
const path = require('path');

const raiz = path.join(__dirname, '..');
const src = path.join(raiz, 'pwa-assets', 'icon-source.svg');
const srcMaskable = path.join(raiz, 'pwa-assets', 'icon-maskable-source.svg');
const outDir = path.join(raiz, 'public');

async function run() {
  await sharp(src, { density: 384 }).resize(192, 192).png().toFile(path.join(outDir, 'pwa-192.png'));
  await sharp(src, { density: 384 }).resize(512, 512).png().toFile(path.join(outDir, 'pwa-512.png'));
  await sharp(srcMaskable, { density: 384 }).resize(512, 512).png().toFile(path.join(outDir, 'pwa-maskable-512.png'));
  await sharp(srcMaskable, { density: 384 }).resize(180, 180).png().toFile(path.join(outDir, 'apple-touch-icon.png'));
  console.log('ícones gerados em', outDir);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
