"use client";

import { useMemo, useState } from "react";
import { paths, type Locale } from "@/lib/i18n";
import { fold, matchesQuery } from "@/lib/search";
import { CurrencyToggle, useCurrency, usd } from "@/components/CurrencySwitch";

// The home page's finder: three search modes (budget, dish, name), numbered steps,
// a one-line summary and a single action.
// Plain links on purpose: a full page load shows the browser's own progress bar,
// where a client-side transition gave no feedback on slow phones.

type Band = { key: string; label: string; name: string; href: string; count: number; areas: Array<{ area: string; href: string; count: number }> };
type Dish = { slug: string; name: string; restaurants: number; from: number | null };
type Place = { slug: string; name: string; area: string | null };

const COPY = {
  en: {
    tabs: ["Budget", "Dish", "Name"],
    budget: "Per person",
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
    servedAt: (n: number) => `Served at ${n} restaurants`,
    typeName: "Start typing a name…",
    fewPlaces: "Too few places to filter by neighborhood",
  },
  es: {
    tabs: ["Presupuesto", "Platillo", "Nombre"],
    budget: "Por persona",
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
    servedAt: (n: number) => `En ${n} restaurantes`,
    typeName: "Escribe un nombre…",
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
    // Best first: name starts with what was typed, then a word of the name does, then the name contains it,
    // then only the neighbourhood matches ("gal" must find Galea before places in Pedregal).
    const typed = fold(query);
    const rank = (name: string) => {
      const folded = fold(name);
      if (folded.startsWith(typed)) return 0;
      if (folded.split(" ").some((word) => word.startsWith(typed))) return 1;
      return folded.includes(typed) ? 2 : 3;
    };
    return places
      .filter((place) => matchesQuery(query, place.name, place.area))
      .map((place) => ({ place, score: rank(place.name) }))
      .sort((a, b) => a.score - b.score || a.place.name.localeCompare(b.place.name))
      .slice(0, 6)
      .map((entry) => entry.place);
  }, [query, places]);

  return (
    <section className="ms-box ms-finder" aria-label={c.tabs.join(" / ")}>
      <div className="ms-finder-tabs">
        {c.tabs.map((label, index) => (
          <button
            key={label}
            type="button"
            aria-pressed={mode === index}
            onClick={() => setMode(index)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="ms-finder-body">
        {mode === 0 && band ? (
          <>
            <div className="ms-step">
              <div className="ms-step-label"><span>01 · {c.budget}</span><CurrencyToggle es={locale === "es"} /></div>
              <div className="ms-budget-choices">
                {bands.map((entry, index) => (
                  <button
                    key={entry.key}
                    type="button"
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
            <div className="ms-step-link"><span className="ms-step-arrow" aria-hidden="true">↓</span></div>
            {band.areas.length ? (
              <label className="ms-step">
                <div className="ms-step-label"><span>02 · {c.area}</span></div>
                <select className="ms-input" value={areaHref} onChange={(event) => setAreaHref(event.target.value)}>
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
              <div className="ms-step">
                <div className="ms-step-label"><span>02 · {c.area}</span></div>
                <p className="ms-finder-static">{c.anywhere}</p>
                <div className="ms-step-label" style={{ marginBottom: 0 }}><span>{c.fewPlaces}</span></div>
              </div>
            )}
            <div className="ms-finder-summary" aria-live="polite">
              <span>{c.places(area?.count ?? band.count)}</span>
              <span>{c.note}</span>
            </div>
            <a href={(area?.href ?? band.href)} className="ms-button">{c.cta}</a>
          </>
        ) : null}

        {mode === 1 ? (
          <>
            <label className="ms-step">
              <div className="ms-step-label"><span>01 · {c.dish}</span></div>
              <select className="ms-input" value={dishSlug} onChange={(event) => setDishSlug(event.target.value)}>
                {dishes.map((entry) => (
                  <option key={entry.slug} value={entry.slug}>{entry.name}</option>
                ))}
              </select>
            </label>
            {dish ? (
              <div className="ms-finder-summary" aria-live="polite">
                <span>{c.servedAt(dish.restaurants)}</span>
                <span>{dish.from ? c.from(dish.from) : ""}</span>
              </div>
            ) : null}
            {dish ? <a href={paths.dish(dish.slug, locale)} className="ms-button">{c.dishCta}</a> : null}
          </>
        ) : null}

        {mode === 2 ? (
          <>
            <label className="ms-step">
              <div className="ms-step-label"><span>01 · {c.name}</span></div>
              <input className="ms-input" value={query} autoComplete="off" placeholder={c.typeName} enterKeyHint="search" onChange={(event) => setQuery(event.target.value)} />
            </label>
            <div aria-live="polite">
            {query.trim().length >= 2 ? (
              matches.length ? (
                <ul className="ms-list ms-finder-results">
                  {matches.map((place) => (
                    <li key={place.slug}>
                      <a href={paths.restaurant(place.slug, locale)} className="ms-link">{place.name}</a>
                      {place.area ? <span className="ms-num"> · {place.area}</span> : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="ms-finder-summary"><span>{c.noMatch}</span></div>
              )
            ) : null}
            </div>
          </>
        ) : null}
      </div>
    </section>
  );
}
