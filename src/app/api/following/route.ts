import { NextResponse } from "next/server";
import { NeynarAPIClient } from "@neynar/nodejs-sdk";

export async function GET(request: Request) {
  const apiKey = process.env.NEYNAR_API_KEY;
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") || "";
  const limit = searchParams.get("limit") || "50";
  const fidParam = searchParams.get("fid");

  if (!apiKey) {
    return NextResponse.json(
      { error: "Neynar API key is not configured" },
      { status: 500 }
    );
  }

  // Try to get FID from query parameter first, then from auth
  const fid = fidParam ? parseInt(fidParam) : null;

  if (!fid) {
    return NextResponse.json(
      { error: "Unauthorized - FID required" },
      { status: 401 }
    );
  }

  try {
    const neynar = new NeynarAPIClient({ apiKey });

    // Fetch user's following list
    const { users } = await neynar.fetchUserFollowing({
      fid: fid,
      limit: parseInt(limit),
    });

    // Filter users based on search query if provided
    let filteredUsers = users;
    if (query.trim()) {
      const searchLower = query.toLowerCase();
      filteredUsers = users.filter(
        (user) =>
          user.user?.username?.toLowerCase().includes(searchLower) ||
          user.user?.display_name?.toLowerCase().includes(searchLower)
      );
    }

    return NextResponse.json({ users: filteredUsers });
  } catch (error) {
    console.error("Failed to fetch following:", error);
    return NextResponse.json(
      { error: "Failed to fetch following list" },
      { status: 500 }
    );
  }
}
