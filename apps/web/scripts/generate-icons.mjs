/**
 * Renders the PWA icons: a minimal take on the GiroWeg brand mark (the
 * quarter-circle frame with a tyre inside) in the design tokens. Run
 * `pnpm --filter @giroweg/web icons` after changing the mark or the brand
 * colors; the PNGs are committed so builds never depend on this script.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const { colors } = await import("../../../packages/shared/src/tokens.ts");

const outDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "public", "icons");
const { bg, lime } = colors.dark;

/**
 * The mark lives in a 100-unit box: a quarter circle whose center is the
 * bottom-right corner (arc + two straight edges) and a tyre (thick ring with
 * a rim) sitting inside it. `markRatio` is the share of the canvas the box
 * spans: maskable icons keep it inside the 80 % safe zone.
 */
const markSvg = `
  <path d="M14 86H86V14A72 72 0 0 0 14 86" stroke-width="7"/>
  <circle cx="57" cy="57" r="17.5" stroke-width="10"/>
  <circle cx="57" cy="57" r="5.5" stroke-width="3"/>
`;

const iconSvg = (size, markRatio) => {
  const box = size * markRatio;
  const offset = (size - box) / 2;
  const scale = box / 100;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="${bg}"/>
  <g transform="translate(${offset} ${offset}) scale(${scale})" fill="none" stroke="${lime}" stroke-linecap="round" stroke-linejoin="round">${markSvg}</g>
</svg>`;
};

const targets = [
  { file: "icon-192.png", size: 192, markRatio: 0.72 },
  { file: "icon-512.png", size: 512, markRatio: 0.72 },
  { file: "icon-maskable-192.png", size: 192, markRatio: 0.56 },
  { file: "icon-maskable-512.png", size: 512, markRatio: 0.56 },
  { file: "apple-touch-icon.png", size: 180, markRatio: 0.72 },
];

await mkdir(outDir, { recursive: true });
for (const { file, size, markRatio } of targets) {
  const png = await sharp(Buffer.from(iconSvg(size, markRatio))).png().toBuffer();
  await writeFile(path.join(outDir, file), png);
  console.log(`${file} (${size}x${size})`);
}
await writeFile(path.join(outDir, "icon.svg"), iconSvg(512, 0.72));
console.log("icon.svg");
