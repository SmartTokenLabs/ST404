import { time, loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { anyValue } from '@nomicfoundation/hardhat-chai-matchers/withArgs';
import { expect } from 'chai';
import { ethers } from 'hardhat';

describe('ERC404ST', function () {
  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshot in every test.
  async function deployFixture() {
    // Contracts are deployed using the first signer/account by default
    const [deployer, owner, w1, w2] = await ethers.getSigners();
    const decimals = 8n;

    const ERC404ST = (await ethers.getContractFactory('ERC404ST')).connect(deployer);
    const erc404st = await ERC404ST.deploy('Token', 'TKN', decimals, 100, owner.address);

    return { erc404st, owner, w1, w2, decimals };
  }

  describe('Deployment', function () {
    it('Should set the right owner', async function () {
      const { erc404st, owner, w1, w2 } = await loadFixture(deployFixture);

      expect(await erc404st.owner()).to.equal(owner.address);

      // await expect(lock.withdraw()).to.be.revertedWith("You can't withdraw yet");

      // await expect(lock.withdraw()).not.to.be.reverted;

      // await expect(lock.withdraw()).to.emit(lock, 'Withdrawal').withArgs(lockedAmount, anyValue); // We accept any value as `when` arg

      // await expect(lock.withdraw()).to.changeEtherBalances([owner, lock], [lockedAmount, -lockedAmount]);
    });

    it('Should encode owner and mallable ID correctly', async function () {
      const { erc404st, owner, w1, w2 } = await loadFixture(deployFixture);
      let mallableId = 123;

      const id = await erc404st.encodeOwnerAndId(owner.address, mallableId);
      // Highest bit means it tokenId, next 160bit = minter address, 95 bit - mallable ID      
      // const expectedId = ((BigInt(owner.address) << 96n) >> 1n | (1n << 255n) + BigInt(mallableId)).toString(16);
      // new encoding [address ¹⁶⁰] [sequentialID⁹⁶]
      const expectedId = ((BigInt(owner.address) << 96n) + BigInt(mallableId)).toString(16);

      expect(id).to.equal("0x" + expectedId);
      expect (await erc404st.decodeOwnerAndId(id)).to.deep.eq([owner.address, mallableId]);
      
      await expect(erc404st.decodeOwnerAndId((1n<<96n) - 1n)).not.to.be.reverted;
      await expect(erc404st.decodeOwnerAndId((1n<<96n) - 2n)).to.be.revertedWith("Invalid token ID");
    });
    it('Detect owner balance after deploy', async function () {
      const { erc404st, owner, w1, w2, decimals } = await loadFixture(deployFixture);

      expect (await erc404st.erc20BalanceOf(owner.address)).to.eq(100n * 10n**decimals);

    });

    it('Transfer 1 unit to wallet1', async function () {
      const { erc404st, owner, w1, w2, decimals } = await loadFixture(deployFixture);
      await expect(erc404st.connect(owner).transferFrom(owner.address, w1.address, 10n**decimals - 1n )).to.emit(erc404st, 'ERC20Transfer').withArgs(owner.address, w1.address, 10n**decimals - 1n );
      
      let tokenID = await erc404st.encodeOwnerAndId(w1.address, 0)
      await expect(erc404st.connect(owner).transferFrom(owner.address, w1.address, 1n )).to.emit(erc404st, 'Transfer').withArgs(ethers.ZeroAddress , w1.address, tokenID);
      
      await expect(erc404st.connect(owner).transferFrom(w1.address, owner.address, 1n )).to.be.revertedWith("Not allowed to transfer");

      // await expect(erc404st.connect(w1).transferFrom(w1.address, owner.address, 1n )).to.emit(erc404st, 'Transfer').withArgs( w1.address, ethers.ZeroAddress, tokenID);

      // tokenID = await erc404st.encodeOwnerAndId(w1.address, 0)
      // await expect(erc404st.connect(w1).transferFrom(w1.address, owner.address, 1n )).to.emit(erc404st, 'Transfer').withArgs( w1.address, ethers.ZeroAddress, tokenID);

    });
  });
});
