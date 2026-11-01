"use client";

import "./globals.css";

// Last-resort error page (replaces the root layout), so it must render its own html/body.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body>
        <main className="ms-page">
          <h1 className="ms-title">Mesasays is temporarily unavailable</h1>
          <p className="ms-lede ms-num">Please try again in a moment. · Inténtalo de nuevo en un momento.</p>
          <button type="button" className="ms-button" onClick={() => reset()} style={{ maxWidth: 320 }}>
            Try again · Reintentar
          </button>
        </main>
      </body>
    </html>
  );
}
