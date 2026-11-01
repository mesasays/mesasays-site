"use client";

import { useEffect, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { fx } from "@/lib/fx";

// Display-only currency switch: CurrencyEffect (mounted once in the header) converts the page,
// CurrencyToggle (in the home finder) lets the visitor choose. The server HTML always carries pesos (what search engines,
// AI crawlers and the JSON-LD read); in USD mode the browser rewrites visible "N MXN" text
// with the dated ECB rate and puts the pesos back when switched off.

export type Currency = "MXN" | "USD";
const STORAGE_KEY = "mesasays-currency";
const RATE = fx.mxnTo.USD;
const AMOUNT = String.raw`\d{1,3}(?:,\d{3})+|\d+`;
const PESOS = new RegExp(String.raw`(${AMOUNT})(?:\s?([–-])\s?(${AMOUNT}))?\s?MXN`, "g");
// "≈ US$23 · €21" equivalents would repeat the converted figure.
const EQUIVALENT = /\s*\(?≈\s?US\$\d+\s?·\s?€\d+\)?/g;
const SKIP = new Set(["SCRIPT", "STYLE", "TEXTAREA", "INPUT", "CODE"]);

const originals = new WeakMap<Text, string>();

export function usd(amount: string) {
  const value = Number(amount.replace(/,/g, "")) * RATE;
  return value < 10 ? value.toFixed(1).replace(/\.0$/, "") : Math.round(value).toLocaleString("en-US");
}

function toDollars(text: string) {
  return text
    .replace(EQUIVALENT, "")
    .replace(PESOS, (_, low: string, dash?: string, high?: string) => (high ? `US$${usd(low)}${dash}${usd(high)}` : `US$${usd(low)}`));
}

function textNodes(root: Node) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) =>
      node.parentElement && !SKIP.has(node.parentElement.tagName) && !node.parentElement.closest("[data-no-fx]")
        ? NodeFilter.FILTER_ACCEPT
        : NodeFilter.FILTER_REJECT,
  });
  const nodes: Text[] = [];
  while (walker.nextNode()) nodes.push(walker.currentNode as Text);
  return nodes;
}

function apply(currency: Currency, root: Node = document.body) {
  for (const node of textNodes(root)) {
    // React may have re-rendered the node since we converted it: then its current text is the source.
    const known = originals.get(node);
    const stored = known !== undefined && node.data === toDollars(known) ? known : undefined;
    if (currency === "USD") {
      const source = stored ?? node.data;
      if (!source.includes("MXN") && !source.includes("€")) continue;
      const next = toDollars(source);
      if (next === source) continue;
      originals.set(node, source);
      if (node.data !== next) node.data = next;
    } else if (known !== undefined) {
      if (stored !== undefined) node.data = stored;
      originals.delete(node);
    }
  }
}

// The choice lives in localStorage (per visitor); `memory` covers browsers that block it.
const CHANGE = "mesasays-currency-change";
let memory: Currency | null = null;

function readCurrency(): Currency {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "USD" ? "USD" : "MXN";
  } catch {
    return memory ?? "MXN";
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function useCurrency() {
  return useSyncExternalStore(subscribe, readCurrency, () => "MXN" as Currency);
}

export function setCurrency(next: Currency) {
  memory = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // Not persisted; the choice still holds until the tab closes.
  }
  window.dispatchEvent(new Event(CHANGE));
}

/** Converts every page to the chosen currency; renders nothing. */
export function CurrencyEffect() {
  const pathname = usePathname();
  const currency = useCurrency();

  // Re-apply after every navigation and whenever new content appears (filters, Say threads).
  useEffect(() => {
    document.documentElement.dataset.currency = currency;
    apply(currency);
    if (currency !== "USD") return;
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "characterData") apply(currency, mutation.target.parentNode ?? mutation.target);
        mutation.addedNodes.forEach((node) => apply(currency, node));
      }
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [currency, pathname]);

  return null;
}

/** Two-segment MXN | USD control, styled like the finder's own segments. */
export function CurrencyToggle({ es }: { es: boolean }) {
  const currency = useCurrency();
  const note = es
    ? `Dólares aproximados, tipo de cambio BCE del ${fx.date}. Las cartas se cobran en pesos.`
    : `Approximate dollars, ECB rate of ${fx.date}. Menus are charged in pesos.`;
  return (
    <span className="ms-currency" role="group" aria-label={es ? "Moneda" : "Currency"} title={note} data-no-fx>
      {(["MXN", "USD"] as const).map((code) => (
        <button key={code} type="button" aria-pressed={code === currency} onClick={() => setCurrency(code)}>
          {code}
        </button>
      ))}
    </span>
  );
}
