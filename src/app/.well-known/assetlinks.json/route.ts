import { NextResponse } from "next/server";

import { androidAssetLinks, mobileAppAssociationHeaders } from "@/lib/mobileAppLinks";

export const dynamic = "force-static";

export async function GET() {
  return NextResponse.json(androidAssetLinks, {
    status: 200,
    headers: mobileAppAssociationHeaders,
  });
}
