import type { SayProof } from "./signature.ts";

// What the Say components display, whatever the storage behind it (Supabase, Postgres or Farcaster).

/** A Farcaster cast a post lives in: anyone can open it in any Farcaster client and reply there. */
export type SayCastRef = { fid: number; hash: string; username?: string | null };

/** How a post reached the page. */
export type SaySource =
  /** Stored in our database (SAY_BACKEND=supabase|postgres). */
  | { kind: "database" }
  /** Written on Farcaster by someone with their own account. */
  | { kind: "farcaster" }
  /** Written on mesasays.com and published by the MesaSays relay account. */
  | { kind: "relayed" }
  /** Copied from the old database by the migration script (date = original day, as text). */
  | { kind: "migrated"; date: string; signer: string | null; archive: string | null }
  /** Cast by the MesaSays account itself. */
  | { kind: "team" };

export type SayReply = {
  id: string;
  parentId: string | null;
  author: string;
  body: string;
  createdAt: string;
  proof: SayProof | null;
  source?: SaySource;
  cast?: SayCastRef;
};

export type SayThreadData = {
  id: string;
  title: string;
  body: string;
  author: string;
  createdAt: string;
  slugs: string[];
  replies: SayReply[];
  proof: SayProof | null;
  source?: SaySource;
  cast?: SayCastRef;
  /** The Farcaster topic (parentUrl) the conversation lives under. */
  topic?: string;
};

/** What the browser needs to know about the backend to show the right form. */
export type SayMode = {
  backend: "database" | "farcaster";
  /** Farcaster relay: "off" (read only), "dry-run" (messages built and checked, never sent) or "live". */
  relay: "off" | "dry-run" | "live";
  /** Unsigned posts accepted by the relay (database backends always accept them). */
  allowUnsigned: boolean;
  /** Longest post the relay can fit in one cast, in UTF-8 bytes (0 = no Farcaster limit). */
  maxBytes: number;
};

export const DATABASE_MODE: SayMode = { backend: "database", relay: "off", allowUnsigned: true, maxBytes: 0 };

/** Result of a post. In dry run, the message that would have been published comes back instead of an id. */
export type SayDryRun = { hash: string; fid: number; type: string; bytes: number; text: string; embeds: string[]; parent: string; json: unknown; hub: string };
export type SayResult = { ok: true; id: string; dryRun?: SayDryRun } | { ok: false; error: string };
