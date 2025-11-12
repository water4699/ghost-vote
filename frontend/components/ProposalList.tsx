"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface Proposal {
  title: string;
  description: string;
  deadline: number;
  active: boolean;
  totalVoters: number;
}

interface ProposalListProps {
  proposalCount: number;
  getProposal: (proposalId: number) => Promise<Proposal>;
  selectedProposalId: number | null;
  onSelectProposal: (proposalId: number) => void;
}

export function ProposalList({
  proposalCount,
  getProposal,
  selectedProposalId,
  onSelectProposal,
}: ProposalListProps) {
  const [proposals, setProposals] = useState<
    (Proposal & { id: number })[]
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadProposals = async () => {
      setLoading(true);
      try {
        const proposalPromises = Array.from(
          { length: proposalCount },
          (_, i) => getProposal(i).then((p) => ({ ...p, id: i }))
        );
        const loadedProposals = await Promise.all(proposalPromises);
        setProposals(loadedProposals.reverse());
      } catch (error) {
        console.error("Failed to load proposals:", error);
      } finally {
        setLoading(false);
      }
    };

    if (proposalCount > 0) {
      loadProposals();
    } else {
      setProposals([]);
      setLoading(false);
    }
  }, [proposalCount, getProposal]);

  const isExpired = (deadline: number) => {
    return Date.now() / 1000 > deadline;
  };

  if (loading) {
    return (
      <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6 h-full">
        <h2 className="text-xl font-bold text-white mb-4">All Proposals</h2>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-slate-700/30 rounded-lg p-4 animate-pulse"
            >
              <div className="h-5 bg-slate-600/50 rounded w-3/4 mb-2"></div>
              <div className="h-4 bg-slate-600/50 rounded w-1/2"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (proposals.length === 0) {
    return (
      <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6 h-full">
        <h2 className="text-xl font-bold text-white mb-4">All Proposals</h2>
        <div className="text-center py-12">
          <p className="text-slate-400 mb-2">No proposals yet</p>
          <p className="text-sm text-slate-500">Create the first one! 👈</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6 h-full">
      <h2 className="text-xl font-bold text-white mb-4">
        All Proposals ({proposals.length})
      </h2>
      <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
        {proposals.map((proposal) => {
          const expired = isExpired(proposal.deadline);
          const isSelected = selectedProposalId === proposal.id;

          return (
            <button
              key={proposal.id}
              onClick={() => onSelectProposal(proposal.id)}
              className={cn(
                "w-full text-left p-4 rounded-lg border transition-all hover:scale-[1.02]",
                isSelected
                  ? "bg-purple-600/30 border-purple-500/50 shadow-lg shadow-purple-500/20"
                  : "bg-slate-700/30 border-slate-600/30 hover:bg-slate-700/50"
              )}
            >
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-semibold text-white line-clamp-1 flex-1">
                  #{proposal.id} {proposal.title}
                </h3>
                {proposal.active && !expired ? (
                  <Clock className="w-4 h-4 text-green-400 flex-shrink-0 ml-2" />
                ) : proposal.active && expired ? (
                  <XCircle className="w-4 h-4 text-yellow-400 flex-shrink-0 ml-2" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-slate-400 flex-shrink-0 ml-2" />
                )}
              </div>
              <p className="text-sm text-slate-300 line-clamp-2 mb-3">
                {proposal.description}
              </p>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">
                  👥 {proposal.totalVoters} votes
                </span>
                <span
                  className={cn(
                    "px-2 py-1 rounded font-medium",
                    proposal.active && !expired
                      ? "bg-green-500/20 text-green-300"
                      : proposal.active && expired
                        ? "bg-yellow-500/20 text-yellow-300"
                        : "bg-slate-500/20 text-slate-300"
                  )}
                >
                  {proposal.active && !expired
                    ? "Active"
                    : proposal.active && expired
                      ? "Expired"
                      : "Closed"}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
