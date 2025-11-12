"use client";

import { ethers } from "ethers";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { FhevmInstance } from "@/fhevm/fhevmTypes";
import { FhevmDecryptionSignature } from "@/fhevm/FhevmDecryptionSignature";
import type { GenericStringStorage } from "@/fhevm/GenericStringStorage";
import { LuckyDiceABI } from "@/abi/LuckyDiceABI";
import { LuckyDiceAddresses } from "@/abi/LuckyDiceAddresses";

type LuckyDiceContractInfo = {
  abi: typeof LuckyDiceABI.abi;
  address?: `0x${string}`;
  chainId?: number;
  chainName?: string;
};

type RollCipher = {
  rollId: bigint;
  player: string;
  createdAt: number;
  encryptedRoll: `0x${string}`;
  sumAfterRoll: `0x${string}`;
  hitJackpot: `0x${string}`;
};

export type DecryptedRoll = {
  rollId: bigint;
  player: string;
  createdAt: number;
  value: number;
  sum: bigint;
  hitJackpot: boolean;
};

type UseLuckyDiceParams = {
  instance: FhevmInstance | undefined;
  chainId: number | undefined;
  ethersSigner: ethers.JsonRpcSigner | undefined;
  ethersReadonlyProvider: ethers.Provider | undefined;
  fhevmDecryptionSignatureStorage: GenericStringStorage;
};

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

function getLuckyDiceContract(chainId: number | undefined): LuckyDiceContractInfo {
  if (!chainId) {
    return { abi: LuckyDiceABI.abi };
  }

  const entry = LuckyDiceAddresses[chainId.toString() as keyof typeof LuckyDiceAddresses];
  if (!entry || entry.address === ZERO_ADDRESS) {
    return { abi: LuckyDiceABI.abi, chainId };
  }

  return {
    abi: LuckyDiceABI.abi,
    address: entry.address as `0x${string}`,
    chainId: entry.chainId ?? chainId,
    chainName: entry.chainName,
  };
}

