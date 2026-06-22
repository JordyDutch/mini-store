"use client";

import Link from "next/link";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  AppWindow,
  Bookmark as BookmarkIcon,
  Compass,
  LayoutGrid,
  Link as LinkIcon,
  List,
  Plus,
  Search,
  User,
  X,
} from "lucide-react";

import AddBookmarkDialog from "@/components/AddBookmarkDialog";
import Footer from "@/components/Footer";
import { ThemeToggle } from "@/components/ThemeToggle";
import UpConnect from "@/components/UpConnect";
import { Wordmark } from "@/components/Wordmark";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useBookmarks } from "@/app/components/providers/bookmarksProvider";
import { useUpProvider } from "@/app/components/providers/upProvider";
import { type Bookmark, faviconUrl } from "@/lib/bookmarks";
import { cn } from "@/lib/utils";

type BookmarkView = "list" | "grid";

const VIEW_STORAGE_KEY = "upstore:bookmarks-view";

export default function BookmarksExperience() {
  const { bookmarks, isLoading, error, removeBookmark } = useBookmarks();
  const { walletConnected, connect, hasExtension, isMiniApp } = useUpProvider();
  const reduceMotion = useReducedMotion();
  const [dialogOpen, setDialogOpen] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const deferredSearch = useDeferredValue(searchTerm);
  const query = deferredSearch.trim().toLowerCase();

  const [view, setView] = useState<BookmarkView>("list");
  // Restore the saved view after mount — localStorage is client-only, so reading
  // it in the initializer would desync SSR / the first client render.
  useEffect(() => {
    const saved = window.localStorage.getItem(VIEW_STORAGE_KEY);
    if (saved === "grid" || saved === "list") setView(saved);
  }, []);
  const changeView = (next: BookmarkView) => {
    setView(next);
    try {
      window.localStorage.setItem(VIEW_STORAGE_KEY, next);
    } catch {
      /* ignore storage failures (private mode / quota) */
    }
  };

  // Filter by title, URL, or (for profiles) address — case-insensitive.
  const filtered = useMemo(() => {
    if (!query) return bookmarks;
    return bookmarks.filter(
      (b) =>
        b.title.toLowerCase().includes(query) ||
        b.url.toLowerCase().includes(query) ||
        (b.address?.toLowerCase().includes(query) ?? false)
    );
  }, [bookmarks, query]);

  const apps = filtered.filter((b) => b.type === "app");
  const profiles = filtered.filter((b) => b.type === "profile");
  const links = filtered.filter((b) => b.type === "link");

  const hasBookmarks = bookmarks.length > 0;
  const noMatches = hasBookmarks && filtered.length === 0;

  return (
    <div className="flex min-h-[100dvh] flex-col bg-background">
      <BookmarksNavbar />

      <div className="mx-auto w-full max-w-[1200px] flex-1 px-4 py-8 md:px-6 md:py-12">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
              Bookmarks
            </h1>
            <p className="mt-1 text-sm text-text-secondary">
              Saved apps, profiles, and links — stored on your Universal Profile.
            </p>
          </div>
          {walletConnected && (
            <Button
              onClick={() => setDialogOpen(true)}
              variant="gradient"
              size="pill"
              className="shrink-0"
            >
              <Plus className="h-4 w-4" />
              Add bookmark
            </Button>
          )}
        </div>

        {/* Search + view toggle — only meaningful once there are bookmarks. */}
        {walletConnected && !isLoading && !error && hasBookmarks && (
          <div className="mb-6 flex items-center gap-2 sm:gap-3">
            <div className="relative min-w-0 flex-1">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary"
              />
              <input
                type="search"
                inputMode="search"
                placeholder="Search bookmarks"
                autoComplete="off"
                aria-label="Search bookmarks"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="h-11 w-full rounded-full border border-border-strong bg-card pl-10 pr-11 text-[16px] text-foreground shadow-rest outline-none placeholder:text-text-tertiary focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:text-[15px]"
              />
              {searchTerm ? (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => setSearchTerm("")}
                  className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-text-secondary transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              ) : null}
            </div>

            <ViewToggle view={view} onChange={changeView} />
          </div>
        )}

        {/* Not connected */}
        {!walletConnected && (
          <div className="glass flex flex-col items-center gap-4 rounded-xl px-6 py-16 text-center">
            <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-gradient-cta text-white shadow-cta ring-1 ring-inset ring-white/15">
              <BookmarkIcon className="h-7 w-7" />
            </span>
            <p className="max-w-[40ch] text-sm text-text-secondary">
              Connect your Universal Profile to see your bookmarks.
            </p>
            {!isMiniApp && hasExtension ? (
              <Button onClick={() => void connect()} variant="gradient" size="pill">
                Connect
              </Button>
            ) : (
              <UpConnect />
            )}
          </div>
        )}

        {/* Loading */}
        {walletConnected && isLoading && (
          <div
            className="flex justify-center py-20"
            role="status"
            aria-live="polite"
          >
            <span className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-brand" />
            <span className="sr-only">Loading bookmarks</span>
          </div>
        )}

        {/* Error */}
        {walletConnected && !isLoading && error && (
          <div className="glass rounded-xl px-6 py-16 text-center">
            <p className="text-sm text-text-secondary">{error}</p>
          </div>
        )}

        {/* Empty */}
        {walletConnected && !isLoading && !error && !hasBookmarks && (
          <div className="glass flex flex-col items-center gap-4 rounded-xl px-6 py-16 text-center">
            <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-text-secondary">
              <BookmarkIcon className="h-7 w-7" />
            </span>
            <p className="text-sm text-text-secondary">No bookmarks yet.</p>
            <Button
              onClick={() => setDialogOpen(true)}
              variant="gradient"
              size="pill"
            >
              <Plus className="h-4 w-4" />
              Add bookmark
            </Button>
          </div>
        )}

        {/* No search matches */}
        {walletConnected && !isLoading && !error && noMatches && (
          <div className="glass flex flex-col items-center gap-4 rounded-xl px-6 py-16 text-center">
            <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-text-secondary">
              <Search className="h-7 w-7" />
            </span>
            <p className="max-w-[40ch] text-sm text-text-secondary">
              No bookmarks match “{searchTerm.trim()}”.
            </p>
            <Button onClick={() => setSearchTerm("")} variant="outline" size="pill">
              Clear search
            </Button>
          </div>
        )}

        {/* Loaded */}
        {walletConnected && !isLoading && !error && hasBookmarks && !noMatches && (
          <div className="space-y-10">
            <BookmarkGroup
              title="Apps"
              items={apps}
              view={view}
              onRemove={removeBookmark}
              reduceMotion={reduceMotion ?? false}
            />
            <BookmarkGroup
              title="Profiles"
              items={profiles}
              view={view}
              onRemove={removeBookmark}
              reduceMotion={reduceMotion ?? false}
            />
            <BookmarkGroup
              title="Links"
              items={links}
              view={view}
              onRemove={removeBookmark}
              reduceMotion={reduceMotion ?? false}
            />
          </div>
        )}
      </div>

      <Footer />

      <AddBookmarkDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}

