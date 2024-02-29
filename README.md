# ST404 (ScalableToken404 or SmartToken404) README

## Overview

ST404 introduces an innovative token standard that builds upon the ERC404 framework, aiming to optimize gas efficiency and incorporate dynamic, game-like elements into token transactions. This project merges the liquidity and transferability of ERC20 tokens with the unique identification and collectibility of ERC721 tokens. It is designed to address the challenges of high gas costs in large token transfers and enhance user engagement through unique token characteristics.

## Key Features

- **Deterministically Mapped NFTs**: Tokens in the adaptable pool have a unique NFT identity, determined by a token ID from the user's address and an index. This integration allows tokens to operate under both ERC20 and ERC721 standards, enhancing liquidity and uniqueness without the need for internal generation or storage.
- **Malleable Tokens**: Such Deterministically Mapped NFTs tokens are "malleable" and become "solidified" upon a ERC721 transfer. Assuming malleable ones are typically of less value and should be spent first, this contract prioritise their use in transactions in accordance with Gresham's law. Doing so ensures ERC20 transfers cost-effective by sparing the more valued, stored NFTs.
- **Dynamic Token ID System**: Efficient and unique token identification is achieved by generating token IDs through user address concatenation with an index.
- **Optimized Gas Consumption**: The approach reduces gas costs for ERC20 transactions while preserving ERC721's unique features.
- **ERC20 and ERC721 Compatibility**: Continuing ERC404's legacy, this contract fully supports both interfaces, optimizing transaction efficiency and dynamic collectibility.

## Design Philosophy

ST404 aims to create a hybrid token ecosystem that supports efficient token transactions without compromising on the unique characteristics of individual tokens. The project leverages a sequential ordering of tokens within a virtual space, ensuring that each token can be uniquely identified and collected. This approach addresses the scalability issues of the original ERC404 standard by optimizing gas usage and introducing a dynamic, interactive element to token management.

## Getting Started

This project comes with a sample contract, a test for that contract, and a script that deploys that contract.

Try running some of the following tasks:

```shell
npx hardhat help
npx hardhat test
REPORT_GAS=true npx hardhat test
npx hardhat node
npx hardhat run scripts/deploy.ts
```
