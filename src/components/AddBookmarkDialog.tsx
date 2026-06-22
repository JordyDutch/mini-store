"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { motion, useReducedMotion, type Transition } from "framer-motion";
import { Bookmark as BookmarkIcon, Loader2, User, X } from "lucide-react";
import { useLazyQuery } from "@apollo/client";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  GET_UNIVERSAL_PROFILE,
  SEARCH_PROFILES_BY_NAME,
} from "@/app/components/apollo/query";
import { useBookmarks } from "@/app/components/providers/bookmarksProvider";
import {
  isAddress,
  buildProfileBookmark,
  buildLinkBookmark,
} from "@/lib/bookmarks";
import { cn } from "@/lib/utils";

const IPFS_GATEWAY = "https://api.universalprofile.cloud/ipfs";

const resolveIpfs = (url?: string): string | undefined => {
  if (!url) return undefined;
  if (url.startsWith("ipfs://")) {
    return `${IPFS_GATEWAY}/${url.replace("ipfs://", "")}`;
  }
  return url;
};

// A URL is anything with a scheme, or a host.tld shape. Everything else that
// isn't a 0x address is treated as a profile-name search term.
const looksLikeUrl = (value: string): boolean => {
  const t = value.trim();
  if (t.includes("://")) return true;
  return /^[^\s]+\.[a-z]{2,}([/?#].*)?$/i.test(t);
};

const shortAddress = (address: string) =>
  `${address.slice(0, 6)}…${address.slice(-4)}`;

interface ProfileImage {
  url?: string;
}
interface ProfileNode {
  id: string;
  name?: string;
  profileImages?: ProfileImage[];
}
interface ProfileResult {
  Profile?: ProfileNode[];
}

interface AddBookmarkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function AddBookmarkDialog({
  open,
  onOpenChange,
}: AddBookmarkDialogProps) {
  const reduceMotion = useReducedMotion();
  const { addBookmark, isBookmarked, isSaving } = useBookmarks();

  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");
  const [title, setTitle] = useState("");
  const [resolvedIcon, setResolvedIcon] = useState<string | undefined>(
    undefined
  );
  const [results, setResults] = useState<ProfileNode[]>([]);

  const trimmed = value.trim();
  const mode: "address" | "url" | "name" | "empty" = useMemo(() => {
    if (!trimmed) return "empty";
    if (isAddress(trimmed)) return "address";
    if (looksLikeUrl(trimmed)) return "url";
    return "name";
  }, [trimmed]);

  const [runProfileQuery, { loading: resolving }] = useLazyQuery<ProfileResult>(
    GET_UNIVERSAL_PROFILE
  );
  const [runNameSearch, { loading: searching }] = useLazyQuery<ProfileResult>(
    SEARCH_PROFILES_BY_NAME
  );

  // Resolve profile name/avatar when a valid address is entered (debounced).
  useEffect(() => {
    if (!isAddress(trimmed)) {
      setResolvedIcon(undefined);
      return;
    }

    const handle = setTimeout(() => {
      runProfileQuery({ variables: { profileAddress: trimmed.toLowerCase() } })
        .then((res) => {
          const profile = res.data?.Profile?.[0];
          if (!profile) return;
          if (!title.trim() && profile.name) setTitle(profile.name);
          setResolvedIcon(resolveIpfs(profile.profileImages?.[0]?.url));
        })
        .catch(() => {
          // Resolution failure is non-fatal.
        });
    }, 400);

    return () => clearTimeout(handle);
    // Intentionally only depends on `trimmed`: `title`/`runProfileQuery` are read
    // but omitted so we don't re-query on every title keystroke. Do not "fix".
  }, [trimmed]);

  // Search profiles by name via the Envio indexer (debounced) in name mode.
  useEffect(() => {
    if (mode !== "name" || trimmed.length < 2) {
      setResults([]);
      return;
    }

    const handle = setTimeout(() => {
      runNameSearch({ variables: { query: `%${trimmed}%` } })
        .then((res) => setResults(res.data?.Profile ?? []))
        .catch(() => setResults([]));
    }, 350);

    return () => clearTimeout(handle);
    // Only re-run on the term/mode; runNameSearch is stable. Do not "fix" deps.
  }, [trimmed, mode]);

  const reset = () => {
    setValue("");
    setTitle("");
    setResolvedIcon(undefined);
    setResults([]);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const finishWith = async (bookmark: ReturnType<typeof buildLinkBookmark>) => {
    if (isBookmarked(bookmark.id)) {
      toast("Already bookmarked", {
        duration: 3000,
        position: "bottom-center",
        style: {
          background: "#303030",
          color: "#f0f0f0",
          border: "1px solid #303030",
        },
      });
    } else {
      await addBookmark(bookmark);
    }
    reset();
    onOpenChange(false);
  };

  // Add button: only for a pasted address (profile) or a URL (link).
  const handleSubmit = async () => {
    if (mode === "address") {
      await finishWith(
        buildProfileBookmark(trimmed, { title, icon: resolvedIcon })
      );
    } else if (mode === "url") {
      await finishWith(buildLinkBookmark(trimmed, { title }));
    }
  };

  // Pick a profile from the name-search results.
  const handleSelectProfile = async (p: ProfileNode) => {
    await finishWith(
      buildProfileBookmark(p.id, {
        title: p.name,
        icon: resolveIpfs(p.profileImages?.[0]?.url),
      })
    );
  };

  const enter: Transition = { duration: 0.28, ease: [0.22, 1, 0.36, 1] };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={handleOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay asChild>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduceMotion ? 0.12 : 0.2 }}
            className="fixed inset-0 z-50 bg-foreground/30 backdrop-blur-[2px]"
          />
        </DialogPrimitive.Overlay>

        <DialogPrimitive.Content
          aria-describedby={undefined}
          // Focus the input on open (not the close button) so the user can type
          // immediately — but WITHOUT scrolling: the dialog is a bottom sheet on
          // mobile, and a default focus scroll yanks the page down to it.
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            inputRef.current?.focus({ preventScroll: true });
          }}
          className={cn(
            "fixed z-50 focus:outline-none",
            "inset-x-0 bottom-0 w-full pb-safe",
            "sm:inset-auto sm:left-1/2 sm:top-1/2 sm:bottom-auto sm:w-full sm:max-w-[480px] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:pb-0"
          )}
        >
          <motion.div
            initial={
              reduceMotion ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.98 }
            }
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={enter}
            className={cn(
              "glass-strong relative overflow-hidden",
              "rounded-t-[28px] rounded-b-none border-b-0",
              "sm:rounded-[28px] sm:border-b"
            )}
          >
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-glow-ambient"
            />

            <div className="flex justify-center pt-3 sm:hidden">
              <span className="h-1.5 w-10 rounded-full bg-border-strong" />
            </div>

            <DialogPrimitive.Close
              aria-label="Close dialog"
              className="absolute right-4 top-4 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full text-text-secondary transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <X className="h-5 w-5" />
            </DialogPrimitive.Close>

            <div className="relative px-6 pb-8 pt-6 sm:pb-7">
              <div className="mb-6 flex flex-col items-center text-center">
                <span className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-gradient-cta text-white shadow-cta ring-1 ring-inset ring-white/15">
                  <BookmarkIcon className="h-6 w-6" />
                </span>
                <DialogPrimitive.Title className="font-display text-xl font-semibold leading-tight tracking-tight text-foreground">
                  Add a bookmark
                </DialogPrimitive.Title>
                <p className="mt-2 max-w-[34ch] text-sm leading-relaxed text-text-secondary">
                  Search a Universal Profile by name, or paste a URL or 0x
                  address.
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label
                    htmlFor="bookmark-value"
                    className="block text-[11px] font-medium uppercase tracking-[0.06em] text-text-tertiary"
                  >
                    Search a name, or paste a URL / 0x address
                  </label>
                  <Input
                    ref={inputRef}
                    id="bookmark-value"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder="Search profiles, or https://… / 0x…"
                    autoComplete="off"
                    className="h-12 rounded-md border-border-strong bg-card text-base sm:text-sm"
                  />
                  {(mode === "address" || mode === "url") && (
                    <span className="chip inline-flex w-fit text-xs">
                      {mode === "address" ? "Profile" : "Link"}
                      {resolving && mode === "address" ? " · resolving…" : ""}
                    </span>
                  )}
                </div>

                {/* Name search results (Envio indexer) */}
                {mode === "name" && (
                  <div className="rounded-lg border border-border bg-card/60">
                    {searching && (
                      <div className="flex items-center gap-2 px-3 py-3 text-sm text-text-secondary">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Searching profiles…
                      </div>
                    )}

                    {!searching && trimmed.length < 2 && (
                      <p className="px-3 py-3 text-sm text-text-tertiary">
                        Type at least 2 characters to search.
                      </p>
                    )}

                    {!searching && trimmed.length >= 2 && results.length === 0 && (
                      <p className="px-3 py-3 text-sm text-text-tertiary">
                        No profiles found for “{trimmed}”.
                      </p>
                    )}

                    {!searching && results.length > 0 && (
                      <ul className="max-h-[260px] overflow-y-auto py-1">
                        {results.map((p) => (
                          <li key={p.id}>
                            <button
                              type="button"
                              onClick={() => handleSelectProfile(p)}
                              disabled={isSaving}
                              className="flex w-full items-center gap-3 px-3 py-2 text-left transition hover:bg-muted focus-visible:outline-none focus-visible:bg-muted disabled:opacity-60"
                            >
                              <Avatar className="h-9 w-9 shrink-0">
                                <AvatarImage
                                  src={resolveIpfs(p.profileImages?.[0]?.url)}
                                  alt=""
                                />
                                <AvatarFallback>
                                  <User className="h-4 w-4 text-text-secondary" />
                                </AvatarFallback>
                              </Avatar>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-medium text-foreground">
                                  {p.name || "Unnamed profile"}
                                </span>
                                <span className="block truncate text-xs text-text-secondary">
                                  {shortAddress(p.id)}
                                </span>
                              </span>
                              {isBookmarked(`profile:${p.id.toLowerCase()}`) && (
                                <BookmarkIcon className="h-4 w-4 shrink-0 fill-current text-brand" />
                              )}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                {/* Title + Add button only for a pasted address / URL */}
                {(mode === "address" || mode === "url") && (
                  <>
                    <div className="space-y-2">
                      <label
                        htmlFor="bookmark-title"
                        className="block text-[11px] font-medium uppercase tracking-[0.06em] text-text-tertiary"
                      >
                        Title (optional)
                      </label>
                      <Input
                        id="bookmark-title"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Give it a name"
                        className="h-12 rounded-md border-border-strong bg-card text-base sm:text-sm"
                      />
                    </div>

                    <Button
                      onClick={handleSubmit}
                      disabled={isSaving}
                      variant="gradient"
                      size="pill"
                      className="w-full disabled:opacity-50 disabled:shadow-none"
                    >
                      Add bookmark
                    </Button>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
