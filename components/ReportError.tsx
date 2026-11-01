import { CONTACT_EMAIL, PUBLIC_REPO_URL, absoluteUrl } from "@/lib/site";
import { paths, type Locale } from "@/lib/i18n";

// "Report an error" on every restaurant record: a pre-filled public GitHub issue, or the same text by email.
// The data-correction label is applied only if it exists on the repository; GitHub ignores it otherwise.

const COPY = {
  en: {
    label: "Corrections",
    github: "Report an error",
    email: "by email",
    title: (name: string) => `Correction: ${name}`,
    body: (name: string, slug: string, url: string) =>
      `Restaurant: ${name}\nSlug: ${slug}\nPage: ${url}\n\nWhat is wrong?\n\n\nWhat is right?\n\n\nSource (link) if you have one:\n`,
  },
  es: {
    label: "Correcciones",
    github: "Reportar un error",
    email: "por correo",
    title: (name: string) => `Corrección: ${name}`,
    body: (name: string, slug: string, url: string) =>
      `Restaurante: ${name}\nSlug: ${slug}\nPágina: ${url}\n\n¿Qué está mal?\n\n\n¿Qué es lo correcto?\n\n\nFuente (enlace) si tienes una:\n`,
  },
} as const;

export function reportLinks(name: string, slug: string, locale: Locale) {
  const c = COPY[locale];
  const title = encodeURIComponent(c.title(name));
  const body = encodeURIComponent(c.body(name, slug, absoluteUrl(paths.restaurant(slug, locale))));
  return {
    github: `${PUBLIC_REPO_URL}/issues/new?title=${title}&body=${body}&labels=data-correction`,
    email: `mailto:${CONTACT_EMAIL}?subject=${title}&body=${body}`,
  };
}

export function ReportError({ name, slug, locale = "en" }: { name: string; slug: string; locale?: Locale }) {
  const c = COPY[locale];
  const links = reportLinks(name, slug, locale);
  return (
    <div className="ms-fact">
      <span className="ms-label">{c.label}</span>
      <span>
        <a href={links.github} className="ms-link" target="_blank" rel="noreferrer">{c.github}</a>
        {" · "}
        <a href={links.email} className="ms-link">{c.email}</a>
      </span>
    </div>
  );
}
