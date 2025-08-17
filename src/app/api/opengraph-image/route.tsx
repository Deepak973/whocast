import { ImageResponse } from "next/og";

export const dynamic = "force-dynamic";

export async function GET() {
  return new ImageResponse(
    (
      <div tw="flex h-full w-full relative bg-black">
        <img
          src={"https://whocast.vercel.app/whocastlogo.png"}
          alt="WhoCast"
          tw="w-full h-full object-cover"
        />
        <div tw="absolute bottom-0 left-0 right-0 p-4 bg-black/50">
          <p tw="text-white text-2xl font-bold">WhoCast</p>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 800,
    }
  );
}
