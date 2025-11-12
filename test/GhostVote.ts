import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm } from "hardhat";
import { GhostVote, GhostVote__factory } from "../types";
import { expect } from "chai";
import { FhevmType } from "@fhevm/hardhat-plugin";

type Signers = {
  admin: HardhatEthersSigner;
  alice: HardhatEthersSigner;
  bob: HardhatEthersSigner;
  charlie: HardhatEthersSigner;
};

async function deployFixture() {
  const factory = (await ethers.getContractFactory("GhostVote")) as GhostVote__factory;
  const ghostVoteContract = (await factory.deploy()) as GhostVote;
  const ghostVoteContractAddress = await ghostVoteContract.getAddress();

  return { ghostVoteContract, ghostVoteContractAddress };
}

describe("GhostVote", function () {
  let signers: Signers;
  let ghostVoteContract: GhostVote;
  let ghostVoteContractAddress: string;

  before(async function () {
    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { 
      admin: ethSigners[0], 
      alice: ethSigners[1], 
      bob: ethSigners[2],
      charlie: ethSigners[3]
    };
  });

  beforeEach(async function () {
    if (!fhevm.isMock) {
      console.warn(`This hardhat test suite cannot run on Sepolia Testnet`);
      this.skip();
    }

    ({ ghostVoteContract, ghostVoteContractAddress } = await deployFixture());
  });

  it("should deploy with correct admin", async function () {
    const admin = await ghostVoteContract.admin();
    expect(admin).to.equal(signers.admin.address);
  });

  it("should create a proposal", async function () {
    const title = "Increase Treasury Allocation";
    const description = "Should we increase the treasury allocation by 10%?";
    const duration = 7 * 24 * 60 * 60; // 7 days

    const tx = await ghostVoteContract.connect(signers.admin).createProposal(title, description, duration);
    await tx.wait();

    const proposalCount = await ghostVoteContract.proposalCount();
    expect(proposalCount).to.equal(1);

    const proposal = await ghostVoteContract.getProposal(0);
    expect(proposal[0]).to.equal(title);
    expect(proposal[1]).to.equal(description);
    expect(proposal[3]).to.be.true; // active
    expect(proposal[4]).to.equal(0); // totalVoters
  });

  it("should allow voting and track encrypted votes", async function () {
    // Create proposal
    const title = "Test Proposal";
    const description = "Test Description";
    const duration = 7 * 24 * 60 * 60;

    let tx = await ghostVoteContract.connect(signers.admin).createProposal(title, description, duration);
    await tx.wait();

    // Alice votes FOR (1)
    const voteFor = 1;
    const encryptedVoteFor = await fhevm
      .createEncryptedInput(ghostVoteContractAddress, signers.alice.address)
      .add8(voteFor)
      .encrypt();

    tx = await ghostVoteContract
      .connect(signers.alice)
      .vote(0, encryptedVoteFor.handles[0], encryptedVoteFor.inputProof);
    await tx.wait();

    // Bob votes AGAINST (0)
    const voteAgainst = 0;
    const encryptedVoteAgainst = await fhevm
      .createEncryptedInput(ghostVoteContractAddress, signers.bob.address)
      .add8(voteAgainst)
      .encrypt();

    tx = await ghostVoteContract
      .connect(signers.bob)
      .vote(0, encryptedVoteAgainst.handles[0], encryptedVoteAgainst.inputProof);
    await tx.wait();

    // Charlie votes FOR (1)
    const encryptedVoteFor2 = await fhevm
      .createEncryptedInput(ghostVoteContractAddress, signers.charlie.address)
      .add8(voteFor)
      .encrypt();

    tx = await ghostVoteContract
      .connect(signers.charlie)
      .vote(0, encryptedVoteFor2.handles[0], encryptedVoteFor2.inputProof);
    await tx.wait();

    // Check proposal state
    const proposal = await ghostVoteContract.getProposal(0);
    expect(proposal[4]).to.equal(3); // totalVoters

    // Request decryption access (anyone can do this)
    tx = await ghostVoteContract.connect(signers.admin).requestDecryptionAccess(0);
    await tx.wait();

    // Admin decrypts results
    const voteTotals = await ghostVoteContract.getVoteTotals(0);
    const decryptedFor = await fhevm.userDecryptEuint(
      FhevmType.euint8,
      voteTotals[0],
      ghostVoteContractAddress,
      signers.admin,
    );
    const decryptedAgainst = await fhevm.userDecryptEuint(
      FhevmType.euint8,
      voteTotals[1],
      ghostVoteContractAddress,
      signers.admin,
    );

    expect(decryptedFor).to.equal(2); // 2 votes FOR
    expect(decryptedAgainst).to.equal(1); // 1 vote AGAINST
  });

  it("should prevent double voting", async function () {
    const title = "Test Proposal";
    const description = "Test Description";
    const duration = 7 * 24 * 60 * 60;

    let tx = await ghostVoteContract.connect(signers.admin).createProposal(title, description, duration);
    await tx.wait();

    const voteFor = 1;
    const encryptedVoteFor = await fhevm
      .createEncryptedInput(ghostVoteContractAddress, signers.alice.address)
      .add8(voteFor)
      .encrypt();

    tx = await ghostVoteContract
      .connect(signers.alice)
      .vote(0, encryptedVoteFor.handles[0], encryptedVoteFor.inputProof);
    await tx.wait();

    // Try to vote again
    await expect(
      ghostVoteContract
        .connect(signers.alice)
        .vote(0, encryptedVoteFor.handles[0], encryptedVoteFor.inputProof)
    ).to.be.revertedWith("You have already voted");
  });

  it("should allow admin to close proposal", async function () {
    const title = "Test Proposal";
    const description = "Test Description";
    const duration = 7 * 24 * 60 * 60;

    let tx = await ghostVoteContract.connect(signers.admin).createProposal(title, description, duration);
    await tx.wait();

    tx = await ghostVoteContract.connect(signers.admin).closeProposal(0);
    await tx.wait();

    const proposal = await ghostVoteContract.getProposal(0);
    expect(proposal[3]).to.be.false; // not active
  });

  it("should prevent voting on closed proposal", async function () {
    const title = "Test Proposal";
    const description = "Test Description";
    const duration = 7 * 24 * 60 * 60;

    let tx = await ghostVoteContract.connect(signers.admin).createProposal(title, description, duration);
    await tx.wait();

    tx = await ghostVoteContract.connect(signers.admin).closeProposal(0);
    await tx.wait();

    const voteFor = 1;
    const encryptedVoteFor = await fhevm
      .createEncryptedInput(ghostVoteContractAddress, signers.alice.address)
      .add8(voteFor)
      .encrypt();

    await expect(
      ghostVoteContract
        .connect(signers.alice)
        .vote(0, encryptedVoteFor.handles[0], encryptedVoteFor.inputProof)
    ).to.be.revertedWith("Proposal is not active");
  });

  it("should allow anyone to decrypt results", async function () {
    const title = "Test Proposal";
    const description = "Test Description";
    const duration = 7 * 24 * 60 * 60;

    let tx = await ghostVoteContract.connect(signers.admin).createProposal(title, description, duration);
    await tx.wait();

    const voteFor = 1;
    const voteAgainst = 0;

    // Alice votes FOR
    const encryptedVoteFor = await fhevm
      .createEncryptedInput(ghostVoteContractAddress, signers.alice.address)
      .add8(voteFor)
      .encrypt();

    tx = await ghostVoteContract
      .connect(signers.alice)
      .vote(0, encryptedVoteFor.handles[0], encryptedVoteFor.inputProof);
    await tx.wait();

    // Bob votes AGAINST
    const encryptedVoteAgainst = await fhevm
      .createEncryptedInput(ghostVoteContractAddress, signers.bob.address)
      .add8(voteAgainst)
      .encrypt();

    tx = await ghostVoteContract
      .connect(signers.bob)
      .vote(0, encryptedVoteAgainst.handles[0], encryptedVoteAgainst.inputProof);
    await tx.wait();

    // Alice (non-admin) requests decryption access
    tx = await ghostVoteContract.connect(signers.alice).requestDecryptionAccess(0);
    await tx.wait();

    // Alice decrypts results
    const voteTotals = await ghostVoteContract.getVoteTotals(0);
    const decryptedFor = await fhevm.userDecryptEuint(
      FhevmType.euint8,
      voteTotals[0],
      ghostVoteContractAddress,
      signers.alice,
    );
    const decryptedAgainst = await fhevm.userDecryptEuint(
      FhevmType.euint8,
      voteTotals[1],
      ghostVoteContractAddress,
      signers.alice,
    );

    expect(decryptedFor).to.equal(1); // 1 vote FOR
    expect(decryptedAgainst).to.equal(1); // 1 vote AGAINST
  });
});

