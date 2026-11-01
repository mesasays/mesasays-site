import Link from "next/link";
import type { Metadata } from "next";
import { privateRobots } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Not found · Página no encontrada",
  robots: privateRobots(),
};

// One 404 for both languages: the root layout cannot know which one the visitor expected.
export default function NotFound() {
  return (
    <main className="ms-page">
      <div className="ms-eyebrow">
        <span className="ms-label">Error</span>
        <span className="ms-num">404</span>
      </div>
      <h1 className="ms-title">Page not found</h1>
      <p className="ms-lede" lang="es-MX">Página no encontrada.</p>
      <div className="ms-actions" style={{ maxWidth: 360 }}>
        <Link href="/" className="ms-button">Home</Link>
        <Link href="/es" className="ms-button" hrefLang="es-MX" lang="es-MX">Inicio</Link>
      </div>
    </main>
  );
}
