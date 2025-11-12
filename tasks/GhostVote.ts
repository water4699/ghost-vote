import { task } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";

task("task:deployGhostVote", "Deploy GhostVote contract").setAction(async function (
  _taskArguments: TaskArguments,
  hre,
) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  const ghostVote = await deploy("GhostVote", {
    from: deployer,
    log: true,
  });

  console.log(`GhostVote contract deployed at: ${ghostVote.address}`);
});

task("task:getProposal", "Get proposal details")
  .addParam("contract", "The GhostVote contract address")
  .addParam("proposalid", "The proposal ID")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { contract, proposalid } = taskArguments;
    
    const ghostVote = await hre.ethers.getContractAt("GhostVote", contract);
    const proposal = await ghostVote.getProposal(proposalid);
    
    console.log("Proposal Details:");
    console.log("Title:", proposal[0]);
    console.log("Description:", proposal[1]);
    console.log("Deadline:", new Date(Number(proposal[2]) * 1000).toLocaleString());
    console.log("Active:", proposal[3]);
    console.log("Total Voters:", proposal[4].toString());
  });

