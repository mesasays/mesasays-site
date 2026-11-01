import { FX_DATE, toEur, toUsd } from "@/lib/currency";
import { listAllRestaurantRecords } from "@/lib/data";
import { hoursSummary } from "@/lib/geo/hours";
import { instagramHref } from "@/lib/restaurants/format";
import { priceArea } from "@/lib/restaurants/price-index";
import { restaurantBooking, restaurantMealCost } from "@/lib/restaurants/quick-facts";
import { dataLicense } from "@/lib/data/license";
import { CHANNEL_URL, PUBLISHER_NAME, SITE_NAME, absoluteUrl } from "@/lib/site";

// Data export of the catalog: the facts behind every page, one row per restaurant. License: see lib/data/license.ts.
export const dynamic = "force-static";

export async function GET() {
  const restaurants = await listAllRestaurantRecords();
  const rows = restaurants.map((restaurant) => {
    const meal = restaurantMealCost(restaurant);
    const booking = restaurantBooking(restaurant);
    return {
      slug: restaurant.slug,
      name: restaurant.name,
      url: absoluteUrl(`/restaurants/${restaurant.slug}`),
      factSheet: absoluteUrl(`/facts/${restaurant.slug}.txt`),
      area: priceArea(restaurant),
      neighborhood: restaurant.location.neighborhood,
      address: restaurant.location.address,
      latitude: restaurant.location.coordinates?.latitude ?? null,
      longitude: restaurant.location.coordinates?.longitude ?? null,
      cuisine: restaurant.food.cuisine,
      costPerPersonMxn: meal?.estimate ?? null,
      costPerPersonRangeMxn: meal ? [meal.low, meal.high] : null,
      costPerPersonUsd: meal ? toUsd(meal.estimate) : null,
      costPerPersonEur: meal ? toEur(meal.estimate) : null,
      costMethod: meal?.method ?? null,
      menuCheckedAt: restaurant.menu.publication?.checkedAt ?? null,
      menuRecheckAfter: restaurant.menu.publication?.recheckAfter ?? null,
      booking: booking ? { channel: booking.walkIn ? "walk-in" : booking.label, url: booking.url, phone: booking.phone, checkedAt: booking.checkedAt } : null,
      hours: restaurant.experience.hours.length ? hoursSummary(restaurant.experience.hours) : null,
      website: restaurant.contact.website,
      instagram: instagramHref(restaurant.contact.instagram),
      phone: restaurant.contact.phone,
      lastObserved: restaurant.verification.freshestSourceAt,
    };
  });
  const body = {
    name: `${SITE_NAME} — Mexico City restaurants`,
    publisher: { name: PUBLISHER_NAME, url: CHANNEL_URL, site: absoluteUrl("/") },
    license: dataLicense.license,
    licenseNote: dataLicense.label,
    openDataset: dataLicense.reuse,
    attribution: `${SITE_NAME} (${absoluteUrl("/")})`,
    methodology: absoluteUrl("/methodology"),
    currency: { base: "MXN", fxDate: FX_DATE, note: "USD and EUR equivalents are rounded, from the European Central Bank reference rate." },
    generatedAt: new Date().toISOString().slice(0, 10),
    count: rows.length,
    restaurants: rows,
  };
  return new Response(JSON.stringify(body, null, 1), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
