"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ethers } from "ethers";
import { useAccount } from "wagmi";

import type { FhevmInstance } from "@/fhevm/fhevmTypes";
import { FhevmDecryptionSignature } from "@/fhevm/FhevmDecryptionSignature";
import type { GenericStringStorage } from "@/fhevm/GenericStringStorage";
import { GhostVoteABI } from "@/abi/GhostVoteABI";
import { GhostVoteAddresses } from "@/abi/GhostVoteAddresses";
import { useWagmiEthers } from "./wagmi/useWagmiEthers";

type GhostVoteContractInfo = {
  abi: typeof GhostVoteABI;
  address?: `0x${string}`;
  chainId?: number;
  chainName?: string;
};

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

function getGhostVoteContract(chainId: number | undefined): GhostVoteContractInfo {
  if (!chainId) {
    return { abi: GhostVoteABI };
  }

  // Map chain ID to address key
  let addressKey: keyof typeof GhostVoteAddresses;
  if (chainId === 31337) {
    addressKey = "localhost";
  } else if (chainId === 11155111) {
    addressKey = "sepolia";
  } else {
    return { abi: GhostVoteABI, chainId };
  }

  const entry = GhostVoteAddresses[addressKey];
  if (!entry) {
    return { abi: GhostVoteABI, chainId };
  }

  return {
    abi: GhostVoteABI,
    address: entry as `0x${string}`,
    chainId: chainId,
    chainName: addressKey,
  };
}

type UseGhostVoteParams = {
  instance: FhevmInstance | undefined;
  fhevmDecryptionSignatureStorage: GenericStringStorage;
};

