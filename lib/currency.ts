import { fx } from "@/lib/fx";

// Rounded dollar and euro equivalents for peso prices, from a dated reference rate
// (scripts/update-fx.mjs). Equivalents are indicative; menus are priced in MXN.

export const FX_DATE = fx.date;
export const FX_SOURCE = fx.source;

export function toUsd(mxn: number) {
  return Math.round(mxn * fx.mxnTo.USD);
}

export function toEur(mxn: number) {
  return Math.round(mxn * fx.mxnTo.EUR);
}

/** Peso amount for a budget given in euros or dollars, rounded to 10. */
export function fromEur(eur: number) {
  return Math.round(eur / fx.mxnTo.EUR / 10) * 10;
}

export function foreignEquivalent(mxn: number) {
  return `≈ US$${toUsd(mxn)} · €${toEur(mxn)}`;
}