function BookmarksNavbar() {
  return (
    <header className="glass-nav sticky top-0 z-40 pt-safe">
      <div className="mx-auto flex h-[52px] w-full max-w-[1200px] items-center justify-between px-4 md:h-16 md:px-6">
        <Link href="/" aria-label="Go to UP!Store home">
          <Wordmark />
        </Link>

        <div className="flex items-center gap-2 md:gap-3">
          <nav className="hidden items-center gap-1 md:flex" aria-label="Store sections">
            <Link
              href="/"
              className="relative flex h-9 min-h-[44px] items-center gap-1.5 px-3 text-sm font-medium text-text-secondary transition-colors hover:text-foreground"
            >
              <Compass className="h-4 w-4" aria-hidden="true" />
              Explore
            </Link>
            <Link
              href="/store"
              className="relative flex h-9 min-h-[44px] items-center gap-1.5 px-3 text-sm font-medium text-text-secondary transition-colors hover:text-foreground"
            >
              <Search className="h-4 w-4" aria-hidden="true" />
              Search
            </Link>
          </nav>

          {/* Search icon — keeps Search reachable on mobile where the text nav is hidden. */}
          <Link
            href="/store"
            aria-label="Search apps"
            className="relative inline-flex h-11 min-h-[44px] w-11 items-center justify-center rounded-full text-text-secondary transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden"
          >
            <Search className="h-5 w-5" aria-hidden="true" />
          </Link>

          <span
            aria-current="page"
            aria-label="Bookmarks"
            className="relative inline-flex h-11 min-h-[44px] w-11 items-center justify-center rounded-full text-brand-text"
          >
            <BookmarkIcon className="h-5 w-5 fill-current" aria-hidden />
          </span>

          <ThemeToggle />

          <UpConnect />
        </div>
      </div>
    </header>
  );
}

function ViewToggle({
  view,
  onChange,
}: {
  view: BookmarkView;
  onChange: (next: BookmarkView) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Bookmark layout"
      className="inline-flex shrink-0 items-center gap-0.5 rounded-full border border-border-strong bg-card p-0.5 shadow-rest"
    >
      <ViewToggleButton
        active={view === "list"}
        label="List view"
        onClick={() => onChange("list")}
      >
        <List className="h-4 w-4" aria-hidden="true" />
      </ViewToggleButton>
      <ViewToggleButton
        active={view === "grid"}
        label="Grid view"
        onClick={() => onChange("grid")}
      >
        <LayoutGrid className="h-4 w-4" aria-hidden="true" />
      </ViewToggleButton>
    </div>
  );
}

