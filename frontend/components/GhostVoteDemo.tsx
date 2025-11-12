"use client";

import { useAccount, useChainId } from "wagmi";
import { useState, useMemo } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Shield, Lock, Users, Vote, TrendingUp } from "lucide-react";

import { useFhevm } from "@/fhevm/useFhevm";
import { useInMemoryStorage } from "@/hooks/useInMemoryStorage";
import { useWagmiEthers } from "@/hooks/wagmi/useWagmiEthers";
import { useGhostVote } from "@/hooks/useGhostVote";
import { initialMockChains } from "@/config/wagmi";

import { CreateProposal } from "./CreateProposal";
import { ProposalList } from "./ProposalList";
import { VotePanel } from "./VotePanel";
import { ResultsPanel } from "./ResultsPanel";

export function GhostVoteDemo() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { ethersProvider } = useWagmiEthers();
  
  const { storage: fhevmDecryptionSignatureStorage } = useInMemoryStorage();

  // FHEVM provider
  const fhevmProvider = useMemo(() => {
    if (chainId === 31337) {
      return "http://127.0.0.1:8545";
    }
    
    if (typeof window !== 'undefined' && window.ethereum) {
      return window.ethereum;
    }
    
    if (ethersProvider) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const internalProvider = (ethersProvider as any)._getConnection?.()?.provider;
      if (internalProvider) {
        return internalProvider;
      }
    }
    
    return undefined;
  }, [chainId, ethersProvider]);

  const {
    instance: fhevmInstance,
    status: fhevmStatus,
    error: fhevmError,
  } = useFhevm({
    provider: fhevmProvider,
    chainId: chainId,
    enabled: !!fhevmProvider && !!chainId,
    initialMockChains,
  });

  const {
    ghostVote,
    isDeployed,
    status,
    isAdmin,
    proposalCount,
    createProposal,
    vote,
    closeProposal,
    getProposal,
    hasVoted,
    decryptVoteTotals,
  } = useGhostVote({
    instance: fhevmInstance,
    fhevmDecryptionSignatureStorage,
  });

  const [selectedProposalId, setSelectedProposalId] = useState<number | null>(null);

  if (!isConnected) {
    return (
      <div className="max-w-6xl mx-auto mt-16 px-4">
        {/* Welcome Banner */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-purple-500/20 mb-6">
            <Shield className="w-10 h-10 text-purple-400" />
          </div>
          <h1 className="text-5xl font-bold text-white mb-4">
            Welcome to GhostVote
          </h1>
          <p className="text-xl text-slate-300 mb-8">
            Fully Encrypted DAO Voting with FHEVM Technology
          </p>
        </div>

        {/* Feature Cards */}
        <div className="grid md:grid-cols-3 gap-8 mb-16">
          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-8 text-center hover:border-purple-500/50 transition-all">
            <Lock className="w-14 h-14 text-purple-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-3">Private Voting</h3>
            <p className="text-slate-400">
              Your votes are encrypted and stay private on-chain
            </p>
          </div>
          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-8 text-center hover:border-purple-500/50 transition-all">
            <Users className="w-14 h-14 text-purple-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-3">DAO Governance</h3>
            <p className="text-slate-400">
              Anyone can create and vote on proposals
            </p>
          </div>
          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-8 text-center hover:border-purple-500/50 transition-all">
            <TrendingUp className="w-14 h-14 text-purple-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-3">Transparent Results</h3>
            <p className="text-slate-400">
              Admin can decrypt final aggregated results
            </p>
          </div>
        </div>

        <Alert className="bg-purple-500/10 border-purple-500/20">
          <AlertDescription className="text-white text-center text-lg py-2">
            Please connect your wallet to continue
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (fhevmStatus === "loading") {
    return (
      <div className="max-w-4xl mx-auto mt-20 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-purple-400 mx-auto mb-4" />
          <p className="text-white text-lg">Initializing FHEVM...</p>
          <p className="text-slate-400 text-sm mt-2">Setting up encryption system...</p>
        </div>
      </div>
    );
  }

  if (fhevmStatus === "error") {
    return (
      <div className="max-w-4xl mx-auto mt-20">
        <Alert className="bg-red-500/10 border-red-500/20">
          <AlertDescription className="text-white">
            <div className="text-center">
              <p className="font-semibold mb-2">Failed to initialize FHEVM</p>
              <p className="text-sm">{fhevmError?.message || "Unknown error"}</p>
              <p className="text-xs mt-2 text-slate-400">
                Make sure you're on the correct network (localhost chain ID 31337)
              </p>
            </div>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (isDeployed === false) {
    return (
      <div className="max-w-4xl mx-auto mt-20">
        <Alert className="bg-yellow-500/10 border-yellow-500/20">
          <AlertDescription className="text-white text-center">
            Contract not deployed on this network. Please deploy the contract first.
            <br />
            <code className="text-xs mt-2 block">npx hardhat deploy --network localhost</code>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!ghostVote.address || !fhevmInstance) {
    return (
      <div className="max-w-4xl mx-auto mt-20">
        <Alert className="bg-yellow-500/10 border-yellow-500/20">
          <AlertDescription className="text-white text-center">
            Loading contract...
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 px-4">
      {/* Status Message */}
      {status && (
        <Alert className="bg-purple-500/10 border-purple-500/20">
          <AlertDescription className="text-white text-center">
            {status}
          </AlertDescription>
        </Alert>
      )}

      {/* Network Info Banner */}
      <div className="bg-gradient-to-r from-purple-900/40 to-pink-900/40 backdrop-blur-sm border border-purple-500/20 rounded-xl p-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-green-400 animate-pulse"></div>
            <div>
              <p className="text-sm text-slate-300">
                Network: <span className="font-semibold text-white">
                  {chainId === 31337 ? "Localhost" : chainId === 11155111 ? "Sepolia" : `Chain ${chainId}`}
                </span>
              </p>
              <p className="text-xs text-slate-400">
                Contract: {ghostVote.address}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <Vote className="w-4 h-4 text-purple-400" />
              <span className="text-slate-300">
                <span className="font-semibold text-white">{proposalCount}</span> Proposals
              </span>
            </div>
            {isAdmin && (
              <div className="px-3 py-1 bg-purple-500/20 border border-purple-500/30 rounded-full">
                <span className="text-purple-300 text-xs font-semibold">Admin</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Two Column Layout: Create Proposal & Proposals List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Create Proposal */}
        <div className="bg-gradient-to-br from-purple-900/30 to-blue-900/30 backdrop-blur-sm border border-purple-500/20 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
              <Vote className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Create Proposal</h2>
              <p className="text-sm text-slate-400">Start a new vote</p>
            </div>
          </div>
          <CreateProposal onCreateProposal={createProposal} />
        </div>

        {/* Right: Proposals List */}
        <div>
          <ProposalList
            proposalCount={proposalCount}
            getProposal={getProposal}
            selectedProposalId={selectedProposalId}
            onSelectProposal={setSelectedProposalId}
          />
        </div>
      </div>

      {/* Full Width: Vote & Results Section */}
      {selectedProposalId !== null ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <VotePanel
            proposalId={selectedProposalId}
            getProposal={getProposal}
            vote={vote}
            hasVoted={hasVoted}
            address={address!}
            fhevmInstance={fhevmInstance}
          />
          <ResultsPanel
            proposalId={selectedProposalId}
            getProposal={getProposal}
            decryptVoteTotals={decryptVoteTotals}
            closeProposal={closeProposal}
            isAdmin={isAdmin}
          />
        </div>
      ) : (
        <div className="bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 rounded-xl p-16 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-700/30 mb-6">
            <Vote className="w-8 h-8 text-slate-500" />
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">
            No Proposal Selected
          </h3>
          <p className="text-slate-400 mb-6">
            Select a proposal from the list to vote or view results
          </p>
          {proposalCount === 0 && (
            <p className="text-sm text-slate-500">
              Create the first proposal to get started! 🚀
            </p>
          )}
        </div>
      )}

      {/* Footer Info */}
      <div className="mt-8 pb-8 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-purple-500/10 border border-purple-500/20 rounded-full">
          <Lock className="w-4 h-4 text-purple-400" />
          <span className="text-sm text-purple-300">
            Powered by FHEVM - Fully Homomorphic Encryption
          </span>
        </div>
      </div>
    </div>
  );
}
