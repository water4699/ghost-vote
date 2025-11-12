import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  const deployedGhostVote = await deploy("GhostVote", {
    from: deployer,
    log: true,
  });

  console.log(`GhostVote contract: `, deployedGhostVote.address);
};
export default func;
func.id = "deploy_ghostVote";
func.tags = ["GhostVote"];

