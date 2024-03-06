import { time, loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { anyValue } from '@nomicfoundation/hardhat-chai-matchers/withArgs';
import { expect } from 'chai';
import { ethers } from 'hardhat';

describe('ST404', function () {
  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshot in every test.
  const decimals = 8n;
  const oneERC20 = 10n ** decimals;
  async function deployFixture() {
    // Contracts are deployed using the first signer/account by default
    const [deployer, owner, w1, w2, w3, w4] = await ethers.getSigners();

    const ST404 = (await ethers.getContractFactory('ERC404StDev')).connect(deployer);
    const erc404st = await ST404.deploy('Token', 'TKN', decimals, 10000, owner.address, true);

    return { erc404st, owner, w1, w2, w3, w4 };
  }

  describe('ST404 Gas usage', function () {
    it('Show gas usage for transfer 1 ERC20', async function () {
      const { erc404st, owner, w1, w2, w3 } = await loadFixture(deployFixture);
      let tokenId = await erc404st.encodeOwnerAndId(w1.address, 0);
      let gas = await erc404st.connect(owner).transferFrom.estimateGas(owner.address, w1.address, oneERC20);
      console.log(`Gas for 1 ERC20 transfer: ${gas}`);
      
      // 'Show gas usage for transfer 10 ERC20'
      gas = await erc404st.connect(owner).transferFrom.estimateGas(owner.address, w1.address, 10n * oneERC20);
      console.log(`Gas for 10 ERC20 transfer: ${gas} (10 Transfer events from owner)`);

      gas = await erc404st.connect(owner).transferFrom.estimateGas(owner.address, w1.address, 100n * oneERC20);
      console.log(`Gas for 100 ERC20 transfer: ${gas} (100 Transfer events from owner)`);

      await erc404st.connect(owner).transferFrom(owner.address, w1.address, 100n * oneERC20)
      gas = await erc404st.connect(w1).transferFrom.estimateGas(w1.address, w2.address, 100n * oneERC20);
      console.log(`Gas for 100 ERC20 retransfer: ${gas} (100 Transfer events from a user account to another account)`);

      await erc404st.connect(owner).transferFrom(owner.address, w1.address, 2900n * oneERC20)
      gas = await erc404st.connect(w1).transferFrom.estimateGas(w1.address, w2.address, 2900n * oneERC20);
      console.log(`Gas for 2900 ERC20 retransfer: ${gas} (2900 Transfer events from a user account to another account)`);
      
      await erc404st.connect(owner).transferFrom(owner.address, w1.address, oneERC20);
      gas = await erc404st.connect(w1).transferFrom.estimateGas(w1.address, w2.address, tokenId);
      console.log(`Gas for 1 ERC721 transfer: ${gas}`);
      
      await erc404st.connect(w1).transferFrom(w1.address, w2.address, tokenId);
      gas = await erc404st.connect(w2).transferFrom.estimateGas(w2.address, w3.address, tokenId);
      console.log(`Gas for 1 ERC721 transfer(second transfer): ${gas}`);

      await erc404st.connect(w2).transferFrom(w2.address, w3.address, tokenId);
      gas = await erc404st.connect(w3).transferFrom.estimateGas(w3.address, w1.address, tokenId);
      console.log(`Gas for 1 ERC721 transfer(back to minter): ${gas}`);

    });
  });
});
