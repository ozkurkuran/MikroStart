import { mkdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

import sharp from "sharp";

const sourcePath = resolve("store-assets", "source", "icon.svg");
const publicIconDirectory = resolve("public", "icons");
const storeAssetDirectory = resolve("store-assets");
const source = await readFile(sourcePath);

await Promise.all([
  mkdir(publicIconDirectory, { recursive: true }),
  mkdir(storeAssetDirectory, { recursive: true }),
]);

for (const size of [16, 32, 48, 128]) {
  await sharp(source, { density: 384 })
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toFile(resolve(publicIconDirectory, `icon-${size}.png`));
}

await sharp(source, { density: 384 })
  .resize(128, 128)
  .png({ compressionLevel: 9 })
  .toFile(resolve(storeAssetDirectory, "store-icon-128.png"));

const promoBackground = Buffer.from(`
  <svg xmlns="http://www.w3.org/2000/svg" width="440" height="280" viewBox="0 0 440 280">
    <rect width="440" height="280" fill="#101418"/>
    <circle cx="220" cy="140" r="112" fill="#172127"/>
    <circle cx="220" cy="140" r="82" fill="#1d2b31"/>
    <path d="M0 56h126M314 56h126M0 224h126M314 224h126" stroke="#73d7c4" stroke-opacity=".32"/>
    <path d="M72 0v78M368 0v78M72 202v78M368 202v78" stroke="#73d7c4" stroke-opacity=".18"/>
  </svg>
`);

await sharp(promoBackground)
  .composite([{ input: await sharp(source, { density: 384 }).resize(144, 144).png().toBuffer(), left: 148, top: 68 }])
  .png({ compressionLevel: 9 })
  .toFile(resolve(storeAssetDirectory, "small-promo-440x280.png"));

console.log("Generated Chrome extension icons and store branding assets.");
