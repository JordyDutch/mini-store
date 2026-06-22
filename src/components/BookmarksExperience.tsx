"use client";

import Link from "next/link";
import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  AppWindow,
  Bookmark as BookmarkIcon,
  Compass,
  Link as LinkIcon,
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

export default function BookmarksExperience() {
  const { bookmarks, isLoading, error, removeBookmark } = useBookmarks();
  const { walletConnected, connect, hasExtension, isMiniApp } = useUpProvider();
  const reduceMotion = useReducedMotion();
  const [dialogOpen, setDialogOpen] = useState(false);

  const apps = bookmarks.filter((b) => b.type === "app");
  const profiles = bookmarks.filter((b) => b.type === "profile");
  const links = bookmarks.filter((b) => b.type === "link");

  return (
    <div className="flex min-h-[100dvh] flex-col bg-background">
      <BookmarksNavbar />

      <div className="mx-auto w-full max-w-[1200px] flex-1 px-4 py-8 md:px-6 md:py-12">
        <div className="mb-8 flex items-center justify-between gap-4">
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
        {walletConnected && !isLoading && !error && bookmarks.length === 0 && (
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

        {/* Loaded */}
        {walletConnected && !isLoading && !error && bookmarks.length > 0 && (
          <div className="space-y-10">
            <BookmarkGroup
              title="Apps"
              items={apps}
              onRemove={removeBookmark}
              reduceMotion={reduceMotion ?? false}
            />
            <BookmarkGroup
              title="Profiles"
              items={profiles}
              onRemove={removeBookmark}
              reduceMotion={reduceMotion ?? false}
            />
            <BookmarkGroup
              title="Links"
              items={links}
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

function BookmarkGroup({
  title,
  items,
  onRemove,
  reduceMotion,
}: {
  title: string;
  items: Bookmark[];
  onRemove: (id: string) => Promise<void>;
  reduceMotion: boolean;
}) {
  if (items.length === 0) return null;

  return (
    <section>
      <h2 className="mb-3 text-[11px] font-medium uppercase tracking-[0.08em] text-text-tertiary">
        {title}
      </h2>
      <ul className="space-y-2">
        {items.map((b, i) => (
          <motion.li
            key={b.id}
            initial={reduceMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.24, delay: reduceMotion ? 0 : i * 0.02 }}
          >
            <BookmarkRow bookmark={b} onRemove={onRemove} />
          </motion.li>
        ))}
      </ul>
    </section>
  );
}

function BookmarkRow({
  bookmark,
  onRemove,
}: {
  bookmark: Bookmark;
  onRemove: (id: string) => Promise<void>;
}) {
  const secondary =
    bookmark.type === "profile" && bookmark.address
      ? `${bookmark.address.slice(0, 6)}…${bookmark.address.slice(-4)}`
      : bookmark.url;

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
        <p className="truncate text-xs text-text-secondary">{secondary}</p>
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

function BookmarkMedia({ bookmark }: { bookmark: Bookmark }) {
  if (bookmark.type === "profile") {
    return (
      <Avatar className="h-10 w-10">
        {bookmark.icon && <AvatarImage src={bookmark.icon} alt="" />}
        <AvatarFallback>
          <User className="h-4 w-4 text-text-secondary" />
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
    <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
      {icon ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={icon}
          alt=""
          className={
            bookmark.type === "app"
              ? "h-full w-full object-cover"
              : "h-6 w-6 object-contain"
          }
        />
      ) : (
        <FallbackIcon className="h-4 w-4 text-text-secondary" />
      )}
    </span>
  );
}
