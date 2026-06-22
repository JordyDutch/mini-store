"use client";

import { Bookmark as BookmarkIcon } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";

import { useBookmarks } from "@/app/components/providers/bookmarksProvider";
import type { Bookmark } from "@/lib/bookmarks";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface BookmarkButtonProps {
  /** Prebuilt payload (caller uses buildAppBookmark/buildProfileBookmark/buildLinkBookmark). */
  bookmark: Bookmark;
  /** "icon" (card overlay) or "label" (detail action row). Default "icon". */
  variant?: "icon" | "label";
  /** White-on-image styling for media surfaces (e.g. FeaturedBanner). */
  onMedia?: boolean;
  className?: string;
}

export default function BookmarkButton({
  bookmark,
  variant = "icon",
  onMedia = false,
  className,
}: BookmarkButtonProps) {
  const { isBookmarked, toggleBookmark, isSaving } = useBookmarks();
  const saved = isBookmarked(bookmark.id);
  const prefersReduced = useReducedMotion();

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    void toggleBookmark(bookmark);
  };

  const ariaLabel = saved ? "Remove bookmark" : "Add bookmark";

  if (variant === "label") {
    return (
      <Button
        type="button"
        variant="glass-light"
        size="pill"
        onClick={handleClick}
        disabled={isSaving}
        aria-pressed={saved}
        aria-label={ariaLabel}
        className={cn("disabled:opacity-60", className)}
      >
        <BookmarkIcon className={cn("h-4 w-4", saved && "fill-current")} />
        {saved ? "Saved" : "Save"}
      </Button>
    );
  }

  return (
    <motion.button
      type="button"
      onClick={handleClick}
      disabled={isSaving}
      aria-pressed={saved}
      aria-label={ariaLabel}
      whileTap={prefersReduced ? undefined : { scale: 0.92 }}
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-full border shadow-sm transition active:scale-[0.98] disabled:opacity-60",
        onMedia
          ? "border-white/40 bg-white/15 text-white backdrop-blur-md hover:bg-white/25"
          : saved
            ? "border-brand/30 bg-brand/10 text-brand hover:bg-brand/15"
            : "border-border bg-card text-text-secondary hover:bg-muted hover:text-foreground",
        className
      )}
    >
      <BookmarkIcon className={cn("h-4 w-4", saved && "fill-current")} />
    </motion.button>
  );
}
