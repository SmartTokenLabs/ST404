import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
require('dotenv/config')

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: "0.8.20",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    ],
  },
  networks: {
    hardhat: {
      // loggingEnabled: true
    },
    // "https://rpc-mumbai.maticvigil.com",
    // "https://polygon-mumbai-bor.publicnode.com",
    // "wss://polygon-mumbai-bor.publicnode.com",
    // "https://polygon-mumbai.gateway.tenderly.co",
    // "wss://polygon-mumbai.gateway.tenderly.co"
    // "https://matic-mumbai.chainstacklabs.com"
    polygonMumbai: {
      url: `https://rpc-mumbai.maticvigil.com`
    },
    // "rpc":[
    //   "https://rpc.sepolia.org",
    //   "https://rpc2.sepolia.org",
    //   "https://rpc-sepolia.rockx.com",
    //   "https://rpc.sepolia.ethpandaops.io",
    //   "https://sepolia.infura.io/v3/${INFURA_API_KEY}",
    //   "wss://sepolia.infura.io/v3/${INFURA_API_KEY}",
    //   "https://sepolia.gateway.tenderly.co",
    //   "wss://sepolia.gateway.tenderly.co",
    //   "https://ethereum-sepolia-rpc.publicnode.com",
    //   "wss://ethereum-sepolia-rpc.publicnode.com"]
    sepolia: {
      url: `https://rpc2.sepolia.org`
    }
  },
  etherscan: {
    enabled: true,
    // Your API key for Etherscan
    // Obtain one at https://etherscan.io/
    apiKey: {
      mainnet: `${process.env.ETHERSCAN_API_KEY}`,
      sepolia: `${process.env.ETHERSCAN_API_KEY}`,
      polygonMumbai: `${process.env.POLYGONSCAN_API_KEY}`,
      polygon: `${process.env.POLYGONSCAN_API_KEY}`
    },
  },
};

export default config;
