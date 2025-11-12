"use client";

import { useEffect, useState } from "react";
import { Button } from "./ui/button";
import { ThumbsUp, ThumbsDown, Loader2, CheckCircle } from "lucide-react";
import type { FhevmInstance } from "@/fhevm/fhevmTypes";

interface Proposal {
  title: string;
  description: string;
  deadline: number;
  active: boolean;
  totalVoters: number;
}

interface VotePanelProps {
  proposalId: number;
  getProposal: (proposalId: number) => Promise<Proposal>;
  vote: (proposalId: number, voteValue: number) => Promise<void>;
  hasVoted: (proposalId: number, voterAddress: string) => Promise<boolean>;
  address: string;
  fhevmInstance: FhevmInstance;
}

export function VotePanel({
  proposalId,
  getProposal,
  vote,
  hasVoted,
  address,
}: VotePanelProps) {
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [userHasVoted, setUserHasVoted] = useState(false);
  const [isVoting, setIsVoting] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadProposal = async () => {
      setLoading(true);
      try {
        const p = await getProposal(proposalId);
        setProposal(p);
        const voted = await hasVoted(proposalId, address);
        setUserHasVoted(voted);
      } catch (error) {
        console.error("Failed to load proposal:", error);
      } finally {
        setLoading(false);
      }
    };

    loadProposal();
  }, [proposalId, getProposal, hasVoted, address]);

  const handleVote = async (voteValue: number) => {
    setIsVoting(true);
    try {
      await vote(proposalId, voteValue);
      setUserHasVoted(true);
      const p = await getProposal(proposalId);
      setProposal(p);
    } catch (error) {
      console.error("Failed to vote:", error);
    } finally {
      setIsVoting(false);
    }
  };

  if (loading || !proposal) {
    return (
      <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-lg p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-700/50 rounded w-3/4"></div>
          <div className="h-20 bg-slate-700/50 rounded"></div>
          <div className="flex gap-4">
            <div className="h-12 bg-slate-700/50 rounded flex-1"></div>
            <div className="h-12 bg-slate-700/50 rounded flex-1"></div>
          </div>
        </div>
      </div>
    );
  }

  const isExpired = Date.now() / 1000 > proposal.deadline;
  const canVote = proposal.active && !isExpired && !userHasVoted;

  return (
    <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-lg p-6">
      <h2 className="text-2xl font-bold text-white mb-2">{proposal.title}</h2>
      <p className="text-slate-300 mb-6">{proposal.description}</p>

      <div className="mb-6 p-4 bg-slate-700/30 rounded-lg">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-slate-400">Deadline:</span>
            <p className="text-white font-medium">
              {new Date(proposal.deadline * 1000).toLocaleString()}
            </p>
          </div>
          <div>
            <span className="text-slate-400">Total Voters:</span>
            <p className="text-white font-medium">{proposal.totalVoters}</p>
          </div>
        </div>
      </div>

      {userHasVoted ? (
        <div className="flex items-center justify-center p-4 bg-green-500/20 border border-green-500/30 rounded-lg">
          <CheckCircle className="w-5 h-5 text-green-400 mr-2" />
          <span className="text-green-300 font-medium">
            You have already voted on this proposal
          </span>
        </div>
      ) : !canVote ? (
        <div className="text-center p-4 bg-slate-700/30 rounded-lg">
          <span className="text-slate-400">
            {!proposal.active
              ? "Proposal is closed"
              : isExpired
                ? "Voting period has ended"
                : "Unable to vote"}
          </span>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          <Button
            onClick={() => handleVote(1)}
            disabled={isVoting}
            className="h-16 bg-green-600 hover:bg-green-700 text-white text-lg font-semibold"
          >
            {isVoting ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
              <>
                <ThumbsUp className="w-6 h-6 mr-2" />
                Vote FOR
              </>
            )}
          </Button>
          <Button
            onClick={() => handleVote(0)}
            disabled={isVoting}
            className="h-16 bg-red-600 hover:bg-red-700 text-white text-lg font-semibold"
          >
            {isVoting ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
              <>
                <ThumbsDown className="w-6 h-6 mr-2" />
                Vote AGAINST
              </>
            )}
          </Button>
        </div>
      )}

      <div className="mt-4 p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg">
        <p className="text-sm text-purple-300">
          🔒 Your vote is fully encrypted using FHEVM. Only the admin can
          decrypt the final results.
        </p>
      </div>
    </div>
  );
}
