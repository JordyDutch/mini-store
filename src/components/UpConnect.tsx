"use client";

import Image from "next/image";
import { LogOut } from "lucide-react";

import { useUpProvider } from "@/app/components/providers/upProvider";
import { useProfile } from "@/app/components/providers/profileProvider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * Connection control for the header. Renders, by context:
 * - connected (Grid or standalone) → the Universal Profile pill (with a disconnect
 *   menu when standalone, since the Grid host owns the connection there);
 * - standalone, disconnected → a "Connect" button that opens LUKSO's UP-Modal
 *   (UP Browser Extension + Universal Profiles mobile app via WalletConnect + EOAs);
 * - Grid, disconnected → nothing (the host injects the connection on its own).
 */
export default function UpConnect() {
  const { walletConnected, isMiniApp, isLoading, connect } = useUpProvider();

  // Connected: show the profile pill. Profile metadata loads asynchronously and
  // the pill degrades gracefully (UP logo + shortened address) until it arrives.
  if (walletConnected) {
    return <ProfilePill isMiniApp={isMiniApp} />;
  }

  // Inside the Grid the connection is injected by the parent page — there's
  // nothing for the user to click. Wait for the host instead.
  if (isMiniApp || isLoading) {
    return null;
  }

  // Standalone, not connected: open the UP-Modal sign-in dialog.
  return (
    <Button
      type="button"
      variant="glass"
      size="pill"
      onClick={() => void connect()}
      className="text-sm font-medium"
    >
      Connect
    </Button>
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
