"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Bookmark as BookmarkIcon, Loader2 } from "lucide-react";

import { useBookmarks } from "@/app/components/providers/bookmarksProvider";
import { Button } from "@/components/ui/button";

/**
 * Floating action bar shown whenever there are staged (unsaved) bookmark changes.
 * Bookmarks are batched locally — this bar commits them all in ONE transaction so
 * the user signs once, not once per bookmark. Mounted globally so it appears on
 * every surface (store rails, search, detail, the bookmarks page).
 */
export default function BookmarkSaveBar() {
  const { hasPending, pendingCount, isSaving, commitBookmarks, discardPending } =
    useBookmarks();
  const reduceMotion = useReducedMotion();

  return (
    <AnimatePresence>
      {hasPending && (
        <motion.div
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 24 }}
          transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
          className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 pb-[calc(env(safe-area-inset-bottom)+16px)]"
        >
          <div className="glass-strong pointer-events-auto flex items-center gap-2 rounded-full border border-border px-3 py-2 shadow-glass sm:gap-3 sm:px-4 sm:py-2.5">
            <span className="inline-flex items-center gap-2 px-1 text-sm font-medium text-foreground">
              <BookmarkIcon className="h-4 w-4 shrink-0 text-brand" aria-hidden />
              <span className="tabular-nums">
                {pendingCount} unsaved {pendingCount === 1 ? "change" : "changes"}
              </span>
            </span>
            <Button
              type="button"
              variant="ghost-outline"
              size="pill"
              className="h-9"
              onClick={discardPending}
              disabled={isSaving}
            >
              Discard
            </Button>
            <Button
              type="button"
              variant="gradient"
              size="pill"
              className="h-9 min-w-[88px]"
              onClick={() => void commitBookmarks()}
              disabled={isSaving}
              aria-label={`Save ${pendingCount} bookmark change${pendingCount === 1 ? "" : "s"}`}
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  <span>Saving…</span>
                </>
              ) : (
                "Save"
              )}
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
