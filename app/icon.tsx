import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const runtime = "nodejs";
// Rendered once at build time (also required by the static IPFS export).
export const dynamic = "force-static";
export const size = { width: 192, height: 192 };
export const contentType = "image/png";

async function loadFont() {
  const data = await readFile(
    join(process.cwd(), "app/fonts/space-grotesk-700.ttf"),
  );
  return [{ name: "Space Grotesk", data, weight: 700 as const, style: "normal" as const }];
}

export default async function Icon() {
  return new ImageResponse(
    (
      // Same mark as favicon.ico: a white Space Grotesk "M" filling a black square, legible at 16 px.
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#000000",
          color: "#ffffff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "Space Grotesk",
          fontSize: 150,
          fontWeight: 700,
          letterSpacing: "-0.04em",
          lineHeight: 1,
        }}
      >
        M
      </div>
    ),
    { ...size, fonts: await loadFont() },
  );
}
