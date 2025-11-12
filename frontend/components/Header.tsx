"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Ghost, Sparkles } from "lucide-react";

export function Header() {
  return (
    <header className="border-b border-white/10 bg-black/30 backdrop-blur-md sticky top-0 z-50">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="absolute inset-0 bg-purple-500 rounded-full blur-xl opacity-50 animate-pulse"></div>
              <div className="relative w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                <Ghost className="w-7 h-7 text-white" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                  GhostVote
                </h1>
                <Sparkles className="w-4 h-4 text-purple-400" />
              </div>
              <p className="text-sm text-purple-300">DAO Privacy Voting</p>
            </div>
          </div>
          <ConnectButton />
        </div>
      </div>
    </header>
  );
}
