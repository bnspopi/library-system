// Cuts the plates named in artifacts/scene_plan.json into one short film.
// The images are read straight out of a clone of the gallery repository; nothing
// is generated. Usage:
//   GALLERY=/path/to/awesome-gpt-image-2 node render.mjs [outdir]
import { execSync } from "node:child_process";
import { readFileSync, existsSync, mkdirSync, copyFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const plan = JSON.parse(readFileSync(resolve(here, "artifacts/scene_plan.json"), "utf8"));
const GALLERY = process.env.GALLERY || "/home/user/freestylefly/awesome-gpt-image-2";
const FF = process.env.FFMPEG || "ffmpeg";
const browser = process.env.REMOTION_BROWSER ? ` --browser-executable=${process.env.REMOTION_BROWSER}` : "";
const outDir = resolve(here, process.argv[2] || "out");

mkdirSync(resolve(here, "public"), { recursive: true });
mkdirSync(outDir, { recursive: true });

const missing = [];
for (const s of plan.shots) {
  const src = resolve(GALLERY, "data/images", s.file);
  if (!existsSync(src)) { missing.push(s.file); continue; }
  copyFileSync(src, resolve(here, "public", s.file));
}
if (missing.length) {
  console.error(`missing plates in ${GALLERY}/data/images: ${missing.join(", ")}`);
  process.exit(1);
}

const raw = resolve(outDir, "plates.mp4");
execSync(`npx remotion render src/index.ts Montage ${raw} --codec h264 --crf 17 --overwrite${browser}`,
  { cwd: here, stdio: "inherit" });

/* a delivery copy, and a poster */
execSync(`${FF} -v error -y -i ${raw} -an -c:v libx264 -preset slow -crf 21 -pix_fmt yuv420p -movflags +faststart ${resolve(outDir, "plates-from-the-gallery.mp4")}`, { stdio: "inherit" });
execSync(`${FF} -v error -y -ss 4 -i ${raw} -frames:v 1 -q:v 3 ${resolve(outDir, "plates-from-the-gallery.jpg")}`, { stdio: "inherit" });
console.log(`rendered ${resolve(outDir, "plates-from-the-gallery.mp4")}`);
