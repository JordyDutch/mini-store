/**
 * @component UpProvider
 * @description Context provider that manages Universal Profile (UP) wallet connections and state
 * for LUKSO blockchain interactions. It supports two runtime contexts:
 *
 * 1. Grid mini-app (inside an iframe on universaleverything.io): the provider comes from
 *    `@lukso/up-provider` and the parent Grid page injects the connection. The mini-app can
 *    NOT call `eth_requestAccounts` itself — it listens for `accountsChanged`.
 * 2. Standalone (the site opened directly in a browser): the provider comes from the UP Browser
 *    Extension (`window.lukso`, EIP-1193). Here we DO drive the connection ourselves via
 *    `connect()` → `eth_requestAccounts`, which opens the extension's connect popup.
 *
 * @provides {UpProviderContext} Context containing:
 * - provider: active wallet provider instance (up-provider or injected extension)
 * - client: Viem wallet client for blockchain interactions
 * - chainId: Current blockchain network ID
 * - accounts: Array of connected wallet addresses
 * - contextAccounts: Array of Universal Profile accounts (Grid only)
 * - walletConnected: Boolean indicating active wallet connection
 * - selectedAddress: Currently selected address for transactions
 * - isSearching: Loading state indicator
 * - isMiniApp: Boolean indicating if running in mini-app context
 * - isLoading: Boolean indicating if the provider is loading
 * - hasExtension: Boolean — UP Browser Extension detected (standalone connect available)
 * - isConnecting: Boolean — a standalone connect request is in flight
 * - connectError: Last standalone connect error message, if any
 * - connect: Trigger the standalone extension connect popup
 * - disconnect: Clear the local standalone connection
 */
"use client";

import type { UPClientProvider } from "@lukso/up-provider";
import { createWalletClient, custom } from "viem";
import { lukso, luksoTestnet } from "viem/chains";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
  useMemo,
} from "react";

/** Minimal EIP-1193 shape for the injected UP Browser Extension provider. */
interface InjectedProvider {
  request: (args: { method: string; params?: unknown[] | object }) => Promise<unknown>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
  isUniversalProfileExtension?: boolean;
}

type ActiveProvider = UPClientProvider | InjectedProvider;

declare global {
  interface Window {
    lukso?: InjectedProvider;
    ethereum?: InjectedProvider;
  }
}

interface UpProviderContext {
  provider: ActiveProvider | null;
  client: ReturnType<typeof createWalletClient> | null;
  chainId: number;
  accounts: Array<`0x${string}`>;
  contextAccounts: Array<`0x${string}`>;
  walletConnected: boolean;
  selectedAddress: `0x${string}` | null;
  setSelectedAddress: (address: `0x${string}` | null) => void;
  isSearching: boolean;
  setIsSearching: (isSearching: boolean) => void;
  isMiniApp: boolean;
  isLoading: boolean;
  hasExtension: boolean;
  isConnecting: boolean;
  connectError: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
}

const UpContext = createContext<UpProviderContext | undefined>(undefined);

// Dev-only debug logger so diagnostics never ship to production.
const debugLog = (...args: unknown[]) => {
  if (process.env.NODE_ENV !== "production") {
    console.log(...args);
  }
};

// Function to check if we're in a mini-app context (iframe)
const isMiniAppContext = () => {
  try {
    const isInIframe = window.self !== window.top;
    debugLog('isMiniAppContext: window.self !== window.top:', isInIframe);
    return isInIframe;
  } catch (e) {
    debugLog('isMiniAppContext: Error accessing window.top, assuming iframe context:', e);
    return true;
  }
};

// Resolve the injected UP Browser Extension provider for standalone use.
// Prefer the UP-specific `window.lukso`, fall back to a UP-flagged `window.ethereum`.
const getInjectedProvider = (): InjectedProvider | null => {
  if (typeof window === "undefined") return null;
  if (window.lukso) return window.lukso;
  if (window.ethereum?.isUniversalProfileExtension) return window.ethereum;
  return null;
};

// Normalize a chainId returned as a number (up-provider) or hex string (extension).
const toChainId = (value: unknown): number => {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  return 0;
};

