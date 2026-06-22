"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { createPublicClient, http } from "viem";
import { lukso, luksoTestnet } from "viem/chains";

import { useUpProvider } from "./upProvider";
import { uploadMetadataToIPFS } from "@/hooks/uploadMetadata";
import {
  type Bookmark,
  BOOKMARKS_SCHEMA,
  BOOKMARKS_KEY,
  parseBookmarksJson,
  buildBookmarksEnvelope,
  appBookmarkId,
} from "@/lib/bookmarks";
import type { App } from "@/data/appCatalog";

const RPC_ENDPOINT = "https://42.rpc.thirdweb.com";
const IPFS_GATEWAY = "https://api.universalprofile.cloud/ipfs";

type ToastOptions = Parameters<typeof toast>[1];

const NEUTRAL_TOAST: ToastOptions = {
  duration: 3000,
  position: "bottom-center",
  style: {
    background: "#303030",
    color: "#f0f0f0",
    border: "1px solid #303030",
  },
};

const ERROR_TOAST: ToastOptions = {
  duration: 6000,
  position: "bottom-center",
  style: {
    background: "#dc2626",
    color: "#ffffff",
    border: "1px solid #dc2626",
  },
};

/** Extract a human-readable message from an unknown thrown value. */
const errMessage = (e: unknown): string =>
  e instanceof Error && e.message ? e.message : "Unknown error";

// setData ABI kept inline (mirrors useInstallApp).
const SET_DATA_ABI = [
  {
    name: "setData",
    type: "function",
    inputs: [
      { name: "key", type: "bytes32" },
      { name: "value", type: "bytes" },
    ],
    outputs: [],
    stateMutability: "payable",
  },
] as const;

// VerifiableURI value returned by ERC725.getData.
interface VerifiableURI {
  verification?: { method: string; data: string };
  url: string;
}

// A staged-but-unwritten change. Bookmarks are batched locally and committed in a
// single setData transaction so users don't sign once per bookmark.
type PendingOp = { op: "add" | "remove"; bookmark: Bookmark };
type PendingMap = Record<string, PendingOp>;

interface BookmarksContextValue {
  /** Effective list = on-chain committed set with pending (unsaved) changes applied. */
  bookmarks: Bookmark[];
  /** Last known on-chain set (what is actually persisted). */
  committed: Bookmark[];
  isLoading: boolean;
  error: string | null;
  /** True only while a batch commit transaction is in flight. */
  isSaving: boolean;
  /** Number of staged, unsaved changes. */
  pendingCount: number;
  hasPending: boolean;
  isBookmarked: (idOrApp: string | App) => boolean;
  /** Stage a toggle (no transaction). Re-toggling cancels a staged change. */
  toggleBookmark: (b: Bookmark) => Promise<void>;
  /** Stage an add (no transaction). */
  addBookmark: (b: Bookmark) => Promise<void>;
  /** Stage a removal (no transaction). */
  removeBookmark: (id: string) => Promise<void>;
  /** Persist ALL staged changes in a single transaction, merged onto the on-chain set. */
  commitBookmarks: () => Promise<void>;
  /** Drop all staged changes. */
  discardPending: () => void;
}

const BookmarksContext = createContext<BookmarksContextValue | undefined>(
  undefined
);

export function useBookmarks() {
  const context = useContext(BookmarksContext);
  if (!context) {
    throw new Error("useBookmarks must be used within a BookmarksProvider");
  }
  return context;
}

