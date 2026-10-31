import { priceArea } from "@/lib/restaurants/price-index";
import { hasLiveVerifiedMenu, isDrinkCategory } from "@/lib/restaurants/stats";
import type { SiteRestaurant } from "@/lib/restaurants/types";

// Dish finder: which restaurants serve a given dish, at what printed price, checked when.
// Matching is plain keyword rules on dish names from reviewed official menus — no guessing.

export type DishDefinition = {
  slug: string;
  name: string;
  nameEs: string;
  match: RegExp;
  exclude?: RegExp;
  /** Looser name pattern accepted only when the menu category confirms the dish (e.g. "Margarita" under "Pizzas"). */
  matchInCategory?: { name: RegExp; category: RegExp };
};

export const DISHES: DishDefinition[] = [
  { slug: "tacos-al-pastor", name: "Tacos al pastor", nameEs: "Tacos al pastor", match: /\bpastor\b/i, exclude: /pastora|pastoral|torta|gringa|chilaquil|pescado|marl[ií]n|pizza|volc[aá]n|sope|huarache|chicharr|costra|flauta|dorados|vampiro|pan [aá]rabe|envuelto|alambre|cr[aá]ter|quesadilla|burrito|pollo al pastor|pastor pollo|bowl|nachos|papa/i },
  { slug: "suadero", name: "Suadero tacos", nameEs: "Tacos de suadero", match: /suadero/i },
  { slug: "birria", name: "Birria", nameEs: "Birria", match: /birria/i },
  { slug: "barbacoa", name: "Barbacoa", nameEs: "Barbacoa", match: /barbacoa/i },
  { slug: "cochinita-pibil", name: "Cochinita pibil", nameEs: "Cochinita pibil", match: /cochinita/i },
  { slug: "carnitas", name: "Carnitas", nameEs: "Carnitas", match: /carnitas/i },
  { slug: "mole", name: "Mole", nameEs: "Mole", match: /\bmole\b|\bmoles\b|mole poblano|mole negro|mole rojo|mole verde/i, exclude: /guacamole|molcajete|mole de olla/i },
  { slug: "chiles-en-nogada", name: "Chiles en nogada", nameEs: "Chiles en nogada", match: /nogada/i },
  { slug: "chiles-rellenos", name: "Chiles rellenos", nameEs: "Chile relleno", match: /chiles? rellenos?/i },
  { slug: "enchiladas", name: "Enchiladas", nameEs: "Enchiladas", match: /enchilad/i },
  { slug: "enmoladas", name: "Enmoladas", nameEs: "Enmoladas", match: /enmolad/i },
  { slug: "chilaquiles", name: "Chilaquiles", nameEs: "Chilaquiles", match: /chilaquil/i },
  { slug: "pozole", name: "Pozole", nameEs: "Pozole", match: /pozole|pozolito/i },
  { slug: "tamales", name: "Tamales", nameEs: "Tamales", match: /\btamal(es)?\b/i },
  { slug: "tlayuda", name: "Tlayuda", nameEs: "Tlayuda", match: /tlayuda/i },
  { slug: "quesadillas", name: "Quesadillas", nameEs: "Quesadillas", match: /quesadilla/i },
  { slug: "sopes-and-huaraches", name: "Sopes and huaraches", nameEs: "Sopes y huaraches", match: /\bsopes?\b|huarache/i },
  { slug: "guacamole", name: "Guacamole", nameEs: "Guacamole", match: /guacamole/i },
  { slug: "sopa-de-tortilla", name: "Tortilla soup", nameEs: "Sopa de tortilla", match: /sopa (de )?tortilla|sopa azteca|tortilla soup/i },
  { slug: "esquites-and-elote", name: "Esquites and elote", nameEs: "Esquites y elote", match: /esquite|\belotes?\b/i, exclude: /pan de elote|pastel|panqu[eé]|\bpay\b|flan|tamal|crema|empanada|tres leches|torta de elote|helado|galleta|costillas|ribs|yakitori|tempura/i },
  { slug: "ceviche", name: "Ceviche", nameEs: "Ceviche", match: /ceviche|cebiche/i },
  { slug: "aguachile", name: "Aguachile", nameEs: "Aguachile", match: /aguachile/i },
  { slug: "tostada-de-atun", name: "Tuna tostada", nameEs: "Tostada de atún", match: /tostada.*at[uú]n|at[uú]n.*tostada|tuna tostada/i },
  { slug: "pescado-a-la-talla", name: "Pescado a la talla", nameEs: "Pescado a la talla", match: /a la talla/i },
  { slug: "pulpo", name: "Octopus", nameEs: "Pulpo", match: /\bpulpo\b|octopus/i },
  { slug: "camarones", name: "Shrimp dishes", nameEs: "Camarones", match: /camar[oó]n|camarones|shrimp|gambas?/i },
  { slug: "arrachera", name: "Arrachera (skirt steak)", nameEs: "Arrachera", match: /arrachera/i },
  { slug: "rib-eye", name: "Rib eye", nameEs: "Rib eye", match: /rib ?eye|ribeye/i },
  { slug: "hamburguesa", name: "Burger", nameEs: "Hamburguesa", match: /hamburguesa|burger/i },
  { slug: "pizza-margherita", name: "Pizza margherita", nameEs: "Pizza margarita", match: /margherita|pizza.*margarita|margarita.*pizza/i, exclude: /coctel|cocktail|frozen|mezcalita|callo|galleta|pastel|machaca|aguachile|pita/i, matchInCategory: { name: /^\s*margarita\s*$/i, category: /pizza/i } },
  { slug: "carbonara", name: "Spaghetti carbonara", nameEs: "Carbonara", match: /carbonara/i },
  { slug: "ramen", name: "Ramen", nameEs: "Ramen", match: /\bramen\b/i },
  { slug: "nigiri", name: "Nigiri", nameEs: "Nigiri", match: /nigiri/i },
  { slug: "croissant", name: "Croissant", nameEs: "Croissant", match: /croissant|cuernito/i, exclude: /promo|jugo y caf/i },
  { slug: "churros", name: "Churros", nameEs: "Churros", match: /churro/i },
  { slug: "flan", name: "Flan", nameEs: "Flan", match: /\bflan\b/i },
  { slug: "pan-de-elote", name: "Corn bread (pan de elote)", nameEs: "Pan de elote", match: /pan de elote/i },
  { slug: "huevos-rancheros", name: "Huevos rancheros", nameEs: "Huevos rancheros", match: /rancheros/i, exclude: /bowl|bocadillo/i },
];

