import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
require('dotenv/config')

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
  },
  etherscan: {
    enabled: true,
    // Your API key for Etherscan
    // Obtain one at https://etherscan.io/
    apiKey: `${process.env.ETHERSCAN_API_KEY}`
    // apiKey: {
    //   mainnet: `${process.env.ETHERSCAN_API_KEY}`,
    //   sepolia: `${process.env.ETHERSCAN_API_KEY}`,
    //   goerli: `${process.env.ETHERSCAN_API_KEY}`,
    //   polygonMumbai: `${process.env.POLYGONSCAN_API_KEY}`,
    //   polygon: `${process.env.POLYGONSCAN_API_KEY}`
    // },
  },
};

export default config;