export const useLuckyDice = ({
  instance,
  chainId,
  ethersSigner,
  ethersReadonlyProvider,
  fhevmDecryptionSignatureStorage,
}: UseLuckyDiceParams) => {
  const [status, setStatus] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [isDecryptingPot, setIsDecryptingPot] = useState(false);
  const [rollCount, setRollCount] = useState<bigint>(0n);
  const [activeRoll, setActiveRoll] = useState<RollCipher | undefined>(undefined);
  const [latestDecrypted, setLatestDecrypted] = useState<DecryptedRoll | undefined>(undefined);
  const [history, setHistory] = useState<DecryptedRoll[]>([]);
  const [potHandle, setPotHandle] = useState<`0x${string}` | undefined>(undefined);
  const [potValue, setPotValue] = useState<bigint | undefined>(undefined);
  const [isDeployed, setIsDeployed] = useState<boolean | undefined>(undefined);

  const luckyDice = useMemo(() => getLuckyDiceContract(chainId), [chainId]);
  const luckyDiceRef = useRef<LuckyDiceContractInfo>(luckyDice);

  useEffect(() => {
    luckyDiceRef.current = luckyDice;
  }, [luckyDice]);

  useEffect(() => {
    const checkDeployment = async () => {
      if (!luckyDice.address || !ethersReadonlyProvider) {
        setIsDeployed(undefined);
        return;
      }
      try {
        const code = await ethersReadonlyProvider.getCode(luckyDice.address);
        setIsDeployed(code !== "0x");
      } catch (error) {
        console.error("[useLuckyDice] Failed to read contract code", error);
        setIsDeployed(undefined);
      }
    };

    checkDeployment();
  }, [luckyDice.address, ethersReadonlyProvider]);

  const readContract = useMemo(() => {
    if (!luckyDice.address || !ethersReadonlyProvider) return undefined;
    return new ethers.Contract(luckyDice.address, luckyDice.abi, ethersReadonlyProvider);
  }, [luckyDice.address, luckyDice.abi, ethersReadonlyProvider]);

  const writeContract = useMemo(() => {
    if (!luckyDice.address || !ethersSigner) return undefined;
    return new ethers.Contract(luckyDice.address, luckyDice.abi, ethersSigner);
  }, [luckyDice.address, luckyDice.abi, ethersSigner]);

  const refreshRollCount = useCallback(async () => {
    if (!readContract) return;
    try {
      const count = await readContract.rollCount();
      setRollCount(count);
    } catch (error) {
      console.warn("[useLuckyDice] Unable to read rollCount", error);
    }
  }, [readContract]);

  useEffect(() => {
    refreshRollCount();
  }, [refreshRollCount]);

  const fetchEncryptedRoll = useCallback(
    async (rollId: bigint) => {
      if (!writeContract) return undefined;
      try {
        const summary = await writeContract.getRollSummary(rollId);
        const details = await writeContract.getEncryptedRollDetails(rollId);

        const cipher: RollCipher = {
          rollId,
          player: summary.player,
          createdAt: Number(summary.createdAt ?? 0),
          encryptedRoll: details.encryptedRoll,
          sumAfterRoll: details.cumulativeSum,
          hitJackpot: details.hitJackpot,
        };
        setActiveRoll(cipher);
        return cipher;
      } catch (error) {
        console.error("[useLuckyDice] Failed to fetch roll details", error);
        setStatus("Unable to load encrypted roll details. Did you grant viewer permissions?");
        return undefined;
      }
    },
    [writeContract],
  );

  const fetchEncryptedPot = useCallback(async () => {
    if (!writeContract) return undefined;
    try {
      const handle = await writeContract.getEncryptedPot();
      setPotHandle(handle);
      return handle;
    } catch (error) {
      console.warn("[useLuckyDice] Unable to load encrypted pot", error);
      return undefined;
    }
  }, [writeContract]);

  const decryptHandles = useCallback(
    async (handles: `0x${string}`[]) => {
      if (!instance || !ethersSigner || !luckyDice.address) {
        throw new Error("FHEVM instance or signer not ready");
      }

      const signature = await FhevmDecryptionSignature.loadOrSign(
        instance,
        [luckyDice.address],
        ethersSigner,
        fhevmDecryptionSignatureStorage,
      );

      if (!signature) {
        throw new Error("Unable to obtain FHEVM decryption signature");
      }

      const decryptResult = await instance.userDecrypt(
        handles.map((handle) => ({ handle, contractAddress: luckyDice.address as `0x${string}` })),
        signature.privateKey,
        signature.publicKey,
        signature.signature,
        signature.contractAddresses,
        signature.userAddress,
        signature.startTimestamp,
        signature.durationDays,
      );

      return decryptResult;
    },
    [instance, ethersSigner, fhevmDecryptionSignatureStorage, luckyDice.address],
  );

  const submitRoll = useCallback(
    async (diceValue: number) => {
      if (diceValue < 1 || diceValue > 6) {
        setStatus("Dice value must be between 1 and 6.");
        return;
      }
      if (!writeContract || !instance || !ethersSigner || !luckyDice.address) {
        setStatus("Wallet or FHEVM is not ready.");
        return;
      }

      setIsSubmitting(true);
      setStatus("Encrypting dice value...");

      try {
        const playerAddress = await ethersSigner.getAddress();
        const encrypted = await instance
          .createEncryptedInput(luckyDice.address as `0x${string}`, playerAddress as `0x${string}`)
          .add8(diceValue)
          .encrypt();

        setStatus("Submitting encrypted roll...");
        const tx = await writeContract.submitRoll(encrypted.handles[0], encrypted.inputProof);
        await tx.wait();
        setStatus("Roll submitted successfully. Fetching updated state...");

        await refreshRollCount();
        const latestId = await writeContract.rollCount();
        await fetchEncryptedRoll(latestId);
        await fetchEncryptedPot();
      } catch (error) {
        console.error("[useLuckyDice] submitRoll failed", error);
        setStatus("Roll submission failed.");
      } finally {
        setIsSubmitting(false);
      }
    },
    [writeContract, instance, ethersSigner, luckyDice.address, refreshRollCount, fetchEncryptedRoll, fetchEncryptedPot],
  );

  const decryptActiveRoll = useCallback(async () => {
    if (!activeRoll) {
      setStatus("No encrypted roll selected.");
      return;
    }

    setIsDecrypting(true);
    setStatus("Decrypting encrypted roll...");

    try {
      const decrypted = await decryptHandles([
        activeRoll.encryptedRoll,
        activeRoll.sumAfterRoll,
        activeRoll.hitJackpot,
      ]);

      const rollValueRaw = decrypted[activeRoll.encryptedRoll];
      const sumRaw = decrypted[activeRoll.sumAfterRoll];
      const jackpotRaw = decrypted[activeRoll.hitJackpot];

      const rollValue = Number(BigInt(rollValueRaw));
      const sum = BigInt(sumRaw);
      const hitJackpot =
        jackpotRaw === true ||
        jackpotRaw === "true" ||
        jackpotRaw === 1n ||
        jackpotRaw === "1";

      const decryptedRoll: DecryptedRoll = {
        rollId: activeRoll.rollId,
        player: activeRoll.player,
        createdAt: activeRoll.createdAt,
        value: rollValue,
        sum,
        hitJackpot,
      };

      setLatestDecrypted(decryptedRoll);
      setHistory((prev) => [decryptedRoll, ...prev.filter((item) => item.rollId !== decryptedRoll.rollId)].slice(0, 5));
      setStatus(hitJackpot ? "Jackpot! 🎉 Dice lottery threshold reached." : "Roll decrypted successfully.");
    } catch (error) {
      console.error("[useLuckyDice] decryptActiveRoll failed", error);
      setStatus("Unable to decrypt the roll. Please retry.");
    } finally {
      setIsDecrypting(false);
    }
  }, [activeRoll, decryptHandles]);

  const decryptPot = useCallback(
    async (handle?: `0x${string}`) => {
      const targetHandle = handle ?? potHandle;
      if (!targetHandle) {
        setStatus("No encrypted pot available yet.");
        return;
      }

      setIsDecryptingPot(true);
      setStatus("Decrypting rolling pot...");

      try {
        const decrypted = await decryptHandles([targetHandle]);
        const rawPot = decrypted[targetHandle];
        const pot = BigInt(rawPot);
        setPotValue(pot);
        setStatus("Rolling pot decrypted.");
      } catch (error) {
        console.error("[useLuckyDice] decryptPot failed", error);
        setStatus("Unable to decrypt rolling pot.");
      } finally {
        setIsDecryptingPot(false);
      }
    },
    [potHandle, decryptHandles],
  );

  return {
    luckyDice,
    isDeployed,
    status,
    rollCount,
    isSubmitting,
    isDecrypting,
    isDecryptingPot,
    activeRoll,
    latestDecrypted,
    history,
    potHandle,
    potValue,
    submitRoll,
    decryptActiveRoll,
    decryptPot,
    refreshRollCount,
    fetchEncryptedPot,
    fetchEncryptedRoll,
  } as const;
};

