// Anti-spam for the relay, without a database: everything lives in the server's memory.
//
// - A post must carry a valid signature (passkey or wallet) unless SAY_RELAY_ALLOW_UNSIGNED=1.
//   A signature costs a bot nothing, but it gives each author a stable key we can count.
// - Per signer: 5 posts per 10 minutes, 20 per day. Per IP: 10 per 10 minutes (3 if unsigned).
// - Everyone together: SAY_RELAY_MAX_PER_HOUR (default 30), because every cast uses the MesaSays
//   account's storage (100 casts per storage unit; past that, the oldest are dropped by the hubs).
// - The same signed note can be relayed once (a signature is only accepted within 10 minutes of being
//   made, and remembered here for 15).
// - The honeypot field (app/say/actions.ts) still turns away naive bots.
//
// Limits are per server instance: on Vercel several instances may run at once, so these are soft limits.
// The hard ceiling is the account's storage. No "@/" imports: tested in scripts/test-say-farcaster.mjs.

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

export type LimitRule = { key: string; max: number; windowMs: number };

export function createLimiter() {
  const hits = new Map<string, number[]>();
  const seen = new Map<string, number>();

  function prune(now: number) {
    if (hits.size < 5000 && seen.size < 5000) return;
    for (const [key, times] of hits) if (!times.some((time) => now - time < DAY)) hits.delete(key);
    for (const [key, until] of seen) if (until < now) seen.delete(key);
  }

  return {
    /** null if allowed (and counted), else the rule that refused. Nothing is counted when refused. */
    take(rules: LimitRule[], now = Date.now()): LimitRule | null {
      prune(now);
      for (const rule of rules) {
        const recent = (hits.get(rule.key) ?? []).filter((time) => now - time < rule.windowMs);
        if (recent.length >= rule.max) return rule;
      }
      for (const rule of rules) hits.set(rule.key, [...(hits.get(rule.key) ?? []).filter((time) => now - time < DAY), now]);
      return null;
    },
    /** false if this id (a note digest) was already used in the last 15 minutes. */
    once(id: string, now = Date.now()) {
      prune(now);
      const until = seen.get(id);
      if (until && until > now) return false;
      seen.set(id, now + 15 * MINUTE);
      return true;
    },
  };
}

// Audit 2026-11-01: signatures are free, so per-signer limits alone stop nothing; the per-IP limits must sit
// well below the global one so one person cannot use up everyone's quota. Counters live in each server
// instance's memory (no shared store on purpose: no extra US service), so the real ceiling is these numbers
// times the running instances; the account-wide daily cap bounds the damage either way.
export function relayRules(input: { signer: string | null; ip: string; maxPerHour: number }): LimitRule[] {
  const rules: LimitRule[] = [
    { key: "all", max: input.maxPerHour, windowMs: 60 * MINUTE },
    { key: "all-day", max: input.maxPerHour * 6, windowMs: DAY },
  ];
  if (input.signer) {
    rules.push({ key: `signer:${input.signer.toLowerCase()}`, max: 5, windowMs: 10 * MINUTE });
    rules.push({ key: `signer-day:${input.signer.toLowerCase()}`, max: 20, windowMs: DAY });
    rules.push({ key: `ip:${input.ip}`, max: 4, windowMs: 10 * MINUTE });
    rules.push({ key: `ip-hour:${input.ip}`, max: Math.max(1, Math.floor(input.maxPerHour / 4)), windowMs: 60 * MINUTE });
  } else {
    rules.push({ key: `ip-unsigned:${input.ip}`, max: 3, windowMs: 10 * MINUTE });
  }
  return rules;
}
