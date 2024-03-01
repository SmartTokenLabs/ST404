# ST404 (ScalableToken404 or SmartToken404)

## Overview

ST404 introduces an innovative token standard that builds upon the ERC404 works, aiming to optimise gas efficiency and incorporate dynamic, game-like elements into token transactions. This project merges the liquidity and transferability of ERC20 tokens with the unique identification and collectibility of ERC721 tokens. It is designed to address the challenges of high gas costs in large token transfers and enhance user engagement through unique token characteristics.

## Key Features

- **Deterministically Mapped NFTs**: Tokens in the adaptable pool have a unique NFT identity, determined by a token ID from the user's address and an index. This integration allows tokens to operate under both ERC20 and ERC721 standards, enhancing liquidity and uniqueness without the need for internal generation or storage.
- **Malleable Tokens**: Such Deterministically Mapped NFTs tokens are "malleable" and become "solidified" upon a ERC721 transfer. Assuming malleable ones are typically of less value and should be spent first, this contract prioritise their use in transactions in accordance with Gresham's law. Doing so ensures ERC20 transfers cost-effective by sparing the more valued, stored NFTs.
- **Dynamic Token ID System**: Efficient and unique token identification is achieved by generating token IDs through user address concatenation with an index.
- **Optimised Gas Consumption**: The approach reduces gas costs for ERC20 transactions while preserving ERC721's unique features.
- **ERC20 and ERC721 Compatibility**: This contract fully supports both interfaces, optimizing transaction efficiency and dynamic collectibility. This includes enabling users to execute ERC20 transfer(address recipient, uint256 amount) to transfer their entire balance, regardless of the malleable and solidified NFT tokens mechanism, for seamless integration and user flexibility.
- **Unified Token Transfer Mechanism**: This contract supports a unified ERC20 transfer function applicable to both malleable tokens and solidified NFTs. While malleable tokens are queued to be transferred first, **the contract does allow solidified tokens to be transferred out via the ERC20 mechanism when no more malleable tokens are left**. This design guarantees that all tokens, regardless of their state, can participate in ERC20 mechanism and DeFi markets, maximising liquidity. However, it also implies users must exercise caution to avoid inadvertently transferring solidified NFTs through ERC20 transfers unintendedly, especially when dealing with their final tokens.

## Design Details

### Deduced Existence vs. Physical Storage

"NFTs' existence need not be stored if it can be logically deduced" captures ST404's philosophy. The system uniquely identifiesn most tokens using the combination of a user's address and a sequential index, negating the need for traditional storage mechanisms. This approach significantly enhances scalability and gas efficiency.

### Malleability Versus Solidification

Using Alice's token transfer to Bob as an example, suppose Alice has one unit of token, normally, its ID is its address followed by token index. So if her address is 0x8964...8964, the token ID is 0x8964896489648964896489648964896489648964....0001. This ID is deduced and not stored in the contract. Let's differentiate between ERC20 and ERC721 transfers:

#### ERC20 Transfer:
- **Action**: Alice executes `transfer(bob, 100000000)` to send 1 unit (assuming 8 decimals) to Bob.
- **Outcomes**:
  1. An ERC20 event records the token transfer from Alice to Bob.
  2. ERC721 compatibility events for burning Alice's token and minting a new one for Bob occur without altering storage, leaving `_owned` and `_ownedData` mappings unchanged.
  3. Now Bob has one token, whose id is Bob's address followed by ...0001. This is again deduced and not stored.

#### ERC721 Transfer:
- **Action**: Alice uses `transferFrom(alice, bob, 0x8964896489648964896489648964896489648964....0001)` for direct token transfer.
- **Outcomes**:
  1. An ERC20 event logs the unit transfer from Alice to Bob.
  2. An ERC721 event signifies the specific token's transfer, affecting both `_owned` and `_ownedData` mappings
  3. Alice now has one less malleable token, while Bob has one more solidified tokens.

This structuring aims to provide a clearer understanding for developers on how ST404 balances between token malleability and efficiency, highlighting the system's nuanced operations.

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
