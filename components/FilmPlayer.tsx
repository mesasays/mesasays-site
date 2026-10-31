"use client";

import { useState } from "react";

// The YouTube player is loaded only when the visitor clicks play.
// Until then the page shows our own copy of the thumbnail: no request reaches Google.
export function FilmPlayer({ videoId, title, thumb }: { videoId: string; title: string; thumb: string }) {
  const [playing, setPlaying] = useState(false);
  return (
    <div style={{ position: "relative", paddingTop: "56.25%", background: "#000" }}>
      {playing ? (
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1`}
          title={title}
          allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 }}
        />
      ) : (
        <button
          type="button"
          onClick={() => setPlaying(true)}
          aria-label={`Play: ${title}`}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0, padding: 0, cursor: "pointer", background: "none" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={thumb} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          <span aria-hidden="true" style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)", width: 64, height: 64, borderRadius: "50%", background: "rgba(0,0,0,.7)", color: "#fff", fontSize: 26, lineHeight: "64px", textAlign: "center" }}>▶</span>
        </button>
      )}
    </div>
  );
}
