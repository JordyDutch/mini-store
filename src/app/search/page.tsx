import type { Metadata } from "next";

import StoreDirectoryExperience from "@/components/StoreDirectoryExperience";
import {
  buildUniversalProfilesItunesMeta,
  pathWithSearchParams,
  type MetadataSearchParams,
} from "@/lib/universalProfilesApp";

interface SearchPageProps {
  searchParams?: Promise<MetadataSearchParams>;
}

export async function generateMetadata({
  searchParams,
}: SearchPageProps): Promise<Metadata> {
  const resolvedSearchParams = searchParams ? await searchParams : {};

  return {
    title: "Search Apps | LUKSO UP! Store",
    description: "Search and browse all apps in the LUKSO UP! Store.",
    itunes: buildUniversalProfilesItunesMeta(
      pathWithSearchParams("/search", resolvedSearchParams),
    ),
  };
}

export default function SearchPageRoute() {
  return <StoreDirectoryExperience />;
}
