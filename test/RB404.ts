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

    const ST404 = (await ethers.getContractFactory('RB404')).connect(deployer);
    const erc404st = await ST404.deploy('Token', 'TKN', decimals, 100_000_000, owner.address,  owner.address, 1000, 2000);

    return { erc404st, owner, w1, w2, w3, w4 };
  }

  describe('ST404 Gas usage', function () {
    it('Show gas usage for transfer 1 ERC20', async function () {
      const { erc404st, owner, w1, w2, w3 } = await loadFixture(deployFixture);

      let gas = await erc404st.connect(owner).claim.estimateGas( ethers.zeroPadBytes( ethers.getBytes("0x1234"), 32 ),"2", w3.address);
      console.log(`Gas for 1 ERC20 transfer(whitelisted to whitelisted): ${gas}`);

    //   gas = await erc404st.connect(owner).transferFrom.estimateGas(owner.address, w3.address, 100n * oneERC20);
    //   console.log(`Gas for 100 ERC20 transfer(whitelisted to whitelisted): ${gas}`);

    //   gas = await erc404st.connect(owner).transferFrom.estimateGas(owner.address, w3.address, 1000n * oneERC20);
    //   console.log(`Gas for 1000 ERC20 transfer(whitelisted to whitelisted): ${gas}`);

    //   // await erc404st.connect(owner).transferFrom(owner.address, w3.address, 10n * oneERC20);

    //   gas = await erc404st.connect(owner).transferFrom.estimateGas(owner.address, w3.address, 10_000n * oneERC20);
    //   console.log(`Gas for 10_000 ERC20 transfer(whitelisted to whitelisted): ${gas}`);

    //   gas = await erc404st.connect(owner).transferFrom.estimateGas(owner.address, w3.address, 100_000n * oneERC20);
    //   console.log(`Gas for 100_000 ERC20 transfer(whitelisted to whitelisted): ${gas}`);

    //   gas = await erc404st.connect(owner).transferFrom.estimateGas(owner.address, w3.address, 1000_000n * oneERC20);
    //   console.log(`Gas for 1000_000 ERC20 transfer(whitelisted to whitelisted): ${gas}`);

      // let gas = await erc404st.connect(owner).transferFrom.estimateGas(owner.address, w1.address, oneERC20);
      // console.log(`Gas for 1 ERC20 transfer: ${gas}`);
      

    });
  });
});
