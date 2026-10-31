"use client";

import { useSyncExternalStore } from "react";

// The name people post under lives in their browser: no account, nothing else is remembered.
const KEY = "mesasays-say-name";
const EVENT = "mesasays-say-name";

function read() {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function subscribe(callback: () => void) {
  window.addEventListener(EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

export function useSayName() {
  const name = useSyncExternalStore(subscribe, read, () => null);
  return {
    name,
    setName(value: string) {
      try {
        window.localStorage.setItem(KEY, value);
      } catch {
        // Private mode: the name is simply asked again next time.
      }
      window.dispatchEvent(new Event(EVENT));
    },
  };
}

export function timeAgo(iso: string) {
  const minutes = Math.max(0, (Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${Math.round(minutes)}m`;
  if (minutes < 60 * 24) return `${Math.round(minutes / 60)}h`;
  return `${Math.round(minutes / 60 / 24)}d`;
}

/** Latest moment something was said in a conversation: lists show the liveliest first. */
export function lastActivity(thread: { createdAt: string; replies: Array<{ createdAt: string }> }) {
  return [thread.createdAt, ...thread.replies.map((reply) => reply.createdAt)].sort().at(-1) ?? thread.createdAt;
}
