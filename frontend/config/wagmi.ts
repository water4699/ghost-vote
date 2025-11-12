import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { http } from "wagmi";
import { hardhat, sepolia } from "wagmi/chains";

// WalletConnect Project ID
export const walletProjectId = "ef3325a718834a2b1b4134d3f520933d";

// Infura API Key
const INFURA_API_KEY = process.env.NEXT_PUBLIC_INFURA_API_KEY || "zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz";

// Override hardhat chain to use localhost
const localhostChain = {
  ...hardhat,
  id: 31337,
  name: "Localhost",
  nativeCurrency: {
    decimals: 18,
    name: "Ether",
    symbol: "ETH",
  },
  rpcUrls: {
    default: {
      http: ["http://127.0.0.1:8545"],
    },
    public: {
      http: ["http://127.0.0.1:8545"],
    },
  },
};

export const wagmiConfig = getDefaultConfig({
  appName: "GhostVote",
  projectId: walletProjectId,
  chains: [localhostChain, sepolia],
  transports: {
    [localhostChain.id]: http("http://127.0.0.1:8545", {
      batch: false,
      timeout: 60000,
    }),
    [sepolia.id]: http(`https://sepolia.infura.io/v3/${INFURA_API_KEY}`),
  },
  ssr: true,
});

export const initialMockChains: Readonly<Record<number, string>> = {
  [localhostChain.id]: "http://127.0.0.1:8545",
};
