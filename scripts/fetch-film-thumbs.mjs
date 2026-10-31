// Copy each film's YouTube thumbnail into public/films so pages never load images from Google.
// Run after adding a film to restaurant-intelligence/v1/films.json:  node scripts/fetch-film-thumbs.mjs
import { readFile, writeFile, mkdir, access } from "node:fs/promises";
const films = JSON.parse(await readFile("restaurant-intelligence/v1/films.json", "utf8"));
await mkdir("public/films", { recursive: true });
for (const { videoId } of films) {
  for (const size of ["hq", "mq"]) {
    const out = `public/films/${videoId}-${size}default.jpg`;
    try { await access(out); continue; } catch {}
    const res = await fetch(`https://i.ytimg.com/vi/${videoId}/${size}default.jpg`);
    if (!res.ok) { console.error(`missing ${videoId} ${size}`); continue; }
    await writeFile(out, Buffer.from(await res.arrayBuffer()));
    console.log(`saved ${out}`);
  }
}
