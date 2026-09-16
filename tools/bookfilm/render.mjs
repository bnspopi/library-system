// Renders one film per title in films.json, then encodes it the way the
// rest of the footage is encoded (all-intra H.264, a phone copy, a poster)
// into ../../scenes/. Usage: node render.mjs [slug ...]
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const films = JSON.parse(readFileSync(resolve(here, "films.json"), "utf8"));
const only = process.argv.slice(2);
const FF = process.env.FFMPEG || "ffmpeg";
const browser = process.env.REMOTION_BROWSER ? ` --browser-executable=${process.env.REMOTION_BROWSER}` : "";
mkdirSync(resolve(here, "out"), { recursive: true });
mkdirSync(resolve(here, "public"), { recursive: true });

for (const f of films) {
  if (only.length && !only.includes(f.slug)) continue;
  for (const c of f.characters) {
    const src = resolve(here, "../../", c.image);
    if (!existsSync(src)) { console.log(`skip ${f.slug}: missing ${c.image}`); continue; }
    copyFileSync(src, resolve(here, "public", c.image.split("/").pop()));
    c.image = c.image.split("/").pop();
  }
  const props = resolve(here, "out", `${f.slug}.json`);
  writeFileSync(props, JSON.stringify(f));
  const raw = resolve(here, "out", `${f.slug}.mp4`);
  execSync(`npx remotion render src/index.ts BookFilm ${raw} --codec h264 --crf 17 --overwrite --props=${props}${browser}`, { cwd: here, stdio: "inherit" });
  const dst = resolve(here, "../../scenes", `story-${f.slug}`);
  execSync(`${FF} -v error -y -i ${raw} -an -c:v libx264 -preset slow -crf 26 -g 1 -pix_fmt yuv420p -movflags +faststart ${dst}.mp4`, { stdio: "inherit" });
  execSync(`${FF} -v error -y -i ${raw} -an -vf scale=720:-2 -c:v libx264 -preset slow -crf 28 -g 1 -pix_fmt yuv420p -movflags +faststart ${dst}-m.mp4`, { stdio: "inherit" });
  execSync(`${FF} -v error -y -ss 4 -i ${raw} -frames:v 1 -q:v 4 ${dst}.jpg`, { stdio: "inherit" });
  console.log(`rendered story-${f.slug}`);
}
