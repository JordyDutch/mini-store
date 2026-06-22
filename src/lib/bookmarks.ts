import type { App } from "@/data/appCatalog";

export const BOOKMARKS_KEY_NAME = "UPStoreBookmarks";
export const BOOKMARKS_KEY =
  "0x8e9c4246bdd11afccc09c8dc120dd0897347a60d921dcebfd9c539519964e8b4";

export const BOOKMARKS_SCHEMA = [
  {
    name: "UPStoreBookmarks",
    key: BOOKMARKS_KEY,
    keyType: "Singleton",
    valueType: "bytes",
    valueContent: "VerifiableURI",
  },
] as const;

export type BookmarkType = "app" | "profile" | "link";

export interface Bookmark {
  id: string;
  type: BookmarkType;
  title: string;
  url: string;
  icon?: string;
  address?: string;
  appId?: string;
  addedAt: number;
}

export interface BookmarksEnvelope {
  UPStoreBookmarks: { version: 1; bookmarks: Bookmark[] };
}

/** True when the value is a 0x-prefixed 20-byte hex address. */
export function isAddress(value: string): value is `0x${string}` {
  return /^0x[0-9a-fA-F]{40}$/.test(value.trim());
}

/**
 * Normalize a user-supplied URL. Defensive: never throws.
 * - Trims whitespace.
 * - If there's no scheme and it isn't a 0x address, prepend https://.
 * - Lowercases the host (via the URL parser) while leaving the rest intact.
 */
export function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  const prepended =
    trimmed.includes("://") || isAddress(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    return new URL(prepended).toString();
  } catch {
    return trimmed;
  }
}

/** A valid 0x address is treated as a profile; everything else is a link. */
export function detectBookmarkType(input: string): "profile" | "link" {
  return isAddress(input.trim()) ? "profile" : "link";
}

/**
 * A favicon URL for a website link, derived from its host via Google's favicon
 * service (handles redirects/fallbacks and returns a clean square PNG). Returns
 * undefined when the URL has no resolvable host.
 */
export function faviconUrl(url: string): string | undefined {
  try {
    const host = new URL(normalizeUrl(url)).hostname;
    if (!host) return undefined;
    return `https://www.google.com/s2/favicons?domain=${host}&sz=64`;
  } catch {
    return undefined;
  }
}

export function appBookmarkId(appId: string): string {
  return `app:${appId}`;
}

export function profileBookmarkId(address: string): string {
  return `profile:${address.toLowerCase()}`;
}

export function linkBookmarkId(url: string): string {
  return `link:${normalizeUrl(url)}`;
}

export function buildAppBookmark(app: App): Bookmark {
  const appId = app.id ?? app.app.url;
  return {
    id: appBookmarkId(appId),
    type: "app",
    title: app.app.name,
    url: app.app.url,
    icon: app.icon,
    appId,
    addedAt: Date.now(),
  };
}

export function buildProfileBookmark(
  address: string,
  opts?: { title?: string; icon?: string }
): Bookmark {
  return {
    id: profileBookmarkId(address),
    type: "profile",
    title:
      opts?.title?.trim() || `${address.slice(0, 6)}…${address.slice(-4)}`,
    url: `https://universaleverything.io/${address}`,
    icon: opts?.icon,
    address: address.toLowerCase(),
    addedAt: Date.now(),
  };
}

export function buildLinkBookmark(
  url: string,
  opts?: { title?: string; icon?: string }
): Bookmark {
  const normalized = normalizeUrl(url);
  return {
    id: linkBookmarkId(normalized),
    type: "link",
    title: opts?.title?.trim() || normalized,
    url: normalized,
    // Import the site's favicon as the bookmark logo when no icon is supplied.
    icon: opts?.icon ?? faviconUrl(normalized),
    addedAt: Date.now(),
  };
}

/**
 * Defensively decode bookmarks JSON, mirroring how gridProvider reads
 * LSP28TheGrid: accept a bare array OR the wrapped envelope. Always returns an
 * array; never throws.
 */
export function parseBookmarksJson(data: unknown): Bookmark[] {
  if (Array.isArray(data)) {
    return data as Bookmark[];
  }
  if (data && typeof data === "object" && "UPStoreBookmarks" in data) {
    const inner = (data as { UPStoreBookmarks: unknown }).UPStoreBookmarks;
    if (Array.isArray(inner)) {
      return inner as Bookmark[];
    }
    if (inner && typeof inner === "object" && "bookmarks" in inner) {
      const bookmarks = (inner as { bookmarks: unknown }).bookmarks;
      if (Array.isArray(bookmarks)) {
        return bookmarks as Bookmark[];
      }
    }
  }
  return [];
}

export function buildBookmarksEnvelope(bookmarks: Bookmark[]): BookmarksEnvelope {
  return { UPStoreBookmarks: { version: 1, bookmarks } };
}
