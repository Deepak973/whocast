"use client";

import { useState } from "react";
import sdk from "@farcaster/frame-sdk";
import { useMiniApp } from "@neynar/react";

type HeaderProps = {
  neynarUser?: {
    fid: number;
    score: number;
  } | null;
};

export function Header({ neynarUser }: HeaderProps) {
  const { context } = useMiniApp();
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);

  return (
    <div className="relative -mx-4 -mt-4 mb-6">
      <div className="py-4 px-4 bg-gradient-to-r from-purple-900/90 via-indigo-900/90 to-purple-900/90 backdrop-blur-md text-white flex items-center justify-between border-b border-purple-400/40 shadow-lg">
        {/* Logo Section */}
        <div className="flex items-center space-x-3">
          <div className="relative">
            <img
              src="/whocastlogo.png"
              alt="WhoCast"
              className="w-7 h-7 drop-shadow-lg"
            />
            <div className="absolute -inset-1 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full opacity-20 blur-sm"></div>
          </div>
          <div className="text-xl font-black bg-gradient-to-r from-white via-purple-100 to-pink-200 bg-clip-text text-transparent tracking-wide">
            WhoCast
          </div>
        </div>

        {/* User Profile Section */}
        {context?.user && (
          <div
            className="cursor-pointer relative group"
            onClick={() => {
              setIsUserDropdownOpen(!isUserDropdownOpen);
            }}
          >
            {context.user.pfpUrl && (
              <div className="relative">
                <img
                  src={context.user.pfpUrl}
                  alt="Profile"
                  className="w-9 h-9 rounded-full border-2 border-purple-400/40 hover:border-purple-300 transition-all duration-300 shadow-lg"
                />
                <div className="absolute -inset-1 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full opacity-0 group-hover:opacity-20 transition-opacity duration-300 blur-sm"></div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* User Dropdown */}
      {context?.user && isUserDropdownOpen && (
        <div className="absolute top-full right-0 z-50 w-fit mt-2 bg-gradient-to-br from-purple-900/95 via-indigo-900/95 to-purple-900/95 backdrop-blur-md text-white rounded-2xl shadow-2xl border border-purple-400/40">
          <div className="p-4 space-y-3">
            <div className="text-right">
              <h3
                className="font-bold text-sm hover:underline cursor-pointer inline-block text-white hover:text-purple-200 transition-colors duration-200"
                onClick={() =>
                  sdk.actions.viewProfile({ fid: context.user.fid })
                }
              >
                {context.user.displayName || context.user.username}
              </h3>
              <p className="text-xs text-purple-300 font-medium">
                @{context.user.username}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
