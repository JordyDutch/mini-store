"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { ExternalLink, Loader2, LogOut } from "lucide-react";

import { useUpProvider } from "@/app/components/providers/upProvider";
import { useProfile } from "@/app/components/providers/profileProvider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const UP_EXTENSION_URL =
  "https://chromewebstore.google.com/detail/universal-profiles/abpickdkkbnbcoepogfhkhennhfhehfn";

/**
 * Connection control for the header. Renders, by context:
 * - connected (Grid or standalone) → the Universal Profile pill (with a disconnect
 *   menu when standalone, since the Grid host owns the connection there);
 * - standalone, disconnected → a "Connect" button that opens the connect modal;
 * - Grid, disconnected → nothing (the host injects the connection on its own).
 */
export default function UpConnect() {
  const { walletConnected, isMiniApp, isLoading } = useUpProvider();
  const [modalOpen, setModalOpen] = useState(false);

  // Connected: show the profile pill. Gate on the connection alone — profile
  // metadata loads asynchronously afterwards, and the pill degrades gracefully
  // (UP logo + shortened address) until it arrives.
  if (walletConnected) {
    return <ProfilePill isMiniApp={isMiniApp} />;
  }

  // Inside the Grid the connection is injected by the parent page — there's nothing
  // for the user to click. Wait for the host instead of showing a connect button.
  if (isMiniApp || isLoading) {
    return null;
  }

  // Standalone, not connected: offer the connect modal.
  return (
    <>
      <Button
        type="button"
        variant="glass"
        size="pill"
        onClick={() => setModalOpen(true)}
        className="text-sm font-medium"
      >
        Connect
      </Button>
      <ConnectModal open={modalOpen} onOpenChange={setModalOpen} />
    </>
  );
}

function shortenAddress(address?: `0x${string}` | null) {
  if (!address) return "Profile";
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function ProfilePill({ isMiniApp }: { isMiniApp: boolean }) {
  const { profileData } = useProfile();
  const { disconnect, accounts } = useUpProvider();
  const label = profileData?.name || shortenAddress(accounts?.[0]);

  const pill = (
    <span className="glass inline-flex h-10 min-h-[44px] items-center gap-2 rounded-full px-2 pr-3">
      <Avatar className="h-7 w-7">
        <AvatarImage
          src={profileData?.profileImages?.[0]?.url || ""}
          alt={profileData?.name || "Universal Profile"}
        />
        <AvatarFallback className="bg-transparent p-0">
          <Image
            src="/brand/cart-favicon.png"
            alt="UP!"
            width={28}
            height={28}
            className="h-full w-full object-cover"
          />
        </AvatarFallback>
      </Avatar>
      <span className="hidden max-w-[120px] truncate text-sm font-medium text-foreground sm:inline">
        {label}
      </span>
    </span>
  );

  // In the Grid the host manages the session, so there's nothing to disconnect.
  if (isMiniApp) {
    return pill;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className="rounded-full focus:outline-none focus-visible:ring-1 focus-visible:ring-ring">
          {pill}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[160px]">
        <DropdownMenuItem disabled className="opacity-100">
          <span className="truncate text-sm font-medium">{label}</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => disconnect()}>
          <LogOut className="h-4 w-4" />
          Disconnect
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ConnectModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { connect, hasExtension, isConnecting, connectError, walletConnected } =
    useUpProvider();

  // Close automatically once the connection lands.
  useEffect(() => {
    if (walletConnected) onOpenChange(false);
  }, [walletConnected, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm rounded-2xl">
        <DialogHeader className="items-center text-center sm:text-center">
          <Image
            src="/brand/cart-favicon.png"
            alt="Universal Profile"
            width={48}
            height={48}
            className="mb-1 h-12 w-12 rounded-full"
          />
          <DialogTitle>Connect your Universal Profile</DialogTitle>
          <DialogDescription>
            {hasExtension
              ? "Approve the connection in the Universal Profile extension to continue."
              : "You'll need the Universal Profile Browser Extension to connect on this device."}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2 flex flex-col gap-2">
          {hasExtension ? (
            <Button
              type="button"
              variant="gradient"
              size="pill"
              onClick={() => connect()}
              disabled={isConnecting}
            >
              {isConnecting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Connecting…
                </>
              ) : (
                "Connect Universal Profile"
              )}
            </Button>
          ) : (
            <Button asChild variant="gradient" size="pill">
              <a href={UP_EXTENSION_URL} target="_blank" rel="noopener noreferrer">
                Install the extension
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          )}

          {connectError && (
            <p className="mt-1 text-center text-sm text-destructive">{connectError}</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
