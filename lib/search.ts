// Forgiving text search for the site's search boxes: accents, case and word order do not matter.
// "bota" finds "Botánico", "pizza roma" finds a pizzeria in Roma Norte.

export function fold(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9ñ]+/g, " ")
    .trim();
}

/** True when every word of the query appears somewhere in the given fields. */
export function matchesQuery(query: string, ...fields: Array<string | null | undefined>) {
  const words = fold(query).split(" ").filter(Boolean);
  if (!words.length) return true;
  const haystack = ` ${fields.map(fold).join(" ")} `;
  return words.every((word) => haystack.includes(word));
}
