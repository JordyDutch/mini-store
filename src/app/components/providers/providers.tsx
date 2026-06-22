"use client";

import { ReactNode } from "react";
import { UpProvider } from "./upProvider";
import { Toaster } from "sonner";
import { ApolloProvider } from '@apollo/client';
import { client } from '../apollo/apolloClient';
import { ProfileProvider } from "./profileProvider";
import { GridProvider } from "./gridProvider";
import { BookmarksProvider } from "./bookmarksProvider";
import { ThemeProvider } from "./themeProvider";
import LoadingSplash from "@/components/LoadingSplash";
import BookmarkSaveBar from "@/components/BookmarkSaveBar";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <UpProvider>
      <ThemeProvider>
        <ApolloProvider client={client}>
          <ProfileProvider>
            <GridProvider>
              <BookmarksProvider>
                <Toaster />
                {/* Single, session-scoped splash. Mounted once here so it shows on
                    the first view of the session but never on client-side page
                    navigation. */}
                <LoadingSplash />
                {children}
                <BookmarkSaveBar />
              </BookmarksProvider>
            </GridProvider>
          </ProfileProvider>
        </ApolloProvider>
      </ThemeProvider>
    </UpProvider>
  );
}