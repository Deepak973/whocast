import { ImageResponse } from "next/og";

export const dynamic = "force-dynamic";

export async function GET() {
  return new ImageResponse(
    (
      <div tw="flex h-full w-full relative">
        <img
          src={"https://whocast.vercel.app/og-image.png"}
          alt="WhoCast"
          tw="w-full h-full object-cover"
        />
      </div>
    ),
    {
      width: 1200,
      height: 800,
    }
  );
}