export const useGhostVote = ({ instance, fhevmDecryptionSignatureStorage }: UseGhostVoteParams) => {
  const { address, chainId } = useAccount();
  const { ethersSigner, ethersReadonlyProvider } = useWagmiEthers();

  const [status, setStatus] = useState<string>("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [proposalCount, setProposalCount] = useState(0);
  const [isDeployed, setIsDeployed] = useState<boolean | undefined>(undefined);

  const ghostVote = useMemo(() => getGhostVoteContract(chainId), [chainId]);

  useEffect(() => {
    const checkDeployment = async () => {
      if (!ghostVote.address || !ethersReadonlyProvider) {
        setIsDeployed(undefined);
        return;
      }
      try {
        const code = await ethersReadonlyProvider.getCode(ghostVote.address);
        setIsDeployed(code !== "0x");
      } catch (error) {
        console.error("[useGhostVote] Failed to read contract code", error);
        setIsDeployed(undefined);
      }
    };

    checkDeployment();
  }, [ghostVote.address, ethersReadonlyProvider]);

  const readContract = useMemo(() => {
    if (!ghostVote.address || !ethersReadonlyProvider) return undefined;
    return new ethers.Contract(ghostVote.address, ghostVote.abi, ethersReadonlyProvider);
  }, [ghostVote.address, ghostVote.abi, ethersReadonlyProvider]);

  const writeContract = useMemo(() => {
    if (!ghostVote.address || !ethersSigner) return undefined;
    return new ethers.Contract(ghostVote.address, ghostVote.abi, ethersSigner);
  }, [ghostVote.address, ghostVote.abi, ethersSigner]);

  // Check if user is admin
  useEffect(() => {
    const checkAdmin = async () => {
      if (!readContract || !address) {
        setIsAdmin(false);
        return;
      }
      try {
        const adminAddress = await readContract.admin();
        setIsAdmin(adminAddress.toLowerCase() === address.toLowerCase());
      } catch (error) {
        console.error("[useGhostVote] Failed to check admin", error);
        setIsAdmin(false);
      }
    };

    checkAdmin();
  }, [readContract, address]);

  // Get proposal count
  const refreshProposalCount = useCallback(async () => {
    if (!readContract) return;
    try {
      const count = await readContract.proposalCount();
      setProposalCount(Number(count));
    } catch (error) {
      console.warn("[useGhostVote] Unable to read proposalCount", error);
    }
  }, [readContract]);

  useEffect(() => {
    refreshProposalCount();
  }, [refreshProposalCount]);

  const createProposal = useCallback(
    async (title: string, description: string, durationInSeconds: number) => {
      if (!writeContract) {
        setStatus("Wallet not connected");
        return;
      }

      setStatus("Creating proposal...");
      try {
        const tx = await writeContract.createProposal(title, description, durationInSeconds);
        await tx.wait();
        setStatus("Proposal created successfully");
        await refreshProposalCount();
      } catch (error) {
        console.error("[useGhostVote] createProposal failed", error);
        setStatus("Failed to create proposal");
        throw error;
      }
    },
    [writeContract, refreshProposalCount]
  );

  const vote = useCallback(
    async (proposalId: number, voteValue: number) => {
      if (!writeContract || !instance || !ethersSigner || !ghostVote.address) {
        setStatus("Wallet or FHEVM is not ready");
        return;
      }

      setStatus("Encrypting vote...");
      try {
        const playerAddress = await ethersSigner.getAddress();
        const encrypted = await instance
          .createEncryptedInput(ghostVote.address as `0x${string}`, playerAddress as `0x${string}`)
          .add8(voteValue)
          .encrypt();

        setStatus("Submitting encrypted vote...");
        const tx = await writeContract.vote(proposalId, encrypted.handles[0], encrypted.inputProof);
        await tx.wait();
        setStatus("Vote submitted successfully");
      } catch (error) {
        console.error("[useGhostVote] vote failed", error);
        setStatus("Failed to submit vote");
        throw error;
      }
    },
    [writeContract, instance, ethersSigner, ghostVote.address]
  );

  const closeProposal = useCallback(
    async (proposalId: number) => {
      if (!writeContract) {
        setStatus("Wallet not connected");
        return;
      }

      setStatus("Closing proposal...");
      try {
        const tx = await writeContract.closeProposal(proposalId);
        await tx.wait();
        setStatus("Proposal closed successfully");
      } catch (error) {
        console.error("[useGhostVote] closeProposal failed", error);
        setStatus("Failed to close proposal");
        throw error;
      }
    },
    [writeContract]
  );

  const getProposal = useCallback(
    async (proposalId: number) => {
      if (!readContract) throw new Error("Contract not initialized");
      const proposal = await readContract.getProposal(proposalId);
      return {
        title: proposal[0],
        description: proposal[1],
        deadline: Number(proposal[2]),
        active: proposal[3],
        totalVoters: Number(proposal[4]),
      };
    },
    [readContract]
  );

  const getVoteTotals = useCallback(
    async (proposalId: number) => {
      if (!writeContract) throw new Error("Contract not initialized");
      return await writeContract.getVoteTotals(proposalId);
    },
    [writeContract]
  );

  const hasVoted = useCallback(
    async (proposalId: number, voterAddress: string) => {
      if (!readContract) throw new Error("Contract not initialized");
      return await readContract.hasVoted(proposalId, voterAddress);
    },
    [readContract]
  );

  const decryptVoteTotals = useCallback(
    async (proposalId: number) => {
      if (!instance || !ethersSigner || !ghostVote.address || !writeContract) {
        throw new Error("FHEVM instance or signer not ready");
      }

      setStatus("Requesting decryption access...");

      try {
        // First, request decryption access for this proposal
        const accessTx = await writeContract.requestDecryptionAccess(proposalId);
        await accessTx.wait();

        setStatus("Decrypting vote totals...");

        const signature = await FhevmDecryptionSignature.loadOrSign(
          instance,
          [ghostVote.address],
          ethersSigner,
          fhevmDecryptionSignatureStorage
        );

        if (!signature) {
          throw new Error("Unable to obtain FHEVM decryption signature");
        }

        const voteTotals = await getVoteTotals(proposalId);

        const decryptResult = await instance.userDecrypt(
          [
            { handle: voteTotals[0], contractAddress: ghostVote.address as `0x${string}` },
            { handle: voteTotals[1], contractAddress: ghostVote.address as `0x${string}` },
          ],
          signature.privateKey,
          signature.publicKey,
          signature.signature,
          signature.contractAddresses,
          signature.userAddress,
          signature.startTimestamp,
          signature.durationDays
        );

        const votesFor = Number(BigInt(decryptResult[voteTotals[0]]));
        const votesAgainst = Number(BigInt(decryptResult[voteTotals[1]]));

        setStatus("Vote totals decrypted successfully");

        return { votesFor, votesAgainst };
      } catch (error) {
        console.error("[useGhostVote] decryptVoteTotals failed", error);
        setStatus("Failed to decrypt vote totals");
        throw error;
      }
    },
    [instance, ethersSigner, fhevmDecryptionSignatureStorage, ghostVote.address, getVoteTotals, writeContract]
  );

  return {
    ghostVote,
    isDeployed,
    status,
    isAdmin,
    proposalCount,
    createProposal,
    vote,
    closeProposal,
    getProposal,
    getVoteTotals,
    hasVoted,
    decryptVoteTotals,
    refreshProposalCount,
  } as const;
};
