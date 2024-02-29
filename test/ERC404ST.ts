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
    const erc404st = await ERC404ST.deploy('Token', 'TKN', decimals, 1000, owner.address);

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

      expect (await erc404st.erc20BalanceOf(owner.address)).to.eq(1000n * 10n**decimals);

    });

    it('Transfer 1 unit to wallet1', async function () {
      const { erc404st, owner, w1, w2, decimals } = await loadFixture(deployFixture);
      await expect(erc404st.connect(owner).transferFrom(owner.address, w1.address, 10n**decimals - 1n )).to.emit(erc404st, 'ERC20Transfer').withArgs(owner.address, w1.address, 10n**decimals - 1n );
      
      let tokenId = await erc404st.encodeOwnerAndId(w1.address, 0)
      await expect(erc404st.connect(owner).transferFrom(owner.address, w1.address, 1n )).to.emit(erc404st, 'Transfer').withArgs(ethers.ZeroAddress , w1.address, tokenId);
      
      await expect(erc404st.connect(owner).transferFrom(w1.address, owner.address, 1n )).to.be.revertedWith("Not allowed to transfer");
      
      await expect(erc404st.connect(w1).transferFrom(w1.address, owner.address, 1n )).to.emit(erc404st, 'Transfer').withArgs( w1.address, ethers.ZeroAddress, tokenId);
      
      tokenId = await erc404st.encodeOwnerAndId(w1.address, 0)
      await expect(erc404st.connect(owner).transferFrom(owner.address, w1.address, 1n )).to.emit(erc404st, 'Transfer').withArgs(ethers.ZeroAddress , w1.address, tokenId);
      tokenId = await erc404st.encodeOwnerAndId(w1.address, 1)
      await expect(erc404st.connect(owner).transferFrom(owner.address, w1.address, 10n**decimals )).to.emit(erc404st, 'Transfer').withArgs(ethers.ZeroAddress , w1.address, tokenId);
      tokenId = await erc404st.encodeOwnerAndId(w1.address, 2)
      let tokenId2 = await erc404st.encodeOwnerAndId(w1.address, 3)
      // minted 2 ERC721 tokens
      await expect(erc404st.connect(owner).transferFrom(owner.address, w1.address, 2n*10n**decimals )).to.emit(erc404st, 'Transfer').withArgs(ethers.ZeroAddress , w1.address, tokenId).to.emit(erc404st, 'Transfer').withArgs(ethers.ZeroAddress , w1.address, tokenId2);

    });

    it('try to transfer from zero balance', async function () {
      const { erc404st, owner, w1, w2, decimals } = await loadFixture(deployFixture);
      await expect( erc404st.connect(w1).transfer( w2.address, 1 )).to.be.revertedWith("Insufficient balance");
      await expect( erc404st.connect(w1).transfer( w2.address, 2n**96n )).to.be.revertedWith("Its ID, not amount");
    });
    
    it('ownerOf first NFT', async function () {
      const { erc404st, owner, w1, w2, decimals } = await loadFixture(deployFixture);
      let tokenId = await erc404st.encodeOwnerAndId(w1.address, 0)
      await expect(erc404st.ownerOf(tokenId)).to.be.revertedWith("Mallable Token not found");
      await erc404st.connect(owner).transferFrom(owner.address, w1.address, 10n**decimals );
      expect( await erc404st.ownerOf(tokenId)).to.eq(w1.address);
      tokenId = await erc404st.encodeOwnerAndId(w1.address, 2)
      await erc404st.connect(owner).transferFrom(owner.address, w1.address, 2n * 10n**decimals );
      expect( await erc404st.ownerOf(tokenId)).to.eq(w1.address);
    });

    it('Solidify first NFT', async function () {
      const { erc404st, owner, w1, w2, decimals } = await loadFixture(deployFixture);
      let tokenId = await erc404st.encodeOwnerAndId(w1.address, 0)
      await expect(erc404st.connect(owner).solidify(tokenId )).to.be.revertedWith("Token doesnt exists");
      await erc404st.connect(owner).transferFrom(owner.address, w1.address, 10n**decimals );
      expect (await erc404st.solidifiedTotal(w1.address)).to.eq(0) 
      expect (await erc404st.ownedTotal(w1.address)).to.eq(0) 
      await expect(erc404st.connect(owner).solidify(tokenId )).to.be.revertedWith("Not owner nor approved");
      await expect(erc404st.connect(w1).solidify(tokenId )).to.emit(erc404st, "Solidified").withArgs(tokenId, w1.address);
      expect (await erc404st.solidifiedTotal(w1.address)).to.eq(1) 
      expect (await erc404st.ownedTotal(w1.address)).to.eq(1)}
    );
    it('Cant burn solidified', async function () {
      const { erc404st, owner, w1, w2, decimals } = await loadFixture(deployFixture);
      let tokenId = await erc404st.encodeOwnerAndId(w1.address, 0)
      await erc404st.connect(owner).transferFrom(owner.address, w1.address, 10n**decimals );
      await erc404st.connect(w1).solidify(tokenId )
      await expect(erc404st.connect(w1).transfer(owner.address, 1)).to.be.revertedWith("unsolidify tokens before transfer erc20");
    });

    it('Unsolidify to burn', async function () {
      const { erc404st, owner, w1, w2, decimals } = await loadFixture(deployFixture);
      let tokenId = await erc404st.encodeOwnerAndId(w1.address, 0)
      await erc404st.connect(owner).transferFrom(owner.address, w1.address, 10n**decimals );
      await erc404st.connect(w1).solidify(tokenId )
      await expect(erc404st.connect(w1).transfer(owner.address, 1)).to.be.revertedWith("unsolidify tokens before transfer erc20");
      await expect(erc404st.connect(w1).unSolidify(tokenId )).to.emit(erc404st, "UnSolidified").withArgs(tokenId, w1.address);
      await expect(erc404st.connect(w1).transfer(owner.address, 1)).to.emit(erc404st, "Transfer").withArgs(w1.address, ethers.ZeroAddress, tokenId);
    });

    it('Unsolidify by other wallet', async function () {
      const { erc404st, owner, w1, w2, decimals } = await loadFixture(deployFixture);
      let tokenId = await erc404st.encodeOwnerAndId(w1.address, 0)
      // await erc404st.connect(owner).transferFrom(owner.address, w1.address, 10n**decimals );
      // await erc404st.connect(w1).solidify(tokenId )
      // await expect(erc404st.connect(w1).transfer(owner.address, 1)).to.be.revertedWith("unsolidify tokens before transfer erc20");
      // await expect(erc404st.connect(w1).unSolidify(tokenId )).to.emit(erc404st, "UnSolidified").withArgs(tokenId, w1.address);
    });

    it('Solidify by transfer', async function () {
      const { erc404st, owner, w1, w2, decimals } = await loadFixture(deployFixture);
      let tokenId = await erc404st.encodeOwnerAndId(w1.address, 0)
      // await erc404st.connect(owner).transferFrom(owner.address, w1.address, 10n**decimals );
      // await erc404st.connect(w1).solidify(tokenId )
      // await expect(erc404st.connect(w1).transfer(owner.address, 1)).to.be.revertedWith("unsolidify tokens before transfer erc20");
      // await expect(erc404st.connect(w1).unSolidify(tokenId )).to.emit(erc404st, "UnSolidified").withArgs(tokenId, w1.address);
    });

    it('Mint when NFT#2 Solidified. make sure ID reserved', async function () {
      const { erc404st, owner, w1, w2, decimals } = await loadFixture(deployFixture);
      let tokenId = await erc404st.encodeOwnerAndId(w1.address, 0)
      await erc404st.connect(owner).transferFrom(owner.address, w1.address, 10n**decimals );
      await erc404st.connect(owner).transferFrom(owner.address, w1.address, 10n**decimals );
    });

    it('Solidify second NFT', async function () {
      const { erc404st, owner, w1, w2, decimals } = await loadFixture(deployFixture);
      let tokenId = await erc404st.encodeOwnerAndId(w1.address, 0)
      await erc404st.connect(owner).transferFrom(owner.address, w1.address, 10n**decimals );
      await erc404st.connect(owner).transferFrom(owner.address, w1.address, 10n**decimals );
    });

    it('Solidify by approved', async function () {
      const { erc404st, owner, w1, w2, decimals } = await loadFixture(deployFixture);
      let tokenId = await erc404st.encodeOwnerAndId(w1.address, 0)
    });

    it('UnSolidify by owner-minter', async function () {
      const { erc404st, owner, w1, w2, decimals } = await loadFixture(deployFixture);
      let tokenId = await erc404st.encodeOwnerAndId(w1.address, 0)
    });

    it('UnSolidify by owner-non-minter', async function () {
      const { erc404st, owner, w1, w2, decimals } = await loadFixture(deployFixture);
      let tokenId = await erc404st.encodeOwnerAndId(w1.address, 0)
    });

    it('UnSolidify by approved', async function () {
      const { erc404st, owner, w1, w2, decimals } = await loadFixture(deployFixture);
      let tokenId = await erc404st.encodeOwnerAndId(w1.address, 0)
    });

    it('Locked ERC20 when Solidified', async function () {
      const { erc404st, owner, w1, w2, decimals } = await loadFixture(deployFixture);
      let tokenId = await erc404st.encodeOwnerAndId(w1.address, 0)
    });
  });
});
