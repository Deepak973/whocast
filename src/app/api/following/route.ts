import { NextResponse } from "next/server";
import { verifyAuth } from "~/lib/auth";
import { NeynarAPIClient } from "@neynar/nodejs-sdk";

export async function GET(request: Request) {
  const apiKey = process.env.NEYNAR_API_KEY;
  const { searchParams } = new URL(request.url);
  const limit = searchParams.get("limit") || "50";
  const fidParam = searchParams.get("fid");

  // Try to get FID from query parameter first, then from auth
  let fid = fidParam ? parseInt(fidParam) : null;

  if (!fid) {
    fid = await verifyAuth(request);
  }

  if (!fid) {
    return NextResponse.json(
      { error: "Unauthorized - FID required" },
      { status: 401 }
    );
  }

  if (!apiKey) {
    return NextResponse.json(
      { error: "Neynar API key is not configured" },
      { status: 500 }
    );
  }

  try {
    const response = await fetch(
      `https://api.neynar.com/v2/farcaster/following?fid=${fid}&limit=${limit}`,
      {
        headers: {
          "x-api-key": apiKey,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Neynar API error response: ${errorText}`);
      throw new Error(`Neynar API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return NextResponse.json({ following: data.users });
  } catch (error) {
    console.error("Failed to fetch following:", error);
    return NextResponse.json(
      { error: "Failed to fetch following list" },
      { status: 500 }
    );
  }
}
