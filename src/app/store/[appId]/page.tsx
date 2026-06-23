import type { Metadata } from "next";
import { notFound } from "next/navigation";

import StoreDirectoryExperience from "@/components/StoreDirectoryExperience";
import { apps } from "@/data/appCatalog";
import { serializeApp } from "@/lib/catalog";
import { buildUniversalProfilesItunesMeta } from "@/lib/universalProfilesApp";

interface StoreAppPageProps {
  params: Promise<{
    appId: string;
  }>;
}

export function generateStaticParams() {
  return Object.values(apps).flatMap((app) => {
    if (!app.id) return [];
    return [{ appId: app.id }];
  });
}

export async function generateMetadata({
  params,
}: StoreAppPageProps): Promise<Metadata> {
  const { appId } = await params;
  const app = apps[appId];
  const appPath = `/store/${encodeURIComponent(appId)}`;

  if (!app) {
    return {
      title: "App not found | LUKSO UP! Store",
      itunes: buildUniversalProfilesItunesMeta(appPath),
    };
  }

  const description = [
    app.developer || app.publisherProfile,
    app.categories.slice(0, 3).join(", "),
  ]
    .filter(Boolean)
    .join(" - ");

  return {
    title: `${app.app.name} | LUKSO UP! Store`,
    description: description || "Discover this app on the LUKSO UP! Store.",
    itunes: buildUniversalProfilesItunesMeta(appPath),
    openGraph: {
      title: `${app.app.name} | LUKSO UP! Store`,
      description: description || "Discover this app on the LUKSO UP! Store.",
      images: app.banner ? [app.banner] : app.icon ? [app.icon] : [],
    },
  };
}

export default async function StoreAppPage({ params }: StoreAppPageProps) {
  const { appId } = await params;
  const app = apps[appId];

  if (!app) {
    notFound();
  }

  // Per-app structured data so search engines and agents can read the app, its
  // category, and the one-click add-to-grid (install) URL.
  const data = serializeApp(app);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: data.name,
    description: data.description,
    applicationCategory: data.categories[0] ?? "Mini-App",
    operatingSystem: "LUKSO Universal Profile (Web)",
    url: data.detailUrl,
    installUrl: data.addToGridUrl,
    ...(data.iconUrl ? { image: data.iconUrl } : {}),
    author: { "@type": "Organization", name: data.developer },
    isAccessibleForFree: true,
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    ...(data.sourceCode ? { softwareHelp: data.sourceCode } : {}),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <StoreDirectoryExperience initialAppId={appId} />
    </>
  );
}
