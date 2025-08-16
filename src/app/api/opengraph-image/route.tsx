import { ImageResponse } from "next/og";

export const dynamic = "force-dynamic";

export async function GET() {
  // const { searchParams } = new URL(request.url);
  // const fid = searchParams.get("fid");

  return new ImageResponse(
    (
      <div tw="flex h-full w-full flex-col justify-center items-center relative bg-purple-600">
        <img
          src="https://whocast.vercel.app/whocastlogo.png"
          alt="Logo"
          tw="w-16 h-16 absolute top-4 left-4"
        />
        <p tw="text-5xl mt-4 text-white opacity-80">
          Guess who dropped the cast! 🪐
        </p>
      </div>
    ),
    {
      width: 1200,
      height: 800,
    }
  );
}
