"use client";

import { useMemo, useState } from "react";
import { paths, type Locale } from "@/lib/i18n";
import { matchesQuery } from "@/lib/search";
import { CurrencyToggle, useCurrency, usd } from "@/components/CurrencySwitch";

// The home page's one task module, built like deepstate.sh's swap panel:
// mode tabs, numbered fields, a rate line, one black action.
// Plain links on purpose: a full page load shows the browser's own progress bar,
// where a client-side transition gave no feedback on slow phones.

type Band = { key: string; label: string; name: string; href: string; count: number; areas: Array<{ area: string; href: string; count: number }> };
type Dish = { slug: string; name: string; restaurants: number; from: number | null };
type Place = { slug: string; name: string; area: string | null };

const COPY = {
  en: {
    tabs: ["Budget", "Dish", "Name"],
    budget: "Budget per person",
    area: "Neighborhood",
    anywhere: "All of Mexico City",
    dish: "Dish",
    name: "Restaurant name",
    places: (n: number) => `${n} restaurants`,
    from: (n: number) => `from ${n} MXN`,
    cta: "See restaurants",
    dishCta: "Compare prices",
    note: "before drinks and tip",
    noMatch: "No match",
    fewPlaces: "Too few places to filter by neighborhood",
  },
  es: {
    tabs: ["Presupuesto", "Platillo", "Nombre"],
    budget: "Presupuesto por persona",
    area: "Colonia",
    anywhere: "Toda la Ciudad de México",
    dish: "Platillo",
    name: "Nombre del restaurante",
    places: (n: number) => `${n} restaurantes`,
    from: (n: number) => `desde ${n} MXN`,
    cta: "Ver restaurantes",
    dishCta: "Comparar precios",
    note: "sin bebidas ni propina",
    noMatch: "Sin resultados",
    fewPlaces: "Muy pocos lugares para filtrar por colonia",
  },
};

export function HomeFinder({
  bands,
  dishes,
  places,
  locale,
}: {
  bands: Band[];
  dishes: Dish[];
  places: Place[];
  locale: Locale;
}) {
  const c = COPY[locale];
  const currency = useCurrency();
  // Band labels ("< 300", "1500+") carry no "MXN", so the page-wide converter leaves them alone.
  const bandLabel = (label: string) => (currency === "USD" ? label.replace(/\d[\d,]*/g, (n) => `US$${usd(n)}`) : label);
  const [mode, setMode] = useState(0);
  const [bandIndex, setBandIndex] = useState(2);
  const [areaHref, setAreaHref] = useState("");
  const [dishSlug, setDishSlug] = useState(dishes[0]?.slug ?? "");
  const [query, setQuery] = useState("");

  const band = bands[bandIndex];
  const area = band?.areas.find((entry) => entry.href === areaHref) ?? null;
  const dish = dishes.find((entry) => entry.slug === dishSlug) ?? null;
  const matches = useMemo(() => {
    if (query.trim().length < 2) return [];
    return places.filter((place) => matchesQuery(query, place.name, place.area)).slice(0, 6);
  }, [query, places]);

  return (
    <section className="ds-panel ds-finder" aria-label={c.tabs.join(" / ")}>
      <div className="deepstate-mode-tabs ds-seg">
        {c.tabs.map((label, index) => (
          <button
            key={label}
            type="button"
            aria-pressed={mode === index}
            className={mode === index ? "is-active" : undefined}
            onClick={() => setMode(index)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="deepstate-swap-form">
        {mode === 0 && band ? (
          <>
            <div className="ds-field">
              <div className="ds-field-meta has-toggle"><span>01 · {c.budget}</span><CurrencyToggle es={locale === "es"} /></div>
              <div className="ds-seg ds-finder-choices">
                {bands.map((entry, index) => (
                  <button
                    key={entry.key}
                    type="button"
                    className={index === bandIndex ? "is-active" : undefined}
                    aria-pressed={index === bandIndex}
                    aria-label={entry.name}
                    onClick={() => {
                      setBandIndex(index);
                      setAreaHref("");
                    }}
                  >
                    {bandLabel(entry.label)}
                  </button>
                ))}
              </div>
            </div>
            <div className="deepstate-flip-row"><span className="ds-flip" aria-hidden="true">↓</span></div>
            {band.areas.length ? (
              <label className="ds-field">
                <div className="ds-field-meta"><span>02 · {c.area}</span></div>
                <select className="ds-input" value={areaHref} onChange={(event) => setAreaHref(event.target.value)}>
                  <option value="">{c.anywhere}</option>
                  {band.areas.map((entry) => (
                    <option key={entry.href} value={entry.href}>
                      {entry.area} ({entry.count})
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              // Too few places at this budget to split by neighbourhood: say so instead of an empty list.
              <div className="ds-field">
                <div className="ds-field-meta"><span>02 · {c.area}</span></div>
                <p className="ds-finder-static">{c.anywhere}</p>
                <div className="ds-field-meta" style={{ marginBottom: 0 }}><span>{c.fewPlaces}</span></div>
              </div>
            )}
            <div className="ds-rate" aria-live="polite">
              <span>{c.places(area?.count ?? band.count)}</span>
              <span>{c.note}</span>
            </div>
            <a href={(area?.href ?? band.href)} className="ds-cta">{c.cta}</a>
          </>
        ) : null}

        {mode === 1 ? (
          <>
            <label className="ds-field">
              <div className="ds-field-meta"><span>01 · {c.dish}</span></div>
              <select className="ds-input" value={dishSlug} onChange={(event) => setDishSlug(event.target.value)}>
                {dishes.map((entry) => (
                  <option key={entry.slug} value={entry.slug}>{entry.name}</option>
                ))}
              </select>
            </label>
            {dish ? (
              <div className="ds-rate" aria-live="polite">
                <span>{c.places(dish.restaurants)}</span>
                <span>{dish.from ? c.from(dish.from) : ""}</span>
              </div>
            ) : null}
            {dish ? <a href={paths.dish(dish.slug, locale)} className="ds-cta">{c.dishCta}</a> : null}
          </>
        ) : null}

        {mode === 2 ? (
          <>
            <label className="ds-field">
              <div className="ds-field-meta"><span>01 · {c.name}</span></div>
              <input className="ds-input" value={query} autoComplete="off" onChange={(event) => setQuery(event.target.value)} />
            </label>
            <div aria-live="polite">
            {query.trim().length >= 2 ? (
              matches.length ? (
                <ul className="ds-list ds-finder-results">
                  {matches.map((place) => (
                    <li key={place.slug}>
                      <a href={paths.restaurant(place.slug, locale)} className="ds-link">{place.name}</a>
                      {place.area ? <span className="num"> · {place.area}</span> : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="ds-rate"><span>{c.noMatch}</span></div>
              )
            ) : null}
            </div>
          </>
        ) : null}
      </div>
    </section>
  );
}
