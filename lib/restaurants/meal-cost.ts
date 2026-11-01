// Estimated cost of one meal for one person, from a restaurant's official menu.
// Pure module (type imports only) so scripts can run it on raw menu files.
//
// Method, in order of preference:
//   starter_main  median starter + median main course
//   main          median main course (no usable starter section)
//   tacos         3 × median taco (taquerías)
//   breakfast     median breakfast plate (cafés and breakfast places)
//   tasting       cheapest tasting / set menu (restaurants without à la carte mains)
// Nothing is estimated from unlabelled dishes: no section, no estimate.
// Drinks, desserts, sides and tip are always excluded.

export type MealCostMethod = "starter_main" | "main" | "tacos" | "breakfast" | "tasting";

export type MealCost = {
  /** Point estimate in MXN, rounded to 10. */
  estimate: number;
  /** Typical range (lower and upper quartile of the sections used), rounded to 10. */
  low: number;
  high: number;
  method: MealCostMethod;
  /** Priced dishes the estimate rests on. */
  basis: number;
};

export type MealCostItem = { price: number | null; category: string | null; name?: string };

type Course = "starter" | "share" | "main" | "taco" | "breakfast" | "skip";

const normalize = (value: string) =>
  value.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();

const EXCLUDE =
  /postre|dessert|dolci|dulce|pan dulce|panader|pastel|helado|nieve|gelato|guarnici|complement|extra|acompa|\bsides?\b|salsa|aderezo|topping|adicional|kids|ninos|infantil|reposter|galleta|cookie|bebida|drink|vino|wine|cerveza|beer|coctel|cocktail|mezcal|tequila|licor|cafe\b|coffee|\bte\b|\btea\b|jugo|juice|refresco|agua|smoothie|malteada|sake|pan\b|bread|para llevar|merch|tienda/;
const BREAKFAST = /desayun|breakfast|brunch|huevo|\beggs?\b|chilaquil|hot ?cake|pancake|waffle|mollete|almuerzo|chilaquiles/;
const TACO = /\btacos?\b|taqueria|volcan|costra|tripas/;
// Sharing platters stand in for a starter only when there is no starter section, split between two.
const SHARE = /para compartir|to share|sharing|compartir/;
const STARTER =
  /entrad|entrant|para (empezar|picar|botanear)|botana|antipast|ensalad|insalat|sopa|caldo|crema|consom|zupp|carpacc|raw bar|barra fri|crudo|aguachile|tostad|ceviche|entreme|snack|tapa|pintxo|fundido|empanad|small plate|starter|appetizer|salad|soup|to share|primer|aperitiv|dim sum|gyoza|tempura|\bbao|antojit|quesadilla|sope|tlacoyo|ostion|oyster|^picar$|crepas? salad|tartas? salad/;
const MAIN =
  /fuerte|principal|especialidad|especial|carne|del mar|pescado|marisco|\baves?\b|pollo|pasta|pizza|ramen|udon|soba|parrilla|corte|arroz|risott|hamburgues|burger|donburi|fideo|platillo|de la casa|de la tierra|tradicional|enchilad|cazuel|alambre|\bmoles?\b|\bmains?\b|entree|segundo|secondi|plato|torta|gringa|sandwich|baguette|huarache|bowl|curry|\bwok\b|noodle|steak|grill|asado|robata|sushi|maki|nigiri|rollo|\broll|brocheta|shawarma|kebab|emparedad|tandoor|non veg|biryani|^comer$|josper|tatemad|brasa|al carbon|horno/;

export function courseOf(category: string | null | undefined): Course {
  if (!category) return "skip";
  const text = normalize(category);
  if (EXCLUDE.test(text)) return "skip";
  if (BREAKFAST.test(text)) return "breakfast";
  if (TACO.test(text)) return "taco";
  if (SHARE.test(text)) return "share";
  if (STARTER.test(text)) return "starter";
  if (MAIN.test(text)) return "main";
  return "skip";
}

