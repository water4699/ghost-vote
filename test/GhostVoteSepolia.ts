import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm, deployments } from "hardhat";
import { GhostVote } from "../types";
import { expect } from "chai";
import { FhevmType } from "@fhevm/hardhat-plugin";

type Signers = {
  alice: HardhatEthersSigner;
};

describe("GhostVoteSepolia", function () {
  let signers: Signers;
  let ghostVoteContract: GhostVote;
  let ghostVoteContractAddress: string;
  let step: number;
  let steps: number;

  function progress(message: string) {
    console.log(`${++step}/${steps} ${message}`);
  }

  before(async function () {
    if (fhevm.isMock) {
      console.warn(`This hardhat test suite can only run on Sepolia Testnet`);
      this.skip();
    }

    try {
      const GhostVoteDeployment = await deployments.get("GhostVote");
      ghostVoteContractAddress = GhostVoteDeployment.address;
      ghostVoteContract = await ethers.getContractAt("GhostVote", GhostVoteDeployment.address);
    } catch (e) {
      (e as Error).message += ". Call 'npx hardhat deploy --network sepolia'";
      throw e;
    }

    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { alice: ethSigners[0] };
  });

  beforeEach(async () => {
    step = 0;
    steps = 0;
  });

  it("create proposal and vote", async function () {
    steps = 12;
    this.timeout(4 * 60000);

    progress("Creating proposal...");
    const title = "Test Proposal on Sepolia";
    const description = "Should we approve this test proposal?";
    const duration = 7 * 24 * 60 * 60; // 7 days

    let tx = await ghostVoteContract.connect(signers.alice).createProposal(title, description, duration);
    await tx.wait();

    progress("Getting proposal count...");
    const proposalCount = await ghostVoteContract.proposalCount();
    const proposalId = Number(proposalCount) - 1;
    progress(`Proposal ID: ${proposalId}`);

    progress("Getting proposal details...");
    const proposal = await ghostVoteContract.getProposal(proposalId);
    progress(`Title: ${proposal[0]}`);
    progress(`Active: ${proposal[3]}`);

    progress("Encrypting vote (1 = FOR)...");
    const voteFor = 1;
    const encryptedVoteFor = await fhevm
      .createEncryptedInput(ghostVoteContractAddress, signers.alice.address)
      .add8(voteFor)
      .encrypt();

    progress(
      `Calling vote() proposalId=${proposalId} handle=${ethers.hexlify(encryptedVoteFor.handles[0])} signer=${signers.alice.address}...`,
    );
    tx = await ghostVoteContract
      .connect(signers.alice)
      .vote(proposalId, encryptedVoteFor.handles[0], encryptedVoteFor.inputProof);
    await tx.wait();

    progress("Checking if voted...");
    const hasVoted = await ghostVoteContract.hasVoted(proposalId, signers.alice.address);
    expect(hasVoted).to.be.true;
    progress(`Has voted: ${hasVoted}`);

    progress("Getting vote totals...");
    const voteTotals = await ghostVoteContract.getVoteTotals(proposalId);

    progress("Decrypting votes FOR...");
    const decryptedFor = await fhevm.userDecryptEuint(
      FhevmType.euint8,
      voteTotals[0],
      ghostVoteContractAddress,
      signers.alice,
    );
    progress(`Votes FOR: ${decryptedFor}`);

    progress("Decrypting votes AGAINST...");
    const decryptedAgainst = await fhevm.userDecryptEuint(
      FhevmType.euint8,
      voteTotals[1],
      ghostVoteContractAddress,
      signers.alice,
    );
    progress(`Votes AGAINST: ${decryptedAgainst}`);

    expect(decryptedFor).to.be.greaterThan(0);
  });
});

