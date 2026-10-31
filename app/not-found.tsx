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
    <main className="ds-page">
      <div className="ds-kicker-row">
        <span className="ds-label">Error</span>
        <span className="num">404</span>
      </div>
      <h1 className="ds-title">Page not found</h1>
      <p className="ds-lede" lang="es-MX">Página no encontrada.</p>
      <div className="ds-card-actions" style={{ maxWidth: 360 }}>
        <Link href="/" className="ds-cta">Home</Link>
        <Link href="/es" className="ds-cta" hrefLang="es-MX" lang="es-MX">Inicio</Link>
      </div>
    </main>
  );
}