// Read context accounts only when the active provider exposes them (Grid only).
const readContextAccounts = (provider: ActiveProvider): Array<`0x${string}`> => {
  const ctx = (provider as { contextAccounts?: Array<`0x${string}`> }).contextAccounts;
  return Array.isArray(ctx) ? ctx : [];
};

// Known EIP-1193 / JSON-RPC provider error codes mapped to actionable messages.
const EIP1193_MESSAGES: Record<number, string> = {
  4001: "You rejected the connection request in the Universal Profile extension.",
  4100: "This action isn't authorized — unlock the Universal Profile extension and try again.",
  4900: "The Universal Profile extension is disconnected.",
  4901: "The Universal Profile extension isn't connected to the LUKSO network.",
  [-32002]:
    "A connection request is already open — check the Universal Profile extension to approve it.",
  [-32603]: "The Universal Profile extension reported an internal error. Please try again.",
};

// Turn a wallet/RPC error into a precise, user-facing message: prefer a known
// EIP-1193 code, else the provider's own message, with the raw code appended for
// diagnosis. Only falls back to a generic line when nothing is available.
const toConnectError = (error: unknown): string => {
  const e = (error ?? {}) as {
    code?: number;
    message?: string;
    data?: { message?: string };
    cause?: { message?: string };
  };
  const code = typeof e.code === "number" ? e.code : undefined;
  if (code !== undefined && EIP1193_MESSAGES[code]) return EIP1193_MESSAGES[code];

  const detail =
    e.data?.message ||
    (error instanceof Error ? error.message : e.message) ||
    e.cause?.message ||
    "";
  if (detail) return code !== undefined ? `${detail} (code ${code})` : detail;

  return "Couldn't connect to your Universal Profile. Make sure the extension is installed and unlocked, then try again.";
};

const silenceLitDevWarnings = () => {
  const globalWithLitWarnings = globalThis as typeof globalThis & {
    litIssuedWarnings?: Set<string>;
  };

  globalWithLitWarnings.litIssuedWarnings ??= new Set<string>();
  globalWithLitWarnings.litIssuedWarnings.add("dev-mode");
  globalWithLitWarnings.litIssuedWarnings.add("multiple-versions");
};

export function useUpProvider() {
  const context = useContext(UpContext);
  if (!context) {
    throw new Error("useUpProvider must be used within a UpProvider");
  }
  return context;
}

interface UpProviderProps {
  children: ReactNode;
}

