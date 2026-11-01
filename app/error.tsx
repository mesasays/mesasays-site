"use client";

// Shown when a page throws at render time; keeps the site frame (header stays mounted).
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="ms-page">
      <h1 className="ms-title">Something went wrong · Algo salió mal</h1>
      <p className="ms-lede ms-num">The page could not be displayed. · No se pudo mostrar la página.</p>
      <button type="button" className="ms-button" onClick={() => reset()} style={{ maxWidth: 320 }}>
        Try again · Reintentar
      </button>
    </main>
  );
}
