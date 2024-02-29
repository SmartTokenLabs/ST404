import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

const config: HardhatUserConfig = {
  solidity: "0.8.20",
  networks: {
    // "https://rpc-mumbai.maticvigil.com",
    // "https://polygon-mumbai-bor.publicnode.com",
    // "wss://polygon-mumbai-bor.publicnode.com",
    // "https://polygon-mumbai.gateway.tenderly.co",
    // "wss://polygon-mumbai.gateway.tenderly.co"
    // "https://matic-mumbai.chainstacklabs.com"
    polygonMumbai: {
      url: `https://rpc-mumbai.maticvigil.com`
    },
    sepolia: {
      url: `https://rpc.sepolia.org`
    }
  }
};

export default config;
