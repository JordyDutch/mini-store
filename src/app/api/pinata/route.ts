import { NextResponse, type NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const data = await request.formData();
    const file: File | null = data.get("file") as unknown as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Upload directly via Pinata's REST API instead of the pinata-web3 SDK.
    // The SDK's upload path targets the legacy /pinning/pinFileToIPFS endpoint and
    // swallows the upstream status, which masked the real failure as a generic 500.
    // Calling fetch directly lets us read the real status + body and surface it.
    const fd = new FormData();
    fd.append("file", file, file.name || "metadata.json");

    const res = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
      method: "POST",
      headers: {
        // Do NOT set Content-Type — fetch sets the multipart boundary itself.
        Authorization: `Bearer ${process.env.PINATA_JWT ?? ""}`,
      },
      body: fd,
    });

    if (!res.ok) {
      const body = await res.text();
      // Log the REAL upstream error server-side (status + body, never the JWT).
      console.error("Pinata upload failed", { status: res.status, body });
      return NextResponse.json(
        {
          error:
            res.status === 401 || res.status === 403
              ? "Pinata authentication failed (check PINATA_JWT pinning scope)"
              : "Pinata upload failed",
          status: res.status,
          details: body,
        },
        { status: res.status }
      );
    }

    const json = await res.json();
    const cid: string | undefined = json?.IpfsHash ?? json?.data?.cid;

    if (!cid) {
      console.error("Pinata upload returned no CID", json);
      return NextResponse.json(
        { error: "Pinata upload returned no CID" },
        { status: 502 }
      );
    }

    // Build the gateway URL directly from the CID. Consumers only need the
    // "/ipfs/<CID>" suffix (url.split('/ipfs/')[1] === CID), so a public gateway
    // fallback is sufficient when no dedicated gateway is configured.
    const gateway = (process.env.NEXT_PUBLIC_GATEWAY_URL || "")
      .replace(/^https?:\/\//, "")
      .replace(/\/+$/, "");
    const url = gateway
      ? `https://${gateway}/ipfs/${cid}`
      : `https://gateway.pinata.cloud/ipfs/${cid}`;

    // Return the bare CID alongside the gateway URL. Callers build the on-chain
    // VerifiableURI from `cid` directly — never by string-splitting `url`, which
    // breaks on subdomain/CIDv1 gateways and could encode `ipfs://undefined`.
    return NextResponse.json({ cid, url }, { status: 200 });
  } catch (e: any) {
    // Surface the real error server-side and return a non-sensitive message.
    console.error("Pinata route error", {
      name: e?.name,
      message: e?.message,
    });
    return NextResponse.json(
      { error: e?.message ?? "Internal Server Error" },
      { status: 500 }
    );
  }
}