export function UpProvider({ children }: UpProviderProps) {
  const [chainId, setChainId] = useState<number>(0);
  const [accounts, setAccounts] = useState<Array<`0x${string}`>>([]);
  const [contextAccounts, setContextAccounts] = useState<Array<`0x${string}`>>([]);
  const [selectedAddress, setSelectedAddress] = useState<`0x${string}` | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isMiniApp, setIsMiniApp] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [provider, setProvider] = useState<ActiveProvider | null>(null);
  const [hasExtension, setHasExtension] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [account] = accounts ?? [];
  const [contextAccount] = contextAccounts ?? [];

  // A UP is connected when we have an account. In the Grid we additionally require a
  // context account (injected by the host); standalone has no context accounts.
  const walletConnected = useMemo(
    () => account != null && (isMiniApp ? contextAccount != null : true),
    [account, contextAccount, isMiniApp]
  );

  // Handle client-side context detection: Grid mini-app vs standalone extension.
  useEffect(() => {
    let cancelled = false;

    debugLog('UpProvider: Initializing...');
    const miniAppContext = isMiniAppContext();
    debugLog('UpProvider: isMiniAppContext result:', miniAppContext);
    setIsMiniApp(miniAppContext);
    setIsLoading(false);

    if (miniAppContext) {
      // Grid mini-app: load the up-provider; the parent page injects the connection.
      silenceLitDevWarnings();

      import("@lukso/up-provider")
        .then(({ createClientUPProvider }) => {
          if (!cancelled) {
            setProvider(createClientUPProvider());
          }
        })
        .catch((error) => {
          console.error("Failed to load Universal Profile provider:", error);
        });
    } else {
      // Standalone: detect the UP Browser Extension and silently restore an
      // already-authorized session (eth_accounts never opens a popup).
      const injected = getInjectedProvider();
      setHasExtension(Boolean(injected));

      if (injected) {
        injected
          .request({ method: "eth_accounts", params: [] })
          .then((result) => {
            if (cancelled) return;
            const restored = (result as Array<`0x${string}`>) ?? [];
            if (restored.length > 0) {
              setProvider(injected);
            }
          })
          .catch(() => {
            /* not yet authorized — wait for an explicit connect() */
          });
      }
    }

    // Fallback timeout to ensure loading doesn't get stuck
    const fallbackTimeout = setTimeout(() => {
      debugLog('UpProvider: Fallback timeout triggered, forcing loading to false');
      setIsLoading(false);
    }, 3000); // 3 seconds timeout

    return () => {
      cancelled = true;
      clearTimeout(fallbackTimeout);
    };
  }, []);

  const client = useMemo(() => {
    if (provider && chainId) {
      return createWalletClient({
        chain: chainId === 42 ? lukso : luksoTestnet,
        transport: custom(provider as Parameters<typeof custom>[0]),
      });
    }
    return null;
  }, [chainId, provider]);

  // Open the UP Browser Extension connect popup (standalone only).
  const connect = useCallback(async () => {
    const injected = getInjectedProvider();
    if (!injected) {
      setHasExtension(false);
      setConnectError("No Universal Profile extension detected.");
      return;
    }

    setIsConnecting(true);
    setConnectError(null);
    try {
      const result = await injected.request({ method: "eth_requestAccounts", params: [] });
      const granted = (result as Array<`0x${string}`>) ?? [];
      setProvider(injected);
      if (granted.length > 0) {
        setAccounts(granted);
      }
    } catch (error) {
      setConnectError(toConnectError(error));
    } finally {
      setIsConnecting(false);
    }
  }, []);

  // Local disconnect. EIP-1193 has no reliable dApp-initiated revoke, so this clears
  // our session; the extension keeps the grant, making reconnect a single click.
  const disconnect = useCallback(() => {
    setProvider(null);
    setAccounts([]);
    setContextAccounts([]);
    setSelectedAddress(null);
    setConnectError(null);
  }, []);

  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        if (!provider) return;

        const _accounts = (await provider.request({
          method: "eth_accounts",
          params: [],
        })) as Array<`0x${string}`>;
        if (!mounted) return;
        setAccounts(_accounts ?? []);

        const _chainId = await provider.request({ method: "eth_chainId" });
        if (!mounted) return;
        setChainId(toChainId(_chainId));

        const _contextAccounts = readContextAccounts(provider);
        if (!mounted) return;
        setContextAccounts(_contextAccounts);
      } catch (error) {
        if (error instanceof Error && error.message.includes("No UP found")) {
          return;
        }
        console.error(error);
      }
    }

    init();

    if (provider) {
      const accountsChanged = (..._args: unknown[]) => {
        setAccounts((_args[0] as Array<`0x${string}`>) ?? []);
      };

      const contextAccountsChanged = (..._args: unknown[]) => {
        setContextAccounts((_args[0] as Array<`0x${string}`>) ?? []);
      };

      const chainChanged = (..._args: unknown[]) => {
        setChainId(toChainId(_args[0]));
      };

      provider.on?.("accountsChanged", accountsChanged);
      provider.on?.("chainChanged", chainChanged);
      provider.on?.("contextAccountsChanged", contextAccountsChanged);

      return () => {
        mounted = false;
        provider.removeListener?.("accountsChanged", accountsChanged);
        provider.removeListener?.("contextAccountsChanged", contextAccountsChanged);
        provider.removeListener?.("chainChanged", chainChanged);
      };
    }
  }, [provider]);

  const data = useMemo(() => {
    return {
      provider,
      client,
      chainId,
      accounts,
      contextAccounts,
      walletConnected,
      selectedAddress,
      setSelectedAddress,
      isSearching,
      setIsSearching,
      isMiniApp,
      isLoading,
      hasExtension,
      isConnecting,
      connectError,
      connect,
      disconnect,
    };
  }, [
    client,
    chainId,
    accounts,
    contextAccounts,
    walletConnected,
    selectedAddress,
    isSearching,
    isMiniApp,
    isLoading,
    provider,
    hasExtension,
    isConnecting,
    connectError,
    connect,
    disconnect,
  ]);

  return (
    <UpContext.Provider value={data}>
      <div className="min-h-[100dvh] w-full">{children}</div>
    </UpContext.Provider>
  );
}
