import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const apiKey = process.env.NEYNAR_API_KEY;
  const { searchParams } = new URL(request.url);
  const fid = searchParams.get("fid");
  const limit = searchParams.get("limit") || "10";

  // For casts API, we don't need to verify the user's auth since we're fetching casts for a specific FID
  // The FID parameter is required and sufficient

  if (!apiKey) {
    return NextResponse.json(
      { error: "Neynar API key is not configured" },
      { status: 500 }
    );
  }

  if (!fid) {
    return NextResponse.json(
      { error: "FID parameter is required" },
      { status: 400 }
    );
  }

  try {
    const response = await fetch(
      `https://api.neynar.com/v2/farcaster/feed/user/replies_and_recasts/?filter=all&limit=${limit}&fid=${fid}`,
      {
        headers: {
          "x-api-key": apiKey,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Neynar API error: ${response.statusText}`);
    }

    const data = await response.json();
    return NextResponse.json({ casts: data.casts });
  } catch (error) {
    console.error("Failed to fetch casts:", error);
    return NextResponse.json(
      { error: "Failed to fetch casts" },
      { status: 500 }
    );
  }
}
