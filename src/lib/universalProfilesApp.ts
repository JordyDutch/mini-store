import type { Metadata } from "next";

import { absoluteUrl } from "@/lib/site";

export type MetadataSearchParams = Record<
  string,
  string | string[] | undefined
>;

export const universalProfilesAppStoreId = "6702018631";

export function pathWithSearchParams(
  pathname: string,
  searchParams: MetadataSearchParams = {},
): string {
  const params = new URLSearchParams();

  Object.entries(searchParams).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((item) => params.append(key, item));
      return;
    }

    if (typeof value === "string") {
      params.set(key, value);
    }
  });

  const search = params.toString();
  return search ? `${pathname}?${search}` : pathname;
}

export function buildUniversalProfilesAppArgument(pathname: string): string {
  // The app association routes let iOS hand this HTTPS URL to the native app.
  return absoluteUrl(pathname);
}

export function buildUniversalProfilesItunesMeta(
  pathname: string,
): NonNullable<Metadata["itunes"]> {
  return {
    appId: universalProfilesAppStoreId,
    appArgument: buildUniversalProfilesAppArgument(pathname),
  };
}
