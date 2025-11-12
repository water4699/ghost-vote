"use client";

import { useState } from "react";
import { Button } from "./ui/button";
import { Eye, Lock, Loader2 } from "lucide-react";

interface Proposal {
  title: string;
  description: string;
  deadline: number;
  active: boolean;
  totalVoters: number;
}

interface ResultsPanelProps {
  proposalId: number;
  getProposal: (proposalId: number) => Promise<Proposal>;
  decryptVoteTotals: (proposalId: number) => Promise<{ votesFor: number; votesAgainst: number }>;
  closeProposal: (proposalId: number) => Promise<void>;
  isAdmin: boolean;
}

export function ResultsPanel({
  proposalId,
  decryptVoteTotals,
  closeProposal,
  isAdmin,
}: ResultsPanelProps) {
  const [decryptedFor, setDecryptedFor] = useState<number | null>(null);
  const [decryptedAgainst, setDecryptedAgainst] = useState<number | null>(null);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  const handleDecrypt = async () => {
    setIsDecrypting(true);
    try {
      const results = await decryptVoteTotals(proposalId);
      setDecryptedFor(results.votesFor);
      setDecryptedAgainst(results.votesAgainst);
    } catch (error) {
      console.error("Failed to decrypt:", error);
      alert("Failed to decrypt results. Please make sure you have granted decryption permission.");
    } finally {
      setIsDecrypting(false);
    }
  };

  const handleClose = async () => {
    if (!isAdmin) {
      alert("Only admin can close proposals");
      return;
    }

    setIsClosing(true);
    try {
      await closeProposal(proposalId);
    } catch (error) {
      console.error("Failed to close proposal:", error);
      alert("Failed to close proposal");
    } finally {
      setIsClosing(false);
    }
  };

  return (
    <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-lg p-6">
      <h2 className="text-xl font-bold text-white mb-4">Voting Results</h2>

      {decryptedFor !== null && decryptedAgainst !== null ? (
        <div className="space-y-4">
          <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-green-300 font-medium">Votes FOR</span>
              <span className="text-2xl font-bold text-green-400">
                {decryptedFor}
              </span>
            </div>
            <div className="mt-2 h-2 bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500"
                style={{
                  width: `${decryptedFor + decryptedAgainst > 0 ? (decryptedFor / (decryptedFor + decryptedAgainst)) * 100 : 0}%`,
                }}
              />
            </div>
          </div>

          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-red-300 font-medium">Votes AGAINST</span>
              <span className="text-2xl font-bold text-red-400">
                {decryptedAgainst}
              </span>
            </div>
            <div className="mt-2 h-2 bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-red-500"
                style={{
                  width: `${decryptedFor + decryptedAgainst > 0 ? (decryptedAgainst / (decryptedFor + decryptedAgainst)) * 100 : 0}%`,
                }}
              />
            </div>
          </div>

          <div className="text-center text-slate-300">
            Total Votes: {decryptedFor + decryptedAgainst}
          </div>
        </div>
      ) : (
        <div className="text-center py-12">
          <Lock className="w-16 h-16 text-purple-400 mx-auto mb-4" />
          <p className="text-slate-300 mb-6">
            Results are encrypted. Anyone can decrypt them.
          </p>
          <Button
            onClick={handleDecrypt}
            disabled={isDecrypting}
            className="bg-purple-600 hover:bg-purple-700 text-white"
          >
            {isDecrypting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Decrypting...
              </>
            ) : (
              <>
                <Eye className="w-4 h-4 mr-2" />
                Decrypt Results
              </>
            )}
          </Button>
        </div>
      )}

      {isAdmin && (
        <div className="mt-6 pt-6 border-t border-slate-700">
          <Button
            onClick={handleClose}
            disabled={isClosing}
            variant="outline"
            className="w-full border-slate-600 text-slate-300 hover:bg-slate-700"
          >
            {isClosing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Closing...
              </>
            ) : (
              "Close Proposal"
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