function ViewToggleButton({
  active,
  label,
  onClick,
  children,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={label}
      onClick={onClick}
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active
          ? "bg-brand text-primary-foreground shadow-sm dark:text-background"
          : "text-text-secondary hover:bg-muted hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}

function BookmarkGroup({
  title,
  items,
  view,
  onRemove,
  reduceMotion,
}: {
  title: string;
  items: Bookmark[];
  view: BookmarkView;
  onRemove: (id: string) => Promise<void>;
  reduceMotion: boolean;
}) {
  if (items.length === 0) return null;

  return (
    <section>
      <h2 className="mb-3 text-[11px] font-medium uppercase tracking-[0.08em] text-text-tertiary">
        {title}
      </h2>
      <ul
        className={
          view === "grid"
            ? "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
            : "space-y-2"
        }
      >
        {items.map((b, i) => (
          <motion.li
            key={b.id}
            initial={reduceMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.24, delay: reduceMotion ? 0 : i * 0.02 }}
          >
            {view === "grid" ? (
              <BookmarkCard bookmark={b} onRemove={onRemove} />
            ) : (
              <BookmarkRow bookmark={b} onRemove={onRemove} />
            )}
          </motion.li>
        ))}
      </ul>
    </section>
  );
}

/** Secondary line: a short address for profiles, otherwise the URL. */
function bookmarkSecondary(bookmark: Bookmark): string {
  return bookmark.type === "profile" && bookmark.address
    ? `${bookmark.address.slice(0, 6)}…${bookmark.address.slice(-4)}`
    : bookmark.url;
}

function BookmarkRow({
  bookmark,
  onRemove,
}: {
  bookmark: Bookmark;
  onRemove: (id: string) => Promise<void>;
}) {
  return (
    <a
      href={bookmark.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group relative flex items-center gap-3 rounded-lg border border-border bg-card p-3 shadow-rest transition hover:shadow-hover"
    >
      <BookmarkMedia bookmark={bookmark} />

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">
          {bookmark.title}
        </p>
        <p className="truncate text-xs text-text-secondary">
          {bookmarkSecondary(bookmark)}
        </p>
      </div>

      <button
        type="button"
        aria-label="Remove bookmark"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          void onRemove(bookmark.id);
        }}
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-text-secondary transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <X className="h-4 w-4" />
      </button>
    </a>
  );
}

function BookmarkCard({
  bookmark,
  onRemove,
}: {
  bookmark: Bookmark;
  onRemove: (id: string) => Promise<void>;
}) {
  return (
    <a
      href={bookmark.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group relative flex h-full flex-col items-center gap-3 rounded-xl border border-border bg-card p-4 text-center shadow-rest transition hover:shadow-hover"
    >
      <button
        type="button"
        aria-label="Remove bookmark"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          void onRemove(bookmark.id);
        }}
        className="absolute right-1.5 top-1.5 inline-flex h-7 w-7 items-center justify-center rounded-full text-text-tertiary transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <X className="h-4 w-4" />
      </button>

      <BookmarkMedia bookmark={bookmark} size="lg" />

      <div className="w-full min-w-0">
        <p className="truncate text-sm font-medium text-foreground">
          {bookmark.title}
        </p>
        <p className="truncate text-xs text-text-secondary">
          {bookmarkSecondary(bookmark)}
        </p>
      </div>
    </a>
  );
}

function BookmarkMedia({
  bookmark,
  size = "md",
}: {
  bookmark: Bookmark;
  size?: "md" | "lg";
}) {
  const box = size === "lg" ? "h-14 w-14" : "h-10 w-10";

  if (bookmark.type === "profile") {
    return (
      <Avatar className={box}>
        {bookmark.icon && <AvatarImage src={bookmark.icon} alt="" />}
        <AvatarFallback>
          <User
            className={cn(
              "text-text-secondary",
              size === "lg" ? "h-5 w-5" : "h-4 w-4"
            )}
          />
        </AvatarFallback>
      </Avatar>
    );
  }

  const FallbackIcon = bookmark.type === "app" ? AppWindow : LinkIcon;
  // For links, fall back to the site favicon when no icon was stored (covers
  // bookmarks saved before favicon import existed).
  const icon =
    bookmark.icon ??
    (bookmark.type === "link" ? faviconUrl(bookmark.url) : undefined);

  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden bg-muted",
        box,
        size === "lg" ? "rounded-xl" : "rounded-lg"
      )}
    >
      {icon ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={icon}
          alt=""
          className={cn(
            bookmark.type === "app"
              ? "h-full w-full object-cover"
              : "object-contain",
            bookmark.type !== "app" && (size === "lg" ? "h-8 w-8" : "h-6 w-6")
          )}
        />
      ) : (
        <FallbackIcon
          className={cn(
            "text-text-secondary",
            size === "lg" ? "h-5 w-5" : "h-4 w-4"
          )}
        />
      )}
    </span>
  );
}
