import { ImageResponse } from "next/og";

export const dynamic = "force-dynamic";

export async function GET() {
  return new ImageResponse(
    (
      <div tw="flex h-full w-full flex-col justify-center items-center relative bg-gradient-to-br from-purple-900 via-indigo-900 to-pink-900">
        {/* Background Pattern */}
        <div tw="absolute inset-0 opacity-10">
          <div tw="absolute top-20 left-20 w-32 h-32 bg-purple-400 rounded-full blur-3xl"></div>
          <div tw="absolute bottom-20 right-20 w-40 h-40 bg-pink-400 rounded-full blur-3xl"></div>
          <div tw="absolute top-1/2 left-1/3 w-24 h-24 bg-indigo-400 rounded-full blur-2xl"></div>
        </div>

        {/* Logo */}
        <img
          src="https://whocast.vercel.app/whocastlogo.png"
          alt="WhoCast Logo"
          tw="w-20 h-20 mb-8 drop-shadow-lg"
        />

        {/* Main Text */}
        <div tw="text-center">
          <h1 tw="text-6xl font-bold text-white mb-4 drop-shadow-lg">
            WhoCast
          </h1>
          <p tw="text-2xl text-purple-200 opacity-90 max-w-2xl leading-relaxed">
            Guess who dropped the cast! 🪐
          </p>
          <p tw="text-lg text-purple-300 opacity-80 mt-4">
            Test your knowledge of your Farcaster friends
          </p>
        </div>

        {/* Decorative Elements */}
        <div tw="absolute bottom-8 left-8 text-purple-300 text-lg opacity-60">
          🎮 Quiz Game
        </div>
        <div tw="absolute bottom-8 right-8 text-purple-300 text-lg opacity-60">
          🏆 Score Points
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 800,
    }
  );
}