export function BookmarksProvider({ children }: { children: ReactNode }) {
  const {
    accounts,
    walletConnected,
    client: upClient,
    chainId,
    isMiniApp,
    hasExtension,
    connect,
  } = useUpProvider();

  // committed = what's on-chain; pending = staged-but-unsaved changes keyed by id.
  const [committed, setCommitted] = useState<Bookmark[]>([]);
  const [pending, setPending] = useState<PendingMap>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Guards the read effect from clobbering optimistic state mid-write, and lets
  // commit know whether we have a trustworthy on-chain baseline yet.
  const isSavingRef = useRef(false);
  const loadedRef = useRef(false);
  const committedRef = useRef<Bookmark[]>([]);
  useEffect(() => {
    committedRef.current = committed;
  }, [committed]);

  // Read the on-chain bookmarks for an address. Returns null on failure (so the
  // caller can distinguish "empty" from "couldn't load" and avoid clobbering).
  const readOnChain = useCallback(
    async (address: `0x${string}`): Promise<Bookmark[]> => {
      const { ERC725 } = await import("@erc725/erc725.js");
      const erc725 = new ERC725(
        BOOKMARKS_SCHEMA as unknown as ConstructorParameters<typeof ERC725>[0],
        address,
        RPC_ENDPOINT,
        { ipfsGateway: IPFS_GATEWAY }
      );

      const fetched = await erc725.getData("UPStoreBookmarks");
      if (!fetched?.value) return []; // new user, nothing stored yet

      const value = fetched.value as VerifiableURI;
      if (
        !value.url ||
        typeof value.url !== "string" ||
        !value.url.startsWith("ipfs://")
      ) {
        return [];
      }

      const ipfsHash = value.url.replace("ipfs://", "");
      const res = await fetch(`${IPFS_GATEWAY}/${ipfsHash}`);
      if (!res.ok) {
        throw new Error(
          `IPFS gateway returned ${res.status} ${res.statusText} for ${ipfsHash}`
        );
      }
      return parseBookmarksJson((await res.json()) as unknown);
    },
    []
  );

  // Load the committed set whenever the connected account changes.
  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!walletConnected || !accounts[0]) {
        // Disconnected: clear everything (committed + any staged session changes).
        setCommitted([]);
        setPending({});
        loadedRef.current = false;
        setIsLoading(false);
        setError(null);
        return;
      }

      // Don't overwrite optimistic state while a commit is in flight.
      if (isSavingRef.current) return;

      setIsLoading(true);
      setError(null);

      try {
        const result = await readOnChain(accounts[0]);
        if (cancelled) return;
        setCommitted(result);
        loadedRef.current = true;
      } catch (err) {
        if (cancelled) return;
        console.error("BookmarksProvider: Error loading bookmarks:", err);
        // Keep whatever we already have so a transient gateway/RPC hiccup never
        // clobbers the set. Only surface an error when there's nothing to show.
        if (committedRef.current.length === 0) {
          setError(`Couldn't load bookmarks: ${errMessage(err)}`);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
    // Depend on accounts[0] (the address) rather than the array reference so we
    // don't re-fetch when upProvider merely hands back a new array instance.
  }, [walletConnected, accounts[0], readOnChain]);

  // Effective list = committed with staged changes applied.
  const effective = useMemo(() => {
    const map = new Map(committed.map((b) => [b.id, b] as const));
    for (const { op, bookmark } of Object.values(pending)) {
      if (op === "add") map.set(bookmark.id, bookmark);
      else map.delete(bookmark.id);
    }
    return Array.from(map.values());
  }, [committed, pending]);

  const isBookmarked = useCallback(
    (idOrApp: string | App) => {
      const id =
        typeof idOrApp === "string"
          ? idOrApp
          : appBookmarkId(idOrApp.id ?? idOrApp.app.url);
      return effective.some((b) => b.id === id);
    },
    [effective]
  );

  // --- Staging (no transaction) -------------------------------------------

  const toggleBookmark = useCallback(
    async (b: Bookmark) => {
      setPending((prev) => {
        const next = { ...prev };
        if (next[b.id]) {
          // Re-toggling a staged change just cancels it (back to committed state).
          delete next[b.id];
          return next;
        }
        const onChain = committed.some((x) => x.id === b.id);
        next[b.id] = onChain
          ? { op: "remove", bookmark: b }
          : { op: "add", bookmark: b };
        return next;
      });
    },
    [committed]
  );

  const addBookmark = useCallback(
    async (b: Bookmark) => {
      setPending((prev) => {
        const next = { ...prev };
        if (next[b.id]?.op === "remove") {
          delete next[b.id]; // cancel a staged removal
          return next;
        }
        const onChain = committed.some((x) => x.id === b.id);
        if (onChain) delete next[b.id];
        else next[b.id] = { op: "add", bookmark: b };
        return next;
      });
    },
    [committed]
  );

  const removeBookmark = useCallback(
    async (id: string) => {
      setPending((prev) => {
        const next = { ...prev };
        if (next[id]?.op === "add") {
          delete next[id]; // cancel a staged add
          return next;
        }
        const onChainBookmark = committed.find((x) => x.id === id);
        if (onChainBookmark) next[id] = { op: "remove", bookmark: onChainBookmark };
        else delete next[id];
        return next;
      });
    },
    [committed]
  );

  const discardPending = useCallback(() => setPending({}), []);

  // --- Commit (single transaction, merge-safe) ----------------------------

  const commitBookmarks = useCallback(async () => {
    if (Object.keys(pending).length === 0) return;

    if (!accounts[0] || !upClient) {
      if (!isMiniApp && hasExtension) {
        void connect();
        return;
      }
      toast("Connect your Universal Profile to save bookmarks", ERROR_TOAST);
      return;
    }

    const chain = chainId === 42 ? lukso : luksoTestnet;
    isSavingRef.current = true;
    setIsSaving(true);

    try {
      // Build the base from the authoritative committed set. If we never managed
      // a successful load, re-read first so we never overwrite bookmarks saved in
      // a previous session.
      let base = committed;
      if (!loadedRef.current) {
        try {
          base = await readOnChain(accounts[0]);
          loadedRef.current = true;
        } catch {
          // Couldn't refresh — fall back to the local committed set as the base.
        }
      }

      const map = new Map(base.map((b) => [b.id, b] as const));
      for (const { op, bookmark } of Object.values(pending)) {
        if (op === "add") map.set(bookmark.id, bookmark);
        else map.delete(bookmark.id);
      }
      const merged = Array.from(map.values());

      const envelope = buildBookmarksEnvelope(merged);
      const metadataIpfsUrl = await uploadMetadataToIPFS(envelope);

      const { ERC725 } = await import("@erc725/erc725.js");
      const erc725 = new ERC725(
        BOOKMARKS_SCHEMA as unknown as ConstructorParameters<typeof ERC725>[0]
      );

      const encodedData = erc725.encodeData([
        {
          keyName: "UPStoreBookmarks",
          value: {
            json: envelope,
            url: `ipfs://${metadataIpfsUrl.split("/ipfs/")[1]}`,
          },
        },
      ]);

      const txHash = (await upClient.writeContract({
        address: accounts[0] as `0x${string}`,
        abi: SET_DATA_ABI,
        functionName: "setData",
        args: [
          BOOKMARKS_KEY as `0x${string}`,
          encodedData.values[0] as `0x${string}`,
        ],
        account: accounts[0],
        chain,
      })) as `0x${string}`;

      // Optimistically adopt the merged set and clear the staged changes.
      setCommitted(merged);
      loadedRef.current = true;
      setPending({});
      toast("Bookmarks saved", NEUTRAL_TOAST);

      const publicClient = createPublicClient({ chain, transport: http() });
      publicClient
        .waitForTransactionReceipt({ hash: txHash })
        .then((receipt) => {
          if (!receipt) console.error("Bookmarks transaction failed:", txHash);
        })
        .catch((receiptError) => {
          console.error("Error checking bookmarks transaction receipt:", receiptError);
        });
    } catch (err) {
      console.error("BookmarksProvider: Error saving bookmarks:", err);
      toast(`Couldn't save bookmarks: ${errMessage(err)}`, ERROR_TOAST);
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);
    }
  }, [
    pending,
    committed,
    accounts,
    upClient,
    chainId,
    isMiniApp,
    hasExtension,
    connect,
    readOnChain,
  ]);

  const pendingCount = Object.keys(pending).length;

  const value = useMemo<BookmarksContextValue>(
    () => ({
      bookmarks: effective,
      committed,
      isLoading,
      error,
      isSaving,
      pendingCount,
      hasPending: pendingCount > 0,
      isBookmarked,
      toggleBookmark,
      addBookmark,
      removeBookmark,
      commitBookmarks,
      discardPending,
    }),
    [
      effective,
      committed,
      isLoading,
      error,
      isSaving,
      pendingCount,
      isBookmarked,
      toggleBookmark,
      addBookmark,
      removeBookmark,
      commitBookmarks,
      discardPending,
    ]
  );

  return (
    <BookmarksContext.Provider value={value}>
      {children}
    </BookmarksContext.Provider>
  );
}
