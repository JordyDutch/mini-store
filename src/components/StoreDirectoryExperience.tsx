"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Compass, Search } from "lucide-react";

import AppDetailPage from "@/components/AppDetailPage";
import NavSwitch from "@/components/NavSwitch";
import SearchPage from "@/components/SearchPage";
import Footer from "@/components/Footer";
import { ThemeToggle } from "@/components/ThemeToggle";
import UpConnect from "@/components/UpConnect";
import { Wordmark } from "@/components/Wordmark";
import { apps, type App } from "@/data/appCatalog";

interface StoreDirectoryExperienceProps {
  initialAppId?: string;
}

const getAppById = (appId?: string) => {
  if (!appId) return null;
  return apps[appId] ?? null;
};

export default function StoreDirectoryExperience({ initialAppId }: StoreDirectoryExperienceProps) {
  const router = useRouter();
  const [selectedApp, setSelectedApp] = useState<App | null>(() => getAppById(initialAppId));

  useEffect(() => {
    setSelectedApp(getAppById(initialAppId));
  }, [initialAppId]);

  const handleAppClick = (app: App) => {
    window.scrollTo(0, 0);
    setSelectedApp(app);
    if (app.id) {
      router.push(`/store/${encodeURIComponent(app.id)}`);
    }
  };

  const handleBack = () => {
    window.scrollTo(0, 0);
    setSelectedApp(null);
    router.replace("/store");
  };

  if (selectedApp) {
    return <AppDetailPage app={selectedApp} onBack={handleBack} />;
  }

  return (
    <div className="flex min-h-[100dvh] flex-col bg-background">
      <StoreNavbar />
      <div className="flex-1">
        <SearchPage onAppClick={handleAppClick} />
      </div>
      <Footer />
    </div>
  );
}

function StoreNavbar() {
  return (
    <header className="glass-nav sticky top-0 z-40 pt-safe">
      <div className="mx-auto flex h-[52px] w-full max-w-[1200px] items-center justify-between px-4 md:h-16 md:px-6">
        <Link href="/" aria-label="Go to UP!Store home">
          <Wordmark />
        </Link>

        <div className="flex items-center gap-2 md:gap-3">
          <nav className="hidden items-center gap-1 md:flex" aria-label="Store sections">
            <Link
              href="/"
              className="relative flex h-9 min-h-[44px] items-center gap-1.5 px-3 text-sm font-medium text-text-secondary transition-colors hover:text-foreground"
            >
              <Compass className="h-4 w-4" aria-hidden="true" />
              Explore
            </Link>
            <span
              aria-current="page"
              className="relative flex h-9 min-h-[44px] items-center gap-1.5 px-3 text-sm font-medium text-brand-text"
            >
              <Search className="h-4 w-4" aria-hidden="true" />
              Search
              <span
                aria-hidden="true"
                className="absolute inset-x-3 -bottom-0.5 h-0.5 rounded-full bg-brand"
              />
            </span>
          </nav>

          <ThemeToggle />

          <UpConnect />
        </div>
      </div>

      <div className="border-t border-border px-4 py-2 md:hidden">
        <NavSwitch active="search" />
      </div>
    </header>
  );
}
