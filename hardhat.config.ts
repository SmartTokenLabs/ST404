import { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-toolbox';
require('dotenv/config');

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: '0.8.20',
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
      forking: {
        url: 'https://mainnet.infura.io/v3/' + process.env.INFURA_KEY,
        blockNumber: 19652821,
      },
      // loggingEnabled: true
    },
    // "https://rpc-mumbai.maticvigil.com",
    // "https://polygon-mumbai-bor.publicnode.com",
    // "wss://polygon-mumbai-bor.publicnode.com",
    // "https://polygon-mumbai.gateway.tenderly.co",
    // "wss://polygon-mumbai.gateway.tenderly.co"
    // "https://matic-mumbai.chainstacklabs.com"
    polygonMumbai: {
      // url: `https://rpc-mumbai.maticvigil.com`
      url: `https://polygon-mumbai-bor.publicnode.com`,
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
      url: `https://rpc2.sepolia.org`,
    },
    okx: {
      // mainnet
      // https://rpc.xlayer.tech
      // https://xlayerrpc.okx.com
      url: 'https://rpc.xlayer.tech',
      accounts: [process.env.PRIVATE_KEY_ADMIN || ''],
    },
    xlayer: {
      // testnet
      // https://testrpc.xlayer.tech
      // https://xlayertestrpc.okx.com/
      url: 'https://testrpc.xlayer.tech',
      accounts: [process.env.PRIVATE_KEY_ADMIN || ''],
    },
  },
  etherscan: {
    enabled: true,
    // Your API key for Etherscan
    // Obtain one at https://etherscan.io/
    apiKey: {
      mainnet: `${process.env.ETHERSCAN_API_KEY}`,
      sepolia: `${process.env.ETHERSCAN_API_KEY}`,
      polygonMumbai: `${process.env.POLYGONSCAN_API_KEY}`,
      polygon: `${process.env.POLYGONSCAN_API_KEY}`,
      xlayer: `${process.env.OKX_API_KEY}`,
      okx: `${process.env.OKX_API_KEY}`,
    },
    customChains: [
      {
        network: 'okx',
        chainId: 196,
        urls: {
          apiURL: 'https://www.oklink.com/api/v5/explorer/contract/verify-source-code-plugin/XLAYER',
          browserURL: 'https://www.oklink.com/xlayer ',
        },
      },
      {
        network: 'xlayer',
        chainId: 195, //196 for mainnet
        urls: {
          apiURL: 'https://www.oklink.com/api/v5/explorer/contract/verify-source-code-plugin/XLAYER_TESTNET', //or https://www.oklink.com/api/v5/explorer/contract/verify-source-code-plugin/XLAYER for mainnet
          browserURL: 'https://www.oklink.com/xlayer-test', //or https://www.oklink.com/xlayer for mainnet
        },
      },
    ],
  },
};

export default config;
