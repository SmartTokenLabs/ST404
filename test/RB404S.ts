import { time, loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { anyValue } from '@nomicfoundation/hardhat-chai-matchers/withArgs';
import { expect } from 'chai';
import { ethers } from 'hardhat';

async function sign(
	targetContract: string,
	to: string,
	signer: any
) {
	let abiCoder = new ethers.AbiCoder();
	let encoded = await abiCoder.encode(
		["address", "uint", "address"],
		[targetContract, 31337, to]
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
    const erc404StDev = await ERC404StDev.deploy('Token', 'TKN', decimals, 10_000, owner.address, owner.address, 1000);
        
    const ERC721Events = await ethers.getContractFactory('ERC721Events');
    const erc721events = await ERC721Events.attach(erc404st.target);


    return { erc404st, owner, w1, w2, w3, w4, erc721events, erc404StDev };
  }

  describe('claim', function () {
    it('Create signature, validate events', async function () {
      const { erc404st, owner, w1, w2, w3, erc721events, erc404StDev } = await loadFixture(deployFixture);
      let tokenId_w1_0 = await erc404StDev.encodeOwnerAndId(w1.address, 0);

      await expect(
        erc404st.connect(w1).claim(await sign(erc404st.target, w1.address, w2))
      )
        .to.emit(erc404st, "Transfer")
        .withArgs(ethers.ZeroAddress, w1.address, oneERC20)
        .to.emit(erc721events, "Transfer")
        .withArgs(ethers.ZeroAddress, w1.address, tokenId_w1_0)

    });

    it('is claimed?', async function () {
      const { erc404st, owner, w1, w2, w3, erc721events, erc404StDev } = await loadFixture(deployFixture);

      expect(await erc404st.claimedByWallet(w1.address)).to.eq(false)
      await erc404st.connect(w1).claim(await sign(erc404st.target, w1.address, w2))
      expect(await erc404st.claimedByWallet(w1.address)).to.eq(true)
      
    });

    it('one per wallet', async function () {
      const { erc404st, owner, w1, w2, w3, erc721events, erc404StDev } = await loadFixture(deployFixture);

      await erc404st.connect(w1).claim(await sign(erc404st.target, w1.address, w2))
      await expect(erc404st.connect(w1).claim(await sign(erc404st.target, w1.address, w2))).to.revertedWithCustomError(erc404st, "InvalidAmount")
      
    });

    it('claimed number', async function () {
      const { erc404st, owner, w1, w2, w3, erc721events, erc404StDev } = await loadFixture(deployFixture);

      expect(await erc404st.claimed()).to.eq(0)
      await erc404st.connect(w1).claim(await sign(erc404st.target, w1.address, w2))
      expect(await erc404st.claimed()).to.eq(1)
      
    });

    it('balance', async function () {
      const { erc404st, owner, w1, w2, w3, erc721events, erc404StDev } = await loadFixture(deployFixture);

      expect(await erc404st.balanceOf(w1.address)).to.eq(0)
      await erc404st.connect(w1).claim(await sign(erc404st.target, w1.address, w2))
      expect(await erc404st.balanceOf(w1.address)).to.eq(oneERC20)
      
    });


    it('Gas', async function () {
      const { erc404st, owner, w1, w2, w3, erc721events, erc404StDev } = await loadFixture(deployFixture);

      let gas = await 
        erc404st.connect(w1).claim.estimateGas(await sign(erc404st.target, w1.address, w2))
        console.log({gas})

    });

    it('setTotalClaimable', async function () {
      const { erc404st, owner, w1, w2, w3, erc721events, erc404StDev } = await loadFixture(deployFixture);

      await expect( erc404st.connect(w1).setTotalClaimable(1)).to.revertedWithCustomError(erc404st, "Unauthorized")
      await erc404st.connect(owner).setTotalClaimable(1)
      await erc404st.connect(w1).claim(await sign(erc404st.target, w1.address, w2))
      await expect(erc404st.connect(w3).claim(await sign(erc404st.target, w3.address, w2))).to.revertedWithCustomError(erc404st, "AllClaimed")
      
    });

    it('tokenURI', async function () {
      const { erc404st, owner, w1, w2, w3, erc721events, erc404StDev } = await loadFixture(deployFixture);
      let tokenId_w1_0 = await erc404StDev.encodeOwnerAndId(w1.address, 0);

      await erc404st.connect(w1).claim(await sign(erc404st.target, w1.address, w2))
      expect(await erc404st.tokenURI(tokenId_w1_0)).to.eq("https://api-dev.redbrick.land/v1/nft-profiles/"+tokenId_w1_0+"?chainId=31337")
      
    });
  });
});
