import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const contractName = "GhostVote";
const artifactPath = path.join(
  __dirname,
  "../../artifacts/contracts",
  `${contractName}.sol`,
  `${contractName}.json`
);
const abiDir = path.join(__dirname, "../abi");

// Ensure abi directory exists
if (!fs.existsSync(abiDir)) {
  fs.mkdirSync(abiDir, { recursive: true });
}

try {
  // Read the artifact
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));

  // Generate ABI file
  const abiContent = `export const ${contractName}ABI = ${JSON.stringify(artifact.abi, null, 2)} as const;`;
  fs.writeFileSync(path.join(abiDir, `${contractName}ABI.ts`), abiContent);

  // Generate addresses file
  const addressesPath = path.join(
    __dirname,
    "../../deployments/localhost",
    `${contractName}.json`
  );

  let addressesContent = `export const ${contractName}Addresses = {\n  localhost: ""`;

  if (fs.existsSync(addressesPath)) {
    const deployment = JSON.parse(fs.readFileSync(addressesPath, "utf8"));
    addressesContent = `export const ${contractName}Addresses = {\n  localhost: "${deployment.address}"`;
  }

  addressesContent += `,\n  sepolia: ""\n} as const;`;

  fs.writeFileSync(
    path.join(abiDir, `${contractName}Addresses.ts`),
    addressesContent
  );

  console.log("✅ ABI and addresses generated successfully!");
} catch (error) {
  console.error("❌ Error generating ABI:", error.message);
  process.exit(1);
}

