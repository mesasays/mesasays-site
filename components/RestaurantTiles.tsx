import Link from "next/link";
import { paths, type Locale } from "@/lib/i18n";

// Restaurants as small boxed tiles: the whole box is the link to the record.
// Name, cuisine and cost per person only; everything else lives on the record.

export type RestaurantTile = {
  slug: string;
  name: string;
  cuisine: string | null;
  area: string | null;
  price: number | null;
  /** Optional extra line, e.g. the dish as printed on the menu. */
  note?: string | null;
  /** Replaces the default "≈ 280 MXN" price line, e.g. "from 69 MXN". */
  priceLabel?: string | null;
};

export function RestaurantTiles({
  tiles,
  locale,
  showArea = true,
}: {
  tiles: RestaurantTile[];
  locale: Locale;
  showArea?: boolean;
}) {
  return (
    <ul className="ms-tiles">
      {tiles.map((tile) => (
        <li key={tile.slug}>
          <Link href={paths.restaurant(tile.slug, locale) as never} className="ms-tile" prefetch={false}>
            <strong className="ms-tile-name">{tile.name}</strong>
            <span className="ms-tile-meta">
              {[tile.cuisine, showArea ? tile.area : null].filter(Boolean).join(" · ") || " "}
            </span>
            {tile.note ? <span className="ms-tile-note">{tile.note}</span> : null}
            <span className="ms-tile-price">
              {tile.priceLabel ?? (tile.price ? `≈ ${tile.price.toLocaleString("en-US")} MXN` : " ")}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