export type DishOffer = {
  restaurantSlug: string;
  restaurantName: string;
  area: string | null;
  itemName: string;
  price: number | null;
  checkedAt: string | null;
  sourceUrl: string | null;
};

export type DishSummary = DishDefinition & {
  offers: DishOffer[];
  restaurants: number;
  /** Median, across restaurants, of each restaurant's cheapest priced version. */
  medianPrice: number | null;
  minPrice: number | null;
  minOffer: DishOffer | null;
};

function median(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

export function dishOffers(dish: DishDefinition, restaurants: SiteRestaurant[], now = new Date()): DishOffer[] {
  const offers: DishOffer[] = [];
  for (const restaurant of restaurants) {
    if (!hasLiveVerifiedMenu(restaurant, now)) continue;
    const seen = new Set<string>();
    for (const item of restaurant.menu.items) {
      if (isDrinkCategory(item.category)) continue;
      const text = item.name;
      const strict = dish.match.test(text);
      const byCategory = Boolean(dish.matchInCategory?.name.test(text) && dish.matchInCategory.category.test(item.category ?? ""));
      if ((!strict && !byCategory) || dish.exclude?.test(text)) continue;
      const key = `${text.toLowerCase()}|${item.price ?? ""}`;
      if (seen.has(key)) continue;
      seen.add(key);
      offers.push({
        restaurantSlug: restaurant.slug,
        restaurantName: restaurant.name,
        area: priceArea(restaurant),
        itemName: text,
        price: item.price,
        checkedAt: item.observedAt ?? restaurant.menu.publication?.checkedAt ?? null,
        sourceUrl: item.sourceUrl,
      });
    }
  }
  return offers.sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity) || a.restaurantName.localeCompare(b.restaurantName));
}

export function summarizeDishes(restaurants: SiteRestaurant[], now = new Date()): DishSummary[] {
  return DISHES.map((dish) => {
    const offers = dishOffers(dish, restaurants, now);
    // Median of each restaurant's cheapest priced version, so long menus do not dominate.
    const cheapestByRestaurant = new Map<string, number>();
    for (const offer of offers) {
      if (offer.price === null) continue;
      const current = cheapestByRestaurant.get(offer.restaurantSlug);
      if (current === undefined || offer.price < current) cheapestByRestaurant.set(offer.restaurantSlug, offer.price);
    }
    const prices = [...cheapestByRestaurant.values()];
    return {
      ...dish,
      offers,
      restaurants: new Set(offers.map((offer) => offer.restaurantSlug)).size,
      medianPrice: median(prices),
      minPrice: prices.length ? Math.min(...prices) : null,
      minOffer: offers.find((offer) => offer.price !== null) ?? null,
    };
  });
}

/** Dishes shown publicly: at least two restaurants, so a page is a comparison, not an ad. */
export const MIN_RESTAURANTS_PER_DISH = 2;
