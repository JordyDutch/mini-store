/**
 * @component UpProvider
 * @description Context provider that manages Universal Profile (UP) wallet connections and state
 * for LUKSO blockchain interactions. It supports two runtime contexts:
 *
 * 1. Grid mini-app (inside an iframe on universaleverything.io): the provider comes from
 *    `@lukso/up-provider` and the parent Grid page injects the connection. The mini-app can
 *    NOT call `eth_requestAccounts` itself — it listens for `accountsChanged`.
 * 2. Standalone (the site opened directly in a browser): connection is handled by LUKSO's
 *    `@lukso/up-modal`, which covers the UP Browser Extension (EIP-6963), the Universal
 *    Profiles mobile app (WalletConnect) and other wallets in one dialog. We bridge its
 *    wagmi connection back into this provider (provider + accounts) so the rest of the app
 *    keeps working, and `reconnect()` restores the session at page load (auto-connect).
 *
 * @provides {UpProviderContext} Context containing:
 * - provider: active wallet provider instance (up-provider, extension, or WalletConnect)
 * - client: Viem wallet client for blockchain interactions
 * - chainId: Current blockchain network ID
 * - accounts: Array of connected wallet addresses
 * - contextAccounts: Array of Universal Profile accounts (Grid only)
 * - walletConnected: Boolean indicating active wallet connection
 * - selectedAddress: Currently selected address for transactions
 * - isSearching: Loading state indicator
 * - isMiniApp: Boolean indicating if running in mini-app context
 * - isLoading: Boolean indicating if the provider is loading
 * - hasExtension: Boolean — UP Browser Extension detected
 * - isConnecting: Boolean — a standalone connect request is in flight
 * - connectError: Last standalone connect error message, if any
 * - connect: Open the UP-Modal sign-in dialog (extension + mobile + EOA)
 * - disconnect: End the standalone session
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
  useRef,
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

// Minimal shape of the UP-Modal connector + the wagmi connection we read back.
type UpModalConnector = {
  wagmiConfig: unknown;
  showSignInModal: () => void;
  closeModal?: () => void;
  destroyModal?: () => void;
  setTheme?: (theme: string) => void;
};
type WagmiConn = {
  address?: string;
  status?: string;
  isConnected?: boolean;
  connector?: { getProvider?: () => Promise<unknown> };
};

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
  /** Open the UP-Modal sign-in dialog (extension + UP mobile + EOA wallets). */
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

// Resolve the injected UP Browser Extension provider (for the hasExtension hint).
const getInjectedProvider = (): InjectedProvider | null => {
  if (typeof window === "undefined") return null;
  if (window.lukso) return window.lukso;
  if (window.ethereum?.isUniversalProfileExtension) return window.ethereum;
  return null;
};

