import { time, loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { anyValue } from '@nomicfoundation/hardhat-chai-matchers/withArgs';
import { expect } from 'chai';
import { ethers } from 'hardhat';

async function sign(
  uid: string,
  id:string,
	targetContract: string,
	to: string,
	amount: bigint,
	signer: any
) {
	let abiCoder = new ethers.AbiCoder();
	let encoded = await abiCoder.encode(
		["bytes32", "bytes32", "address", "uint", "address", "uint"],
		[uid, ethers.keccak256(ethers.toUtf8Bytes(id)), targetContract, 31337, to, amount]
	);
	return await signer.signMessage(ethers.getBytes(ethers.keccak256(encoded)));
}

describe('RB404S', function () {
  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshot in every test.
  const decimals = 8n;
  const oneERC20 = 10n ** decimals;
  async function deployFixture() {
    // Contracts are deployed using the first signer/account by default
    const [deployer, owner, w1, w2, w3, w4] = await ethers.getSigners();

    const ST404 = (await ethers.getContractFactory('RB404S')).connect(deployer);
    const erc404st = await ST404.deploy('Token', 'TKN', decimals, 100_000_000, owner.address,  owner.address, 1000, 2000, w2.address);

    const ERC404StDev = (await ethers.getContractFactory('ERC404StDev')).connect(deployer);
    const erc404StDev = await ERC404StDev.deploy('Token', 'TKN', decimals, 100_000_000, owner.address,  owner.address, 1000);
        
    const ERC721Events = await ethers.getContractFactory('ERC721Events');
    const erc721events = await ERC721Events.attach(erc404st.target);


    return { erc404st, owner, w1, w2, w3, w4, erc721events, erc404StDev };
  }

  describe('bulkClaim', function () {
    it('Create signature, validate events', async function () {
      const { erc404st, owner, w1, w2, w3, erc721events, erc404StDev } = await loadFixture(deployFixture);
      let tokenId_w1_0 = await erc404StDev.encodeOwnerAndId(w1.address, 0);
      let tokenId_w1_4 = await erc404StDev.encodeOwnerAndId(w1.address, 0);

      const params = [ethers.zeroPadBytes( ethers.getBytes("0x01"), 32 ), "1" ]
      await expect(
        erc404st.connect(w1).bulkClaim(...params, 5, await sign(...params, erc404st.target, w1.address, 5, w2))
      )
        .to.emit(erc404st, "Transfer")
        .withArgs(ethers.ZeroAddress, w1.address, oneERC20 * 5n)
        .to.emit(erc721events, "Transfer")
        .withArgs(ethers.ZeroAddress, w1.address, tokenId_w1_0)
        .to.emit(erc721events, "Transfer")
        .withArgs(ethers.ZeroAddress, w1.address, tokenId_w1_4);

    });
  });
});
