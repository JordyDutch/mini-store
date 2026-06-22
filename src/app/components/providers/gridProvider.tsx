'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useUpProvider } from "./upProvider";

const RPC_ENDPOINT = 'https://42.rpc.thirdweb.com';
const IPFS_GATEWAY = 'https://api.universalprofile.cloud/ipfs';

// Define LSP28TheGrid schema locally
const lsp28schema = [
  {
    "name": "LSP28TheGrid",
    "key": "0x724141d9918ce69e6b8afcf53a91748466086ba2c74b94cab43c649ae2ac23ff",
    "keyType": "Singleton",
    "valueType": "bytes",
    "valueContent": "VerifiableURI"
  }
];

// LSP28TheGrid interfaces
interface GridItemProperties {
  src?: string;
  title?: string;
  titleColor?: string;
  text?: string;
  textColor?: string;
  backgroundColor?: string;
  link?: string;
  images?: string[];
  type?: string;
  username?: string;
  id?: string;
  theme?: string;
  language?: string;
  donottrack?: boolean;
  data?: string;
  allow?: string;
  sandbox?: string;
  allowfullscreen?: boolean;
  referrerpolicy?: string;
}

interface GridItem {
  width: number;
  height: number;
  type: string;
  properties: GridItemProperties;
}

interface GridSection {
  title: string;
  gridColumns: number;
  grid: GridItem[];
  visibility?: "public" | "private";
  isPrivate?: boolean; // Legacy property for backward compatibility
}

interface GridData {
  sections: GridSection[];
  isLoading: boolean;
  error: string | null;
  /**
   * True only after the connected profile's on-chain grid has been read
   * successfully (including the "genuinely empty" case). Writers MUST gate on
   * this so an install/uninstall never merges onto a not-yet-loaded baseline and
   * overwrites the real on-chain grid with an empty one.
   */
  isLoaded: boolean;
  setSections: (sections: GridSection[]) => void;
}

// ERC725 Response interfaces
interface VerifiableURI {
  verification: {
    method: string;
    data: string;
  };
  url: string;
}

const GridContext = createContext<GridData | undefined>(undefined);

export function useGrid() {
  const context = useContext(GridContext);
  if (!context) {
    throw new Error("useGrid must be used within a GridProvider");
  }
  return context;
}

export function GridProvider({ children }: { children: ReactNode }) {
  const { accounts, walletConnected } = useUpProvider();
  const [sections, setSections] = useState<GridSection[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function fetchGridData() {
      if (!walletConnected || !accounts[0]) {
        // Disconnected: reset to a not-yet-loaded baseline so a stale grid from a
        // previous profile can never be written back under a new connection.
        setSections([]);
        setIsLoaded(false);
        setError(null);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);
      // New account (or first load): gate writes until THIS profile's grid loads.
      setIsLoaded(false);

      try {
        const { ERC725 } = await import('@erc725/erc725.js');
        const erc725js = new ERC725(
          lsp28schema,
          accounts[0],
          RPC_ENDPOINT,
          { ipfsGateway: IPFS_GATEWAY }
        );

        const fetchedData = await erc725js.getData('LSP28TheGrid');
        if (cancelled) return;

        // Genuinely empty on-chain (new user, nothing stored) — the ONLY case
        // where an empty grid is the real state. Mark loaded so the first install
        // can write.
        if (!fetchedData || !fetchedData.value) {
          setSections([]);
          setIsLoaded(true);
          return;
        }

        const value = fetchedData.value as VerifiableURI;
        if (
          !value.url ||
          typeof value.url !== 'string' ||
          !value.url.startsWith('ipfs://')
        ) {
          // Malformed on-chain value: a load failure, NOT an empty grid. Falls
          // through to catch so we never clobber a grid we might write back.
          throw new Error('Invalid or missing IPFS URL in grid data');
        }

        const ipfsHash = value.url.replace('ipfs://', '');
        const response = await fetch(`${IPFS_GATEWAY}/${ipfsHash}`);
        if (!response.ok) {
          throw new Error(
            `Failed to fetch grid data from IPFS: ${response.status} ${response.statusText}`
          );
        }

        const gridData = await response.json();
        if (cancelled) return;

        // Accept a bare array (legacy) or the { LSP28TheGrid } envelope.
        if (Array.isArray(gridData)) {
          setSections(gridData);
          setIsLoaded(true);
        } else if (gridData && gridData.LSP28TheGrid) {
          const theGrid = gridData.LSP28TheGrid;
          setSections(Array.isArray(theGrid) ? theGrid : [theGrid]);
          setIsLoaded(true);
        } else {
          // Unparseable payload — treat as a load failure, not an empty grid.
          throw new Error('Invalid grid data format');
        }
      } catch (err) {
        if (cancelled) return;
        console.error('GridProvider: Error fetching grid data:', err);
        // Preserve whatever sections we already have so a transient gateway/RPC
        // hiccup can never wipe the grid and then get written back as empty.
        // isLoaded stays false, so installs/uninstalls remain gated until a clean
        // load — preventing the empty-grid overwrite.
        setError('Failed to load grid data');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    fetchGridData();
    return () => {
      cancelled = true;
    };
    // Depend on the address (accounts[0]) rather than the array reference so a
    // new array instance from upProvider doesn't trigger a needless re-fetch.
  }, [walletConnected, accounts[0]]);

  return (
    <GridContext.Provider value={{ sections, isLoading, error, isLoaded, setSections }}>
      {children}
    </GridContext.Provider>
  );
}
