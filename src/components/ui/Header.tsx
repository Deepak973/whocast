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
    <div className="relative -mx-4 mb-6">
      <div className="py-3 px-4 bg-white/5 backdrop-blur-sm text-white flex items-center justify-between border-b border-purple-400/30">
        {/* Logo Section */}
        <div className="flex items-center space-x-2">
          <img
            src="/whocastlogo.png"
            alt="WhoCast"
            className="w-6 h-6 drop-shadow-sm"
          />
          <div className="text-lg font-bold bg-gradient-to-r from-white to-purple-200 bg-clip-text text-transparent">
            WhoCast
          </div>
        </div>

        {/* User Profile Section */}
        {context?.user && (
          <div
            className="cursor-pointer relative"
            onClick={() => {
              setIsUserDropdownOpen(!isUserDropdownOpen);
            }}
          >
            {context.user.pfpUrl && (
              <img
                src={context.user.pfpUrl}
                alt="Profile"
                className="w-8 h-8 rounded-full border border-purple-400/30 hover:border-purple-400 transition-all duration-200"
              />
            )}
          </div>
        )}
      </div>

      {/* User Dropdown */}
      {context?.user && isUserDropdownOpen && (
        <div className="absolute top-full right-0 z-50 w-fit mt-1 bg-white/10 backdrop-blur-sm text-white rounded-xl shadow-xl border border-purple-400/30">
          <div className="p-3 space-y-2">
            <div className="text-right">
              <h3
                className="font-bold text-sm hover:underline cursor-pointer inline-block text-white"
                onClick={() =>
                  sdk.actions.viewProfile({ fid: context.user.fid })
                }
              >
                {context.user.displayName || context.user.username}
              </h3>
              <p className="text-xs text-purple-200">
                @{context.user.username}
              </p>
              <p className="text-xs text-purple-200">FID: {context.user.fid}</p>
              {neynarUser && (
                <p className="text-xs text-purple-200">
                  Neynar Score: {neynarUser.score}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