// The app's theme is a `dark` class on <html> (see ThemeProvider) and does NOT
// follow the OS. Resolve it so the UP-Modal matches — passing "auto" would make
// up-modal follow prefers-color-scheme and mismatch the app (e.g. an OS-dark
// system renders the dark-theme QR — light dots — on the light modal, washing it out).
const resolveAppTheme = (): "light" | "dark" =>
  typeof document !== "undefined" &&
  document.documentElement.classList.contains("dark")
    ? "dark"
    : "light";

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
  // UP-Modal connector + its connection watcher / disconnect, kept for connect()
  // and disconnect() and cleaned up on unmount.
  const upModalRef = useRef<UpModalConnector | null>(null);
  const upDisconnectRef = useRef<(() => Promise<boolean>) | null>(null);
  const unwatchRef = useRef<(() => void) | null>(null);
  const themeObserverRef = useRef<MutationObserver | null>(null);
  const [account] = accounts ?? [];
  const [contextAccount] = contextAccounts ?? [];

  // A UP is connected when we have an account. In the Grid we additionally require a
  // context account (injected by the host); standalone has no context accounts.
  const walletConnected = useMemo(
    () => account != null && (isMiniApp ? contextAccount != null : true),
    [account, contextAccount, isMiniApp]
  );

  // Handle client-side context detection: Grid mini-app vs standalone (UP-Modal).
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
      // Standalone: hand connection to LUKSO's UP-Modal and bridge its wagmi
      // connection back into our state.
      setHasExtension(Boolean(getInjectedProvider()));

      (async () => {
        try {
          const [{ setupLuksoConnector, watchConnection, disconnect: upDisconnect }, { reconnect }] =
            await Promise.all([import("@lukso/up-modal"), import("@wagmi/core")]);
          if (cancelled) return;

          const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;
          const connector = await setupLuksoConnector({
            theme: resolveAppTheme(),
            ...(projectId ? { walletConnect: { projectId } } : {}),
          });
          if (cancelled) {
            connector.destroyModal?.();
            return;
          }
          upModalRef.current = connector;
          upDisconnectRef.current = upDisconnect;

          // Keep the UP-Modal theme in sync with the app's light/dark toggle so
          // the QR (and modal) always match — never a washed-out QR.
          const themeObserver = new MutationObserver(() => {
            connector.setTheme?.(resolveAppTheme());
          });
          themeObserver.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ["class"],
          });
          themeObserverRef.current = themeObserver;

          // Mirror the wagmi connection into our provider/accounts. Reused for the
          // initial restored session and every later change.
          const bridge = async (conn: WagmiConn) => {
            if (conn?.isConnected && conn.address) {
              try {
                const eip1193 = conn.connector?.getProvider
                  ? await conn.connector.getProvider()
                  : null;
                if (!cancelled && eip1193) setProvider(eip1193 as ActiveProvider);
              } catch {
                /* provider not retrievable — accounts still set below */
              }
              if (!cancelled) setAccounts([conn.address as `0x${string}`]);
            } else if (conn?.status === "disconnected") {
              if (!cancelled) {
                setProvider(null);
                setAccounts([]);
              }
            }
          };

          const unwatch = await watchConnection(bridge);
          if (cancelled) {
            unwatch?.();
            return;
          }
          unwatchRef.current = unwatch ?? null;

          // Restore a persisted session — auto-connect at page load.
          reconnect(
            connector.wagmiConfig as Parameters<typeof reconnect>[0]
          ).catch(() => {});
        } catch (error) {
          console.error("Failed to set up UP-Modal:", error);
        }
      })();
    }

    // Fallback timeout to ensure loading doesn't get stuck
    const fallbackTimeout = setTimeout(() => {
      debugLog('UpProvider: Fallback timeout triggered, forcing loading to false');
      setIsLoading(false);
    }, 3000); // 3 seconds timeout

    return () => {
      cancelled = true;
      clearTimeout(fallbackTimeout);
      unwatchRef.current?.();
      unwatchRef.current = null;
      themeObserverRef.current?.disconnect();
      themeObserverRef.current = null;
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

  // Open the UP-Modal sign-in dialog (standalone). It handles extension, the UP
  // mobile app (WalletConnect) and EOA wallets; the watcher bridges the result.
  const connect = useCallback(async () => {
    const connector = upModalRef.current;
    if (!connector) {
      setConnectError("Connection isn't ready yet — please try again in a moment.");
      return;
    }
    setConnectError(null);
    connector.showSignInModal();
  }, []);

  // End the standalone session (WalletConnect / extension via UP-Modal/wagmi).
  const disconnect = useCallback(() => {
    upDisconnectRef.current?.().catch(() => {});
    upModalRef.current?.closeModal?.();
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

      // WalletConnect (and some wallets) emit `disconnect` when the session ends
      // from the wallet side — mirror it into our local state.
      const disconnected = () => {
        setAccounts([]);
        setContextAccounts([]);
        setProvider(null);
      };

      provider.on?.("accountsChanged", accountsChanged);
      provider.on?.("chainChanged", chainChanged);
      provider.on?.("contextAccountsChanged", contextAccountsChanged);
      // `disconnect` isn't in the Grid up-provider's typed events, so address it
      // through the generic EIP-1193 shape (WalletConnect/extension emit it).
      (provider as InjectedProvider).on?.("disconnect", disconnected);

      return () => {
        mounted = false;
        provider.removeListener?.("accountsChanged", accountsChanged);
        provider.removeListener?.("contextAccountsChanged", contextAccountsChanged);
        provider.removeListener?.("chainChanged", chainChanged);
        (provider as InjectedProvider).removeListener?.("disconnect", disconnected);
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
