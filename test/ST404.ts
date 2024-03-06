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
    const erc404st = await ST404.deploy('Token', 'TKN', decimals, 1000, owner.address);

    return { erc404st, owner, w1, w2, w3, w4 };
  }

  it('Should set the right owner', async function () {
    const { erc404st, owner, w1, w2 } = await loadFixture(deployFixture);

    expect(await erc404st.owner()).to.equal(owner.address);
    // await expect(lock.withdraw()).not.to.be.reverted;
  });

  it('Should encode owner and mallable ID correctly', async function () {
    const { erc404st, owner, w1, w2 } = await loadFixture(deployFixture);
    let mallableId = 123;

    const id = await erc404st.encodeOwnerAndId(owner.address, mallableId);
    // Highest bit means it tokenId, next 160bit = minter address, 95 bit - mallable ID
    // const expectedId = ((BigInt(owner.address) << 96n) >> 1n | (1n << 255n) + BigInt(mallableId)).toString(16);
    // new encoding [address ¹⁶⁰] [sequentialID⁹⁶]
    const expectedId = ((BigInt(owner.address) << 96n) + BigInt(mallableId)).toString(16);

    expect(id).to.equal('0x' + expectedId);
    expect(await erc404st.decodeOwnerAndId(id)).to.deep.eq([owner.address, mallableId]);

    await expect(erc404st.decodeOwnerAndId((1n << 96n) - 1n)).not.to.be.reverted;
    await expect(erc404st.decodeOwnerAndId((1n << 96n) - 2n)).to.be.revertedWith('Invalid token ID');
  });

  it('Detect owner balance after deploy', async function () {
    const { erc404st, owner, w1, w2 } = await loadFixture(deployFixture);

    expect(await erc404st.balanceOf(owner.address)).to.eq(1000n * oneERC20);
  });

  it('Transfer 1 unit to wallet1', async function () {
    const { erc404st, owner, w1, w2 } = await loadFixture(deployFixture);
    await expect(erc404st.connect(owner).transferFrom(owner.address, w1.address, oneERC20 - 1n))
      .to.emit(erc404st, 'ERC20Transfer')
      .withArgs(owner.address, w1.address, oneERC20 - 1n);

    let tokenId = await erc404st.encodeOwnerAndId(w1.address, 0);
    await expect(erc404st.connect(owner).transferFrom(owner.address, w1.address, 1n))
      .to.emit(erc404st, 'Transfer')
      .withArgs(ethers.ZeroAddress, w1.address, tokenId);

    await expect(erc404st.connect(owner).transferFrom(w1.address, owner.address, 1n)).to.be.revertedWithCustomError(
      erc404st,
      'Unauthorized',
    );

    await expect(erc404st.connect(w1).transferFrom(w1.address, owner.address, 1n))
      .to.emit(erc404st, 'Transfer')
      .withArgs(w1.address, ethers.ZeroAddress, tokenId);

    tokenId = await erc404st.encodeOwnerAndId(w1.address, 0);
    await expect(erc404st.connect(owner).transferFrom(owner.address, w1.address, 1n))
      .to.emit(erc404st, 'Transfer')
      .withArgs(ethers.ZeroAddress, w1.address, tokenId);

    tokenId = await erc404st.encodeOwnerAndId(w1.address, 1);
    await expect(erc404st.connect(owner).transferFrom(owner.address, w1.address, oneERC20))
      .to.emit(erc404st, 'Transfer')
      .withArgs(ethers.ZeroAddress, w1.address, tokenId);

    tokenId = await erc404st.encodeOwnerAndId(w1.address, 2);
    let tokenId2 = await erc404st.encodeOwnerAndId(w1.address, 3);
    // minted 2 ERC721 tokens
    await expect(erc404st.connect(owner).transferFrom(owner.address, w1.address, 2n * oneERC20))
      .to.emit(erc404st, 'Transfer')
      .withArgs(ethers.ZeroAddress, w1.address, tokenId)
      .to.emit(erc404st, 'Transfer')
      .withArgs(ethers.ZeroAddress, w1.address, tokenId2);
  });

  it('try to transfer from zero balance', async function () {
    const { erc404st, owner, w1, w2 } = await loadFixture(deployFixture);
    await expect(erc404st.connect(w1).transfer(w2.address, 1)).to.be.revertedWith('Insufficient balance');
    await expect(erc404st.connect(w1).transfer(w2.address, 2n ** 96n)).to.be.revertedWith('Token doesnt exists');
  });

  describe('ERC20 + ERC721 transfers', function () {
    it('ERC721 + ERC20 malleable, solidified', async function () {
      const { erc404st, owner, w1, w2, w3 } = await loadFixture(deployFixture);
      let tokenId = await erc404st.encodeOwnerAndId(w1.address, 0);
      await erc404st.connect(owner).transferFrom(owner.address, w1.address, oneERC20);
      expect(await erc404st.balanceOf(w1.address)).to.eq(oneERC20);
      await erc404st.connect(w1).transferFrom(w1.address, w2.address, tokenId);
      expect(await erc404st.balanceOf(w1.address)).to.eq(0);
      expect(await erc404st.balanceOf(w2.address)).to.eq(oneERC20);

      await erc404st.connect(w2).transferFrom(w2.address, w3.address, tokenId);
      expect(await erc404st.balanceOf(w2.address)).to.eq(0);
      expect(await erc404st.balanceOf(w3.address)).to.eq(oneERC20);
    });

    it('ERC20 +  ERC721 malleable, soldified', async function () {
      const { erc404st, owner, w1, w2 } = await loadFixture(deployFixture);
      let tokenId_w1_0 = await erc404st.encodeOwnerAndId(w1.address, 0);
      let tokenId_w1_1 = await erc404st.encodeOwnerAndId(w1.address, 1);
      let tokenId_w1_2 = await erc404st.encodeOwnerAndId(w1.address, 2);
      let tokenId_w2_0 = await erc404st.encodeOwnerAndId(w2.address, 0);
      let tokenId_w2_1 = await erc404st.encodeOwnerAndId(w2.address, 1);

      await erc404st.connect(owner).transferFrom(owner.address, w1.address, 2n * oneERC20);
      expect(await erc404st.balanceOf(w1.address)).to.eq(2n * oneERC20);
      expect(await erc404st.solidifiedTotal(w1.address)).to.eq(0);
      expect(await erc404st.ownedTotal(w1.address)).to.eq(0);
      expect(await erc404st.ownerOf(tokenId_w1_0)).to.eq(w1.address);
      expect(await erc404st.ownerOf(tokenId_w1_1)).to.eq(w1.address);
      await expect(erc404st.ownerOf(tokenId_w1_2)).to.revertedWith('Token not found');
      await expect(erc404st.ownerOf(tokenId_w2_0)).to.revertedWith('Token not found');

      await erc404st.connect(w1).transferFrom(w1.address, w2.address, oneERC20);
      expect(await erc404st.balanceOf(w1.address)).to.eq(oneERC20);
      expect(await erc404st.balanceOf(w2.address)).to.eq(oneERC20);
      expect(await erc404st.solidifiedTotal(w1.address)).to.eq(0);
      expect(await erc404st.ownedTotal(w1.address)).to.eq(0);
      expect(await erc404st.solidifiedTotal(w2.address)).to.eq(0);
      expect(await erc404st.ownedTotal(w2.address)).to.eq(0);

      expect(await erc404st.ownerOf(tokenId_w1_0)).to.eq(w1.address);
      await expect(erc404st.ownerOf(tokenId_w1_1)).to.revertedWith('Token not found');
      expect(await erc404st.ownerOf(tokenId_w2_0)).to.eq(w2.address);
      await expect(erc404st.ownerOf(tokenId_w2_1)).to.revertedWith('Token not found');
    });
  });

  it('Mint when NFT#2 Solidified. make sure ID reserved', async function () {
    const { erc404st, owner, w1, w2 } = await loadFixture(deployFixture);
    await erc404st.connect(owner).transferFrom(owner.address, w1.address, 2n * oneERC20);
    let tokenId = await erc404st.encodeOwnerAndId(w1.address, 1);
    await erc404st.connect(w1).transferFrom(w1.address, w2.address, tokenId);

    tokenId = await erc404st.encodeOwnerAndId(w1.address, 2);
    await expect(erc404st.connect(owner).transferFrom(owner.address, w1.address, oneERC20))
      .to.emit(erc404st, 'Transfer')
      .withArgs(ethers.ZeroAddress, w1.address, tokenId);
  });

  describe('Burn', function () {
    it('Burn Malleable and solidified', async function () {
      const { erc404st, owner, w1, w2 } = await loadFixture(deployFixture);
      let tokenId_w1_0 = await erc404st.encodeOwnerAndId(w1.address, 0);
      let tokenId_w1_1 = await erc404st.encodeOwnerAndId(w1.address, 1);

      await erc404st.connect(owner).transferFrom(owner.address, w1.address, 2n * oneERC20);
      expect(await erc404st.balanceOf(w1.address)).to.eq(2n * oneERC20);
      expect(await erc404st.solidifiedTotal(w1.address)).to.eq(0);
      expect(await erc404st.ownedTotal(w1.address)).to.eq(0);
      expect(await erc404st.ownerOf(tokenId_w1_0)).to.eq(w1.address);
      expect(await erc404st.ownerOf(tokenId_w1_1)).to.eq(w1.address);
      await expect(erc404st.connect(owner).burn(tokenId_w1_1)).to.revertedWithCustomError(erc404st, 'Unauthorized');
      await expect(erc404st.connect(w1).burn(tokenId_w1_1))
        .to.emit(erc404st, 'Transfer')
        .withArgs(w1.address, ethers.ZeroAddress, tokenId_w1_1)
        .emit(erc404st, 'Solidified')
        .withArgs(w1.address, tokenId_w1_1)
        .emit(erc404st, 'ERC20Transfer')
        .withArgs(w1.address, ethers.ZeroAddress, oneERC20);

      await expect(erc404st.ownerOf(tokenId_w1_1)).to.revertedWith('Token not found');

      await expect(erc404st.connect(w1).transferFrom(w1.address, w2.address, tokenId_w1_0))
        .emit(erc404st, 'Transfer')
        .withArgs(w1.address, w2.address, tokenId_w1_0)
        .emit(erc404st, 'Solidified')
        .withArgs(w1.address, tokenId_w1_0);

      await expect(erc404st.connect(w2).burn(tokenId_w1_0))
        .to.emit(erc404st, 'Transfer')
        .withArgs(w2.address, ethers.ZeroAddress, tokenId_w1_0)
        .emit(erc404st, 'ERC20Transfer')
        .withArgs(w2.address, ethers.ZeroAddress, oneERC20);

      await expect(erc404st.ownerOf(tokenId_w1_1)).to.revertedWith('Token not found');
      await expect(erc404st.ownerOf(tokenId_w1_0)).to.revertedWith('Token not found');
    });

    it('Burn ERC721 then tokenId will be locked', async function () {
      const { erc404st, owner, w1, w2 } = await loadFixture(deployFixture);
      let tokenId_w1_0 = await erc404st.encodeOwnerAndId(w1.address, 0);
      let tokenId_w1_1 = await erc404st.encodeOwnerAndId(w1.address, 1);
      let tokenId_w1_2 = await erc404st.encodeOwnerAndId(w1.address, 2);

      await erc404st.connect(owner).transferFrom(owner.address, w1.address, 2n * oneERC20);
      await erc404st.connect(w1).burn(tokenId_w1_1);
      await erc404st.connect(owner).transferFrom(owner.address, w1.address, oneERC20);

      expect(await erc404st.balanceOf(w1.address)).to.eq(2n * oneERC20);
      expect(await erc404st.solidifiedTotal(w1.address)).to.eq(1);
      expect(await erc404st.ownerOf(tokenId_w1_0)).to.eq(w1.address);
      expect(await erc404st.ownerOf(tokenId_w1_2)).to.eq(w1.address);
      await expect(erc404st.ownerOf(tokenId_w1_1)).to.revertedWith('Token not found');
    });

    it('Burn ERC20 + Burn ERC721', async function () {
      const { erc404st, owner, w1, w2 } = await loadFixture(deployFixture);
      let tokenId_w1_0 = await erc404st.encodeOwnerAndId(w1.address, 0);
      let tokenId_w1_1 = await erc404st.encodeOwnerAndId(w1.address, 1);

      await erc404st.connect(owner).transferFrom(owner.address, w1.address, 2n * oneERC20);
      expect(await erc404st.solidifiedTotal(w1.address)).to.eq(0);
      expect(await erc404st.ownerOf(tokenId_w1_0)).to.eq(w1.address);
      expect(await erc404st.ownerOf(tokenId_w1_1)).to.eq(w1.address);

      await expect(erc404st.connect(w1).burn(oneERC20))
        .to.emit(erc404st, 'Transfer')
        .withArgs(w1.address, ethers.ZeroAddress, tokenId_w1_1)
        .emit(erc404st, 'ERC20Transfer')
        .withArgs(w1.address, ethers.ZeroAddress, oneERC20);
      await expect(erc404st.ownerOf(tokenId_w1_1)).to.revertedWith('Token not found');

      expect(await erc404st.balanceOf(w1.address)).to.eq(oneERC20);
    });

    it('Burn ERC20 + Burn first solidified ERC721', async function () {
      const { erc404st, owner, w1, w2 } = await loadFixture(deployFixture);
      let tokenId_w1_0 = await erc404st.encodeOwnerAndId(w1.address, 0);
      let tokenId_w1_1 = await erc404st.encodeOwnerAndId(w1.address, 1);

      await erc404st.connect(owner).transferFrom(owner.address, w1.address, 2n * oneERC20);
      await erc404st.connect(w1).transferFrom(w1.address, w2.address, tokenId_w1_0);
      await erc404st.connect(w1).transferFrom(w1.address, w2.address, tokenId_w1_1);
      expect(await erc404st.ownerOf(tokenId_w1_0)).to.eq(w2.address);
      expect(await erc404st.ownerOf(tokenId_w1_1)).to.eq(w2.address);
      expect(await erc404st.ownedTotal(w2.address)).to.eq(2);
      expect(await erc404st.getOwned(w2.address, 0)).to.eq(tokenId_w1_0);
      expect(await erc404st.getOwned(w2.address, 1)).to.eq(tokenId_w1_1);
      expect(await erc404st.ownedTotal(w2.address)).to.eq(2);
      await expect(erc404st.connect(w2).burn(oneERC20))
        .to.emit(erc404st, 'Transfer')
        .withArgs(w2.address, ethers.ZeroAddress, tokenId_w1_0)
        .emit(erc404st, 'ERC20Transfer')
        .withArgs(w2.address, ethers.ZeroAddress, oneERC20);
      expect(await erc404st.ownedTotal(w2.address)).to.eq(1);

      await expect(erc404st.ownerOf(tokenId_w1_0)).to.revertedWith('Token not found');

      expect(await erc404st.balanceOf(w2.address)).to.eq(oneERC20);
    });
  });

  describe('Check owner', function () {
    it('ownerOf first NFT', async function () {
      const { erc404st, owner, w1, w2 } = await loadFixture(deployFixture);
      let tokenId = await erc404st.encodeOwnerAndId(w1.address, 0);
      await expect(erc404st.ownerOf(tokenId)).to.be.revertedWith('Token not found');
      await erc404st.connect(owner).transferFrom(owner.address, w1.address, oneERC20);
      expect(await erc404st.ownerOf(tokenId)).to.eq(w1.address);
      tokenId = await erc404st.encodeOwnerAndId(w1.address, 2);
      await erc404st.connect(owner).transferFrom(owner.address, w1.address, 2n * oneERC20);
      expect(await erc404st.ownerOf(tokenId)).to.eq(w1.address);
    });

    it('Mallable Owner non-existent', async function () {
      const { erc404st, owner, w1, w2 } = await loadFixture(deployFixture);
      let tokenId = await erc404st.encodeOwnerAndId(w1.address, 0);
      await expect(erc404st.ownerOf(tokenId)).to.be.revertedWith('Token not found');
    });

    it('Owned Owner', async function () {
      const { erc404st, owner, w1, w2 } = await loadFixture(deployFixture);
      let tokenId_w1_0 = await erc404st.encodeOwnerAndId(w1.address, 0);
      let tokenId_w1_1 = await erc404st.encodeOwnerAndId(w1.address, 1);
      await erc404st.connect(owner).transferFrom(owner.address, w1.address, oneERC20);
      await erc404st.connect(w1).transferFrom(w1.address, w2.address, tokenId_w1_0);
      expect(await erc404st.ownerOf(tokenId_w1_0)).to.eq(w2.address);
      await expect(erc404st.ownerOf(tokenId_w1_1)).to.be.revertedWith('Token not found');
    });
  });

  describe('Approved', function () {
    it('Approve ERC20', async function () {
      const { erc404st, owner, w1, w2, w3 } = await loadFixture(deployFixture);

      await expect(erc404st.connect(owner).transferFrom(owner.address, w1.address, 2n * oneERC20)).to.emit(
        erc404st,
        'Transfer',
      );
      await expect(erc404st.connect(w1).approve(w2.address, oneERC20))
        .to.emit(erc404st, 'Approval')
        .withArgs(w1.address, w2.address, oneERC20);
      await expect(erc404st.connect(w2).transferFrom(w1.address, w3.address, 2n * oneERC20)).to.revertedWithCustomError(
        erc404st,
        'Unauthorized',
      );
      await expect(erc404st.connect(w2).transferFrom(w1.address, w3.address, oneERC20)).to.emit(erc404st, 'Transfer');
      await expect(erc404st.connect(w2).transferFrom(w1.address, w3.address, oneERC20)).to.revertedWithCustomError(
        erc404st,
        'Unauthorized',
      );
      expect(await erc404st.balanceOf(w1)).to.eq(oneERC20);
    });

    it('Approve ERC721', async function () {
      const { erc404st, owner, w1, w2, w3 } = await loadFixture(deployFixture);
      let tokenId_w1_0 = await erc404st.encodeOwnerAndId(w1.address, 0);
      await erc404st.connect(owner).transferFrom(owner.address, w1.address, 2n * oneERC20);
      expect(await erc404st.ownerOf(tokenId_w1_0)).to.eq(w1.address);
      await erc404st.connect(w1).approve(w2.address, tokenId_w1_0);
      await erc404st.connect(w2).transferFrom(w1.address, w3.address, tokenId_w1_0);
      expect(await erc404st.ownerOf(tokenId_w1_0)).to.eq(w3.address);
    });

    it('Approve all', async function () {
      const { erc404st, owner, w1, w2, w3 } = await loadFixture(deployFixture);
      let tokenId = await erc404st.encodeOwnerAndId(w1.address, 0);
      let tokenId_w1_0 = await erc404st.encodeOwnerAndId(w1.address, 0);
      let tokenId_w1_1 = await erc404st.encodeOwnerAndId(w1.address, 1);
      let tokenId_w1_2 = await erc404st.encodeOwnerAndId(w1.address, 2);
      await erc404st.connect(owner).transferFrom(owner.address, w1.address, 2n * oneERC20);
      expect(await erc404st.ownerOf(tokenId_w1_0)).to.eq(w1.address);
      await erc404st.connect(w1).setApprovalForAll(w2.address, true);
      await erc404st.connect(owner).transferFrom(owner.address, w1.address, 2n * oneERC20);
      await erc404st.connect(w2).transferFrom(w1.address, w3.address, tokenId_w1_0);
      await erc404st.connect(w2).transferFrom(w1.address, w3.address, tokenId_w1_2);
      await erc404st.connect(w1).setApprovalForAll(w2.address, false);
      await expect(erc404st.connect(w2).transferFrom(w1.address, w3.address, tokenId_w1_1)).to.revertedWithCustomError(
        erc404st,
        'Unauthorized',
      );
    });

    it('Flush Approve on transfer', async function () {
      const { erc404st, owner, w1, w2, w3 } = await loadFixture(deployFixture);
      let tokenId_w1_0 = await erc404st.encodeOwnerAndId(w1.address, 0);
      await erc404st.connect(owner).transferFrom(owner.address, w1.address, 2n * oneERC20);

      await erc404st.connect(w1).approve(w2.address, tokenId_w1_0);
      await erc404st.connect(w2).transferFrom(w1.address, w3.address, tokenId_w1_0);

      await erc404st.connect(w3).transferFrom(w3.address, w1.address, tokenId_w1_0);
      await expect(erc404st.connect(w2).transferFrom(w1.address, w3.address, tokenId_w1_0)).to.revertedWithCustomError(
        erc404st,
        'Unauthorized',
      );
    });

    it('ApproveForAll -> new Approval', async function () {
      const { erc404st, owner, w1, w2, w3, w4 } = await loadFixture(deployFixture);
      let tokenId_w1_0 = await erc404st.encodeOwnerAndId(w1.address, 0);
      await erc404st.connect(owner).transferFrom(owner.address, w1.address, 2n * oneERC20);

      await erc404st.connect(w1).setApprovalForAll(w2.address, true);
      await erc404st.connect(w2).approve(w3.address, tokenId_w1_0);
      await erc404st.connect(w3).transferFrom(w1.address, w4.address, tokenId_w1_0);
    });
  });

  describe('Events', function () {
    it('Solidify by transfer', async function () {
      const { erc404st, owner, w1, w2 } = await loadFixture(deployFixture);
      let tokenId = await erc404st.encodeOwnerAndId(w1.address, 0);
      await erc404st.connect(owner).transferFrom(owner.address, w1.address, oneERC20);
      await expect(erc404st.connect(w1).transferFrom(w1.address, w2.address, tokenId))
        .to.emit(erc404st, 'Transfer')
        .withArgs(w1.address, w2.address, tokenId)
        .emit(erc404st, 'Solidified')
        .withArgs(w1.address, tokenId);
      expect(await erc404st.solidifiedTotal(w1.address)).to.eq(1);
      expect(await erc404st.ownedTotal(w2.address)).to.eq(1);
    });

    it('UnSolidify', async function () {
      const { erc404st, owner, w1, w2 } = await loadFixture(deployFixture);
      let tokenId = await erc404st.encodeOwnerAndId(w1.address, 0);
      await erc404st.connect(owner).transferFrom(owner.address, w1.address, oneERC20);
      await erc404st.connect(w1).transferFrom(w1.address, w2.address, tokenId);

      expect(await erc404st.solidifiedTotal(w1.address)).to.eq(1);
      await expect(erc404st.connect(w2).transferFrom(w2.address, w1.address, tokenId))
        .to.emit(erc404st, 'Transfer')
        .withArgs(w2.address, w1.address, tokenId)
        .emit(erc404st, 'UnSolidified')
        .withArgs(w1.address, tokenId);

      expect(await erc404st.solidifiedTotal(w1.address)).to.eq(0);
    });

    it('Malleable transfer + ERC20 Transfer', async function () {
      const { erc404st, owner, w1, w2, w3 } = await loadFixture(deployFixture);
      let tokenId = await erc404st.encodeOwnerAndId(w1.address, 0);
      await erc404st.connect(owner).transferFrom(owner.address, w1.address, oneERC20);
      expect(await erc404st.balanceOf(w1.address)).to.eq(oneERC20);
      await erc404st.connect(w1).transferFrom(w1.address, w2.address, tokenId);
      expect(await erc404st.balanceOf(w1.address)).to.eq(0);
      expect(await erc404st.balanceOf(w2.address)).to.eq(oneERC20);

      await erc404st.connect(w2).transferFrom(w2.address, w3.address, tokenId);
      expect(await erc404st.balanceOf(w2.address)).to.eq(0);
      expect(await erc404st.balanceOf(w3.address)).to.eq(oneERC20);
    });

    it('burn Malleable + ERC20 Transfer', async function () {
      const { erc404st, owner, w1, w2, w3 } = await loadFixture(deployFixture);
      let tokenId = await erc404st.encodeOwnerAndId(w1.address, 0);
      await erc404st.connect(owner).transferFrom(owner.address, w1.address, oneERC20);
      await expect(erc404st.connect(w1).burn(tokenId))
        .to.emit(erc404st, 'Transfer')
        .withArgs(w1.address, ethers.ZeroAddress, tokenId)
        .to.emit(erc404st, 'ERC20Transfer')
        .withArgs(w1.address, ethers.ZeroAddress, oneERC20);

      expect(await erc404st.balanceOf(w1.address)).to.eq(0);
    });

    it('burn Owned + ERC20 Transfer', async function () {
      const { erc404st, owner, w1, w2, w3 } = await loadFixture(deployFixture);
      let tokenId = await erc404st.encodeOwnerAndId(w1.address, 0);
      await erc404st.connect(owner).transferFrom(owner.address, w1.address, oneERC20);
      await erc404st.connect(w1).transferFrom(w1.address, w2.address, tokenId);
      await expect(erc404st.connect(w2).burn(tokenId))
        .to.emit(erc404st, 'Transfer')
        .withArgs(w2.address, ethers.ZeroAddress, tokenId)
        .to.emit(erc404st, 'ERC20Transfer')
        .withArgs(w2.address, ethers.ZeroAddress, oneERC20);

      expect(await erc404st.balanceOf(w2.address)).to.eq(0);
    });
  });

  describe('Gas usage', function () {
    it('Show gas usage for transfer 1 ERC20', async function () {
      const { erc404st, owner, w1, w2, w3 } = await loadFixture(deployFixture);
      let tokenId = await erc404st.encodeOwnerAndId(w1.address, 0);
      let gas = await erc404st.connect(owner).transferFrom.estimateGas(owner.address, w1.address, oneERC20);
      console.log(`Gas for 1 ERC20 transfer: ${gas}`);

      // 'Show gas usage for transfer 10 ERC20'
      gas = await erc404st.connect(owner).transferFrom.estimateGas(owner.address, w1.address, 10n * oneERC20);
      console.log(`Gas for 10 ERC20 transfer: ${gas} (10 Transfer events)`);

      gas = await erc404st.connect(owner).transferFrom.estimateGas(owner.address, w1.address, 100n * oneERC20);
      console.log(`Gas for 100 ERC20 transfer: ${gas} (100 Transfer events)`);

      await erc404st.connect(owner).transferFrom(owner.address, w1.address, 100n * oneERC20);
      gas = await erc404st.connect(w1).transferFrom.estimateGas(w1.address, w2.address, 100n * oneERC20);
      console.log(`Gas for 100 ERC20 transfer: ${gas} (100 Transfer events to another account)`);

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

  it('Test ERC5169', async function () {
    const { erc404st, owner, w1, w2, w3 } = await loadFixture(deployFixture);

    const ERC5169InterfaceId = '0xa86517a1';

    expect((await erc404st.scriptURI()).toString()).to.be.equal([].toString());

    expect(await erc404st.supportsInterface(ERC5169InterfaceId)).to.eq(true);

    const scriptURI = ['uri1', 'uri2', 'uri3'];

    await expect(erc404st.connect(w1).setScriptURI(scriptURI)).to.revertedWithCustomError(erc404st, 'Unauthorized');
    await expect(erc404st.connect(owner).setScriptURI(scriptURI)).emit(erc404st, 'ScriptUpdate').withArgs(scriptURI);

    expect((await erc404st.scriptURI()).toString()).to.be.equal(scriptURI.toString());
  });

  it('ERC721, ERC721Enum supportInterface', async function () {
    const { erc404st, owner, w1, w2, w3 } = await loadFixture(deployFixture);

    const ERC721InterfaceId = '0x80ac58cd';
    expect(await erc404st.supportsInterface(ERC721InterfaceId)).to.eq(true);

    // const _INTERFACE_ID_ERC721_METADATA = "0x5b5e139f";
    // expect(await erc404st.supportsInterface(_INTERFACE_ID_ERC721_METADATA)).to.eq(true);

    const _INTERFACE_ID_ERC721_ENUMERABLE = '0x780e9d63';
    expect(await erc404st.supportsInterface(_INTERFACE_ID_ERC721_ENUMERABLE)).to.eq(true);
  });

  describe('Enumerable', function () {
    it('tokenOfOwnerByIndex malleable', async function () {
      const { erc404st, owner, w1, w2, w3 } = await loadFixture(deployFixture);
      let tokenId_w1_0 = await erc404st.encodeOwnerAndId(w1.address, 0);
      let tokenId_w1_1 = await erc404st.encodeOwnerAndId(w1.address, 1);
      let tokenId_w2_0 = await erc404st.encodeOwnerAndId(w2.address, 0);
      let tokenId_w2_1 = await erc404st.encodeOwnerAndId(w2.address, 1);
      await erc404st.connect(owner).transferFrom(owner.address, w1.address, 2n * oneERC20);
      await erc404st.connect(owner).transferFrom(owner.address, w2.address, 2n * oneERC20);

      expect(await erc404st.tokenOfOwnerByIndex(w1.address, 0)).to.eq(tokenId_w1_0);
      expect(await erc404st.tokenOfOwnerByIndex(w1.address, 1)).to.eq(tokenId_w1_1);
      await expect(erc404st.tokenOfOwnerByIndex(w1.address, 2)).to.revertedWith('Index out of bounds');

      expect(await erc404st.tokenOfOwnerByIndex(w2.address, 0)).to.eq(tokenId_w2_0);
      expect(await erc404st.tokenOfOwnerByIndex(w2.address, 1)).to.eq(tokenId_w2_1);

      expect(await erc404st.ownerOf(tokenId_w1_0)).to.eq(w1.address);
      expect(await erc404st.ownerOf(tokenId_w1_1)).to.eq(w1.address);
      expect(await erc404st.ownerOf(tokenId_w2_0)).to.eq(w2.address);
      expect(await erc404st.ownerOf(tokenId_w2_1)).to.eq(w2.address);

    });

    it('tokenOfOwnerByIndex solidified', async function () {
      const { erc404st, owner, w1, w2, w3 } = await loadFixture(deployFixture);
      let tokenId_w1_1 = await erc404st.encodeOwnerAndId(w1.address, 1);
      let tokenId_w2_0 = await erc404st.encodeOwnerAndId(w2.address, 0);
      let tokenId_w2_1 = await erc404st.encodeOwnerAndId(w2.address, 1);
      await erc404st.connect(owner).transferFrom(owner.address, w1.address, 2n * oneERC20);
      await erc404st.connect(owner).transferFrom(owner.address, w2.address, 2n * oneERC20);
      await erc404st.connect(w1).transferFrom(w1.address, w2.address, tokenId_w1_1);

      expect(await erc404st.tokenOfOwnerByIndex(w2.address, 0)).to.eq(tokenId_w1_1);
      expect(await erc404st.tokenOfOwnerByIndex(w2.address, 1)).to.eq(tokenId_w2_0);
      expect(await erc404st.tokenOfOwnerByIndex(w2.address, 2)).to.eq(tokenId_w2_1);
      await expect(erc404st.tokenOfOwnerByIndex(w2.address, 3)).to.revertedWith('Index out of bounds');

      expect(await erc404st.ownerOf(tokenId_w2_0)).to.eq(w2.address);
      expect(await erc404st.ownerOf(tokenId_w2_1)).to.eq(w2.address);
      expect(await erc404st.ownerOf(tokenId_w1_1)).to.eq(w2.address);
    });
    it('tokenByIndex', async function () {
      const { erc404st, owner, w1, w2, w3 } = await loadFixture(deployFixture);
      let tokenId_w1_1 = await erc404st.encodeOwnerAndId(w1.address, 1);
      await erc404st.connect(owner).transferFrom(owner.address, w1.address, 2n * oneERC20);
      await erc404st.connect(owner).transferFrom(owner.address, w2.address, 2n * oneERC20);
      await erc404st.connect(w1).transferFrom(w1.address, w2.address, tokenId_w1_1);

      expect(await erc404st.tokenByIndex(0)).to.eq(tokenId_w1_1);
      await expect( erc404st.tokenByIndex(1)).to.revertedWith('Index out of bounds');
    });
  });
});
