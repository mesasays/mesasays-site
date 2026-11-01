"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { RestaurantTiles, type RestaurantTile } from "@/components/RestaurantTiles";
import type { Locale } from "@/lib/i18n";
import { matchesQuery } from "@/lib/search";

// Catalog: one search field over name, cuisine and neighborhood, results as tiles.
export function RestaurantIndex({ tiles, locale = "en" }: { tiles: RestaurantTile[]; locale?: Locale }) {
  const [query, setQuery] = useState("");
  // Typing stays responsive: the 500+ tiles re-render on the deferred value.
  const deferred = useDeferredValue(query);
  const filtered = useMemo(() => {
    if (!deferred.trim()) return tiles;
    return tiles.filter((tile) => matchesQuery(deferred, tile.name, tile.cuisine, tile.area));
  }, [deferred, tiles]);

  return (
    <>
      <label className="ms-field-row ms-search">
        <span className="ms-label">{locale === "es" ? "Buscar" : "Search"}</span>
        <input className="ms-input" value={query} autoComplete="off" onChange={(event) => setQuery(event.target.value)} />
      </label>
      <p className="ms-sr-only" aria-live="polite">
        {deferred.trim() ? `${filtered.length} ${locale === "es" ? "restaurantes" : "restaurants"}` : ""}
      </p>
      {filtered.length === 0 ? <p className="ms-empty">—</p> : <RestaurantTiles tiles={filtered} locale={locale} />}
    </>
  );
}
