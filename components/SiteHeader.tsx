"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { SITE_NAME } from "@/lib/site";
import { CurrencyEffect } from "@/components/CurrencySwitch";
import { alternatePath, localeOfPath, paths, t, type Locale } from "@/lib/i18n";

function navFor(locale: Locale) {
  const s = t(locale);
  // The wordmark already leads home. Budget and Prices stay online and linked from the home finder,
  // the restaurant list and every restaurant page; they just leave the menu.
  return [
    { href: paths.restaurants(locale), label: s.restaurants },
    { href: paths.dishes(locale), label: s.dishes },
    { href: paths.films(locale), label: s.films },
  ];
}

export function SiteHeader() {
  const pathname = usePathname();
  const locale = localeOfPath(pathname);
  const nav = navFor(locale);
  // Phones: logo and a MENU toggle on one line; the nav grid opens on demand.
  const [open, setOpen] = useState(false);
  const es = locale === "es";
  // On the home page, phones show the whole menu as a row of boxes under the header instead of a MENU button.
  const home = pathname === paths.home(locale);
  // Escape closes the phone menu, like any disclosure.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className={home ? "ms-masthead is-home" : "ms-masthead"} aria-label={es ? "Navegación del sitio" : "Site navigation"}>
      <a href="#content" className="ms-skip">{es ? "Saltar al contenido" : "Skip to content"}</a>
      <div className="ms-masthead-row">
        <div className="ms-brand">
          <Link prefetch={false} href={paths.home(locale)} className="ms-wordmark">{SITE_NAME.toUpperCase()}</Link>
        </div>
        {/* Language: a quiet switch beside the wordmark; hreflang in <head> does the search work. */}
        <p className="ms-lang ms-num">
          {(["en", "es"] as const).map((code, index) => (
            <span key={code}>
              {index ? " · " : ""}
              {code === locale ? (
                <span aria-current="true">{code.toUpperCase()}</span>
              ) : (
                <Link prefetch={false} href={alternatePath(pathname, code)} hrefLang={code === "es" ? "es-MX" : "en"} lang={code} aria-label={t(locale).switchLanguage}>
                  {code.toUpperCase()}
                </Link>
              )}
            </span>
          ))}
        </p>
        <button
          type="button"
          className="ms-nav-toggle"
          aria-expanded={open}
          aria-controls="site-nav"
          onClick={() => setOpen((value) => !value)}
        >
          {open ? (locale === "es" ? "CERRAR" : "CLOSE") : "MENU"}
        </button>
        <div className={`ms-nav-drawer${open ? " is-open" : ""}`} id="site-nav">
          <nav className="ms-nav" aria-label={es ? "Principal" : "Primary"}>
            {nav.map((item) => {
              const active =
                item.href === paths.home(locale)
                  ? pathname === item.href
                  : pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  prefetch={false}
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  onClick={() => setOpen(false)}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
      <CurrencyEffect />
    </header>
  );
}