function quantile(sorted: number[], q: number) {
  const position = (sorted.length - 1) * q;
  const base = Math.floor(position);
  const next = sorted[base + 1] ?? sorted[base];
  return sorted[base] + (position - base) * (next - sorted[base]);
}

const round10 = (value: number) => Math.round(value / 10) * 10;
const MIN_MAINS = 3;
const MIN_STARTERS = 2;
const MIN_TACOS = 3;
const MIN_BREAKFAST = 3;

/**
 * @param items  food items from a live official menu (drinks already removed by the caller)
 * @param tastingMenus  set menus published with the menu (wine pairings are ignored)
 */
export function estimateMealCost(
  items: MealCostItem[],
  tastingMenus: Array<{ name: string; price: number }> = [],
): MealCost | null {
  const buckets: Record<Course, number[]> = { starter: [], share: [], main: [], taco: [], breakfast: [], skip: [] };
  for (const item of items) {
    if (item.price === null || !(item.price >= 15)) continue;
    buckets[courseOf(item.category)].push(item.price);
  }
  for (const list of Object.values(buckets)) list.sort((a, b) => a - b);
  const { breakfast } = buckets;
  const starter = buckets.starter.length >= MIN_STARTERS ? buckets.starter : buckets.share.map((price) => price / 2);
  // Tacos above street price (seafood or wagyu tacos) are a main course, not a taquería order.
  const streetTacos = buckets.taco.length > 0 && quantile(buckets.taco, 0.5) <= 100;
  const taco = streetTacos ? buckets.taco : [];
  const main = streetTacos ? buckets.main : [...buckets.main, ...buckets.taco].sort((x, y) => x - y);
  const stats = (list: number[]) => ({ mid: quantile(list, 0.5), low: quantile(list, 0.25), high: quantile(list, 0.75) });

  // A taquería with a few "especiales" is still a taquería.
  const tacoPlace =
    taco.length >= MIN_TACOS &&
    (main.length < MIN_MAINS || (taco.length >= 2 * main.length && starter.length < taco.length));
  if (main.length >= MIN_MAINS && !tacoPlace) {
    const m = stats(main);
    if (starter.length >= MIN_STARTERS) {
      const s = stats(starter);
      return { estimate: round10(m.mid + s.mid), low: round10(m.low + s.low), high: round10(m.high + s.high), method: "starter_main", basis: main.length + starter.length };
    }
    return { estimate: round10(m.mid), low: round10(m.low), high: round10(m.high), method: "main", basis: main.length };
  }
  if (taco.length >= MIN_TACOS) {
    const t = stats(taco);
    return { estimate: round10(3 * t.mid), low: round10(3 * t.low), high: round10(3 * t.high), method: "tacos", basis: taco.length };
  }
  if (breakfast.length >= MIN_BREAKFAST) {
    const b = stats(breakfast);
    return { estimate: round10(b.mid), low: round10(b.low), high: round10(b.high), method: "breakfast", basis: breakfast.length };
  }
  const menus = tastingMenus
    .filter((menu) => menu.price >= 100 && !/maridaje|pairing|vino|wine|bebida/i.test(menu.name))
    .map((menu) => menu.price)
    .sort((a, b) => a - b);
  if (menus.length) {
    return { estimate: round10(menus[0]), low: round10(menus[0]), high: round10(menus.at(-1)!), method: "tasting", basis: menus.length };
  }
  return null;
}

/** Budget bands used by the /budget pages (per person, MXN). */
export const BUDGETS = [300, 500, 800, 1500] as const;
export type Budget = (typeof BUDGETS)[number];

/**
 * $ to $$$$ from our own cost per person (never from Google or another third party):
 * $ up to 300 MXN, $$ 301–800, $$$ 801–1,500, $$$$ over 1,500. Same thresholds as the budget pages.
 * No estimate, no symbol.
 */
export const PRICE_SYMBOL_BANDS = [300, 800, 1500] as const;

export function priceSymbol(meal: MealCost | null | undefined) {
  if (!meal) return null;
  const level = PRICE_SYMBOL_BANDS.filter((max) => meal.estimate > max).length + 1;
  return "$".repeat(level);
}
