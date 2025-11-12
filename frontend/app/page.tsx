"use client";

import { GhostVoteDemo } from "@/components/GhostVoteDemo";
import { Header } from "@/components/Header";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <GhostVoteDemo />
      </main>
    </div>
  );
}

