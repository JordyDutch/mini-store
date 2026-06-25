/**
 * Canonical, absolute site origin (no trailing slash). Used for metadata,
 * sitemap, robots, structured data and the agent-facing endpoints so every
 * absolute URL the store emits is consistent.
 */
export const siteUrl = (
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.NODE_ENV === "development"
    ? "http://localhost:3000"
    : "https://apps.lukso.tools")
).replace(/\/$/, "");

/** Build an absolute URL on this site from a path or relative asset. */
export const absoluteUrl = (path: string): string =>
  path.startsWith("http") ? path : `${siteUrl}${path.startsWith("/") ? "" : "/"}${path}`;
