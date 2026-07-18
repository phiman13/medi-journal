// Erzeugt Platzhalter-App-Icons (Kreis auf einfarbigem Grund). Echtes
// Branding kommt laut SPEC.md §8 erst in M6 (Politur) - bis dahin reicht ein
// simples, aber technisch valides Icon für Installierbarkeit (Chrome) und
// apple-touch-icon (iOS). Reine Build-Time-Dev-Tool, keine Laufzeit-Abhängigkeit.
import { PNG } from "pngjs";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, "..", "public");

const BACKGROUND = [13, 115, 119]; // teal
const FOREGROUND = [255, 255, 255]; // weiß

function generateIcon(size) {
  const png = new PNG({ width: size, height: size });
  const cx = size / 2;
  const cy = size / 2;
  // Radius innerhalb der ~80%-Safe-Zone für maskable Icons (Android).
  const radius = size * 0.32;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (size * y + x) << 2;
      const dx = x - cx;
      const dy = y - cy;
      const inCircle = dx * dx + dy * dy <= radius * radius;
      const [r, g, b] = inCircle ? FOREGROUND : BACKGROUND;
      png.data[idx] = r;
      png.data[idx + 1] = g;
      png.data[idx + 2] = b;
      png.data[idx + 3] = 255;
    }
  }

  return PNG.sync.write(png);
}

for (const size of [192, 512, 180]) {
  const buffer = generateIcon(size);
  const filename = size === 180 ? "apple-touch-icon.png" : `icon-${size}.png`;
  writeFileSync(join(publicDir, filename), buffer);
  console.log(`geschrieben: public/${filename}`);
}
