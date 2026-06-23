import type { Metadata } from "next";

import BookmarksExperience from "@/components/BookmarksExperience";
import { buildUniversalProfilesItunesMeta } from "@/lib/universalProfilesApp";

export const metadata: Metadata = {
  itunes: buildUniversalProfilesItunesMeta("/bookmarks"),
};

export default function BookmarksPage() {
  return <BookmarksExperience />;
}
