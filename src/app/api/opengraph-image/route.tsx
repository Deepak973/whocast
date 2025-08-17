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
        <h1 tw="text-8xl text-purple-500 font-bold edu-nsw-act-cursive">
          Who Cast
        </h1>
      </div>
    ),
    {
      width: 1200,
      height: 800,
    }
  );
}
