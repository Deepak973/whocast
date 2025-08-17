import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return new ImageResponse(
    (
      <div tw="flex h-full w-full flex-col justify-center items-center relative bg-primary">
        <div tw="flex w-96 h-96 rounded-full overflow-hidden mb-8 border-8 border-white">
          <img
            src={"https://farcastersnake.vercel.app/logo.jpg"}
            alt="Farcaster Snake"
            tw="w-full h-full object-cover"
          />
        </div>

        <h1 tw="text-8xl text-purple-500">Eat, Drink, Poop Repeat</h1>
      </div>
    ),
    {
      width: 1200,
      height: 800,
    }
  );
}
