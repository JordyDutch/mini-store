import type { Metadata } from "next";

import StoreDirectoryExperience from "@/components/StoreDirectoryExperience";
import { buildUniversalProfilesItunesMeta } from "@/lib/universalProfilesApp";

export const metadata: Metadata = {
  itunes: buildUniversalProfilesItunesMeta("/store"),
};

export default function StorePage() {
  return <StoreDirectoryExperience />;
}
