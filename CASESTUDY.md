# CASE STUDY

Here's a detailed scenario that encapsulates the token transformation and transfer process described in (README)[README.md]:

1. **Initial State**:
   - Alice owns a unique ERC721 token identified as `0x89..64....0001`, where `0x89..64` is her wallet address.
   - Bob and Charle have no tokens.

2. **Alice Sends ERC721 to Bob**:
   - Alice decides to transfer her ERC721 token (`0x89..64....0001`) to Bob.
   - After the transfer, Alice's balance is 0 (as she no longer owns the token), and Bob's balance is increased by 1 ERC721 token (`0x89..64....0001`).

3. **Bob Transforms and Transfers to Charle**:
   - Bob wants to send a portion of the value encapsulated by the ERC721 token to Charle in the form of ERC20 tokens.
   - He transforms the ERC721 token into a malleable state, allowing him to split its value.
   - Bob then sends 0.5 of an ERC20 token to Charle, a process facilitated by the smart contract's capability to handle fractional values from malleable tokens.

4. **Final State**:
   - **Alice**: No longer has the ERC721 token and thus has a balance of 0.
   - **Bob**: Retains 0.5 ERC20, indicating a partial utilization of the token's value.
   - **Charle**: Receives 0.5 ERC20 from Bob, which represents his new balance.
   - **No one** owns the ERC721 token by the ID `0x89..64....0001` any more. It's permanently gone.

This scenario illustrates the conversion of token states from non-fungible (ERC721) to fungible (ERC20) and their transfer between parties, showcasing the flexibility and liquidity options provided by this innovative token standard.

We can conceptualise the table based on the scenario provided, where Alice sends an ERC721 token to Bob, and then Bob transforms this token to send 0.5 of an ERC20 token to Charle. The `balanceOf()` function's return values for Alice, Bob, and Charle will be shown in the context of before and after the transactions:

| Return Value of `balanceOf()` | Alice | Bob  | Charle |
|-------------------------------|-------|------|------|
| Before Transaction            | 1     | 0    | 0    |
| After Alice sends to Bob      | 0     | 1    | 0    |
| After Bob transforms & sends to Charle | 0 | 0.5  | 0.5  |

- "Before Transaction" shows the initial state before any transfers.
- "After Alice sends to Bob" reflects the state after Alice has transferred the ERC721 token to Bob, leading to Alice's balance decreasing by 1 and Bob's increasing by 1.
- "After Bob transforms & sends to Charle" demonstrates Bob's action of converting the ERC721 token into a malleable form and then transferring 0.5 of an ERC20 token to Charle. This results in Bob having a balance of 0.5 ERC20 tokens and Charle receiving 0.5 ERC20 tokens.

The following table shows the changes in ERC721 ownership for each participant at different stages of the transactions based on the scenario described.

To accurately illustrate the output of `tokenOfOwnerByIndex(0)` for Alice, Bob, and Charle in each scenario, we'll follow the logic provided in the initial context. This function typically returns the token ID at a specified index for a given owner. Assuming that the index `0` refers to the first token owned by an address if any, here's how the outcomes would look based on the described transactions:

1. **Before any transaction**:
   - Alice, Bob, and Charle haven't performed any transactions yet.
   - The function `tokenOfOwnerByIndex(0)` would return the first token ID owned by the caller if they own any tokens.

2. **After Alice sends an ERC721 token to Bob**:
   - Alice's balance is 0; thus, she owns no tokens.
   - Bob now owns 1 ERC721 token, which was transferred from Alice.
   - Charle still owns no tokens at this stage.

3. **After Bob transforms an ERC721 token and sends 0.5 of an ERC20 token to Charle**:
   - Alice still owns no tokens.
   - Bob has transformed his ERC721 token into malleable form and partially transferred its value as ERC20 tokens, affecting his ERC721 ownership.
   - Charle has received ERC20 tokens, not ERC721, so his ERC721 token ownership remains unaffected.

Given these actions, here's the expected output of `tokenOfOwnerByIndex(0)` for each participant:

| Action | `tokenOfOwnerByIndex(0)` for Alice | `tokenOfOwnerByIndex(0)` for Bob | `tokenOfOwnerByIndex(0)` for Charle |
|--------|------------------------------------|----------------------------------|-----------------------------------|
| Before Transaction | `0x89..64....0001` | No Token (Bob owns no tokens yet) | No Token (Charle owns no tokens) |
| After Alice sends to Bob | No Token (Alice now owns no tokens) | `0x89..64....0001` | No Token (Charle still owns no tokens) |
| After Bob transforms & sends to Charle | No Token | No Token | No Token (Charle receives ERC20 tokens, not ERC721) |

It's important to note that the transformation of an ERC721 token into a malleable form and its partial transfer as ERC20 tokens to Charle would not generate a new ERC721 token ID for Charle, as he receives ERC20 tokens, and not a whole unit of it. Therefore, `tokenOfOwnerByIndex(0)` would not return a token ID for Charle in this context.
