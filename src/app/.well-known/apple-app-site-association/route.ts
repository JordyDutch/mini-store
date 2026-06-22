import { NextResponse } from "next/server";

import {
  appleAppSiteAssociation,
  mobileAppAssociationHeaders,
} from "@/lib/mobileAppLinks";

export const dynamic = "force-static";

export async function GET() {
  return NextResponse.json(appleAppSiteAssociation, {
    status: 200,
    headers: mobileAppAssociationHeaders,
  });
}
