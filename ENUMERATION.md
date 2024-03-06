Like the ERC404 protocol this project is based on, ST404 does not fully implement the `ERC721Enumerable` protocol. To enumerate all tokens, use this process

**Step 1**:

| Using ERC20/721 interface                                    | Using special interface                                      |
| ------------------------------------------------------------ | ------------------------------------------------------------ |
| The user calls `balanceOf` with their address to get their balance, which is represented in the ERC20 sense and includes the total ERC20 token balance held by the user. To convert this balance into an NFT count, the user must divide the ERC20 balance by the unit size that represents a single NFT in this system, and do `floor()` on the result. This division would give the total number of NFTs (both solidified and malleable, if applicable) represented by the user's ERC20 token balance. | The user calls `erc721balanceOf` with their address to get the total number of NFT tokens they own. This method returns an integer value representing the total count of ERC721 tokens (both solidified and malleable tokens, if malleable tokens are treated as ERC721 for enumeration purposes). |

**Step 2**:

Enumerate NFT Tokens: After calculating the total NFT count, the user can call `tokenOfOwnerByIndex(owner, index)` in a loop, starting from index = 0 up to the total number of NFTs minus one. This method should return the IDs of owned tokens in sequence, beginning with solidified tokens and then covering malleable tokens, if the contract logic supports enumerating malleable tokens alongside solidified ones.