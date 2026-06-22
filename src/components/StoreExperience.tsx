"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { Compass } from "lucide-react";

import { Wordmark } from "@/components/Wordmark";
import { ThemeToggle } from "@/components/ThemeToggle";
import UpConnect from "@/components/UpConnect";
import Footer from "@/components/Footer";
import NavSwitch from "@/components/NavSwitch";
import ExplorePage from "@/components/ExplorePage";
import AppDetailPage from "@/components/AppDetailPage";
import { App } from "@/data/appCatalog";
import { cn } from "@/lib/utils";

type Tab = "explore";

export interface StoreExperienceProps {
  /**
   * "auto"  -> route '/'. Renders the full store in BOTH desktop and grid.
   * "standalone" -> route '/store'. Shareable full-screen storefront.
   * Context (grid vs standalone) is still detected at runtime via useUpProvider.
   */
  variant?: "auto" | "standalone";
}

const TABS: { id: Tab; label: string; icon: typeof Compass }[] = [
  { id: "explore", label: "Explore", icon: Compass },
];

const STORE_LINK = { href: "/store", label: "Search" };

export default function StoreExperience({ variant = "auto" }: StoreExperienceProps) {
  const router = useRouter();
  const prefersReducedMotion = useReducedMotion();

  const [activeTab, setActiveTab] = useState<Tab>("explore");
  const [selectedApp, setSelectedApp] = useState<App | null>(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const isScrolled = window.scrollY > 10;
      setScrolled((prev) => (prev !== isScrolled ? isScrolled : prev));
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleAppClick = (app: App) => {
    window.scrollTo(0, 0);
    if (app.id) {
      router.push(`/store/${encodeURIComponent(app.id)}`);
      return;
    }
    setSelectedApp(app);
  };

  const handleBackFromApp = () => {
    window.scrollTo(0, 0);
    setSelectedApp(null);
  };

  const handleTabChange = (tab: Tab) => {
    window.scrollTo(0, 0);
    setActiveTab(tab);
    setSelectedApp(null);
  };

  const renderContent = () => {
    if (selectedApp) {
      return <AppDetailPage app={selectedApp} onBack={handleBackFromApp} />;
    }
    switch (activeTab) {
      case "explore":
      default:
        return <ExplorePage onAppClick={handleAppClick} />;
    }
  };

  return (
    <div className="relative flex min-h-[100dvh] w-full flex-col bg-background">
      {/* Ambient brand glow anchored top-center */}
      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-glow-ambient",
          !prefersReducedMotion && "animate-glow-drift"
        )}
      />

      {/* ---- Sticky glass header ---- */}
      <header
        className={cn(
          "glass-nav sticky top-0 z-30 pt-safe transition-shadow duration-200",
          scrolled && "shadow-glass"
        )}
      >
        <div className="mx-auto flex h-[52px] w-full max-w-[1200px] items-center justify-between px-4 md:h-16 md:px-6">
          <Wordmark />

          <div className="flex items-center gap-2 md:gap-3">
            {/* Desktop tab links */}
            <nav className="hidden items-center gap-1 md:flex" aria-label="Store sections">
              {TABS.map((t) => {
                const isActive = activeTab === t.id && !selectedApp;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => handleTabChange(t.id)}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "relative inline-flex h-9 items-center px-3 text-sm font-medium transition-colors",
                      isActive
                        ? "text-brand-text"
                        : "text-text-secondary hover:text-foreground"
                    )}
                  >
                    {t.label}
                    {isActive && (
                      <span
                        aria-hidden="true"
                        className="absolute inset-x-3 -bottom-0.5 h-0.5 rounded-full bg-brand"
                      />
                    )}
                  </button>
                );
              })}
              <Link
                href={STORE_LINK.href}
                className="relative flex h-9 items-center px-3 text-sm font-medium text-text-secondary transition-colors hover:text-foreground"
              >
                {STORE_LINK.label}
              </Link>
            </nav>

            <ThemeToggle />

            {/* Connection-aware slot: connect modal / profile pill */}
            <UpConnect />
          </div>
        </div>

        {/* ---- Mobile Explore / Search liquid-glass switch ---- */}
        <div className="border-t border-border px-4 py-2 md:hidden">
          <NavSwitch active="explore" onExplore={() => handleTabChange("explore")} />
        </div>
      </header>

      {/* ---- Main content ---- */}
      <main className="relative z-10 flex-1">
        <motion.div
          key={selectedApp ? "detail" : activeTab}
          initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto w-full max-w-[1200px] px-4 py-6 pb-safe-content md:px-6"
        >
          {renderContent()}
        </motion.div>
      </main>

      {/* Footer — list/discover view only; the detail takeover keeps its own chrome. */}
      {!selectedApp && <Footer />}
    </div>
  );
}
