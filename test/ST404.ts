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
    const erc404st = await ST404.deploy('Token', 'TKN', decimals, 100_000_000, owner.address, "0x9c4171b69E5659647556E81007EF941f9B042b1a", 1000n);

    const ERC721Events = await ethers.getContractFactory('ERC721Events');
    const erc721events = await ERC721Events.attach(erc404st.target);

    return { erc404st, owner, erc721events, w1, w2, w3, w4 };
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

    await expect(erc404st.decodeOwnerAndId(1n << 96n)).not.to.be.reverted;
    await expect(erc404st.decodeOwnerAndId((1n << 96n) - 1n)).to.be.revertedWithCustomError(erc404st, "InvalidToken");
  });

  it('Detect owner balance after deploy', async function () {
    const { erc404st, owner, w1, w2 } = await loadFixture(deployFixture);

    expect(await erc404st.balanceOf(owner.address)).to.eq(100_000_000n * oneERC20);
  });

  it('Get token metadata', async function () {
    const { erc404st, owner, w1, w2, w3 } = await loadFixture(deployFixture);
    let tokenId = await erc404st.encodeOwnerAndId(w1.address, 0);
    await erc404st.connect(owner).transferFrom(owner.address, w1.address, oneERC20);

    let tokenMeta = await erc404st.tokenURI(tokenId);

    let jsonData: JSON = JSON.parse(tokenMeta);
    // @ts-ignore
    expect(jsonData.name).to.eq(`ST404 #${tokenId}`);
    // @ts-ignore
    expect(jsonData.description).to.eq(`A collection of ST404 Tokens enhanced with TokenScript`);
  });

  it('Transfer 1 unit to wallet1', async function () {
    const { erc404st, owner, erc721events, w1, w2 } = await loadFixture(deployFixture);
    await expect(erc404st.connect(owner).transferFrom(owner.address, w1.address, oneERC20 - 1n))
      .to.emit(erc404st, 'Transfer')
      .withArgs(owner.address, w1.address, oneERC20 - 1n);
    
    let tokenId = await erc404st.encodeOwnerAndId(w1.address, 0);
  
    await expect(erc404st.connect(owner).transferFrom(owner.address, w1.address, 1n))
      .to.emit(erc721events, 'Transfer')
      .withArgs(ethers.ZeroAddress, w1.address, tokenId);

    await expect(erc404st.connect(owner).transferFrom(w1.address, owner.address, 1n)).to.be.revertedWithCustomError(
      erc404st,
      'Unauthorized',
    );

    await expect(erc404st.connect(w1).transferFrom(w1.address, owner.address, 1n))
      .to.emit(erc721events, 'Transfer')
      .withArgs(w1.address, ethers.ZeroAddress, tokenId);

    tokenId = await erc404st.encodeOwnerAndId(w1.address, 0);
    await expect(erc404st.connect(owner).transferFrom(owner.address, w1.address, 1n))
      .to.emit(erc721events, 'Transfer')
      .withArgs(ethers.ZeroAddress, w1.address, tokenId);

    tokenId = await erc404st.encodeOwnerAndId(w1.address, 1);
    await expect(erc404st.connect(owner).transferFrom(owner.address, w1.address, oneERC20))
      .to.emit(erc721events, 'Transfer')
      .withArgs(ethers.ZeroAddress, w1.address, tokenId);

    tokenId = await erc404st.encodeOwnerAndId(w1.address, 2);
    let tokenId2 = await erc404st.encodeOwnerAndId(w1.address, 3);
    // minted 2 ERC721 tokens
    await expect(erc404st.connect(owner).transferFrom(owner.address, w1.address, 2n * oneERC20))
      .to.emit(erc721events, 'Transfer')
      .withArgs(ethers.ZeroAddress, w1.address, tokenId)
      .to.emit(erc721events, 'Transfer')
      .withArgs(ethers.ZeroAddress, w1.address, tokenId2);
  });

  it('try to transfer from zero balance', async function () {
    const { erc404st, owner, w1, w2 } = await loadFixture(deployFixture);
    await expect(erc404st.connect(w1).transfer(w2.address, 1)).to.be.revertedWithCustomError(erc404st, 'InsufficientBalance');
    await expect(erc404st.connect(w1).transfer(w2.address, 2n ** 96n)).to.be.revertedWithCustomError(erc404st, 'InvalidAmount');
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
      await expect(erc404st.ownerOf(tokenId_w1_2)).to.revertedWithCustomError(erc404st, "InvalidToken");
      await expect(erc404st.ownerOf(tokenId_w2_0)).to.revertedWithCustomError(erc404st, "InvalidToken");

      await erc404st.connect(w1).transferFrom(w1.address, w2.address, oneERC20);
      expect(await erc404st.balanceOf(w1.address)).to.eq(oneERC20);
      expect(await erc404st.balanceOf(w2.address)).to.eq(oneERC20);
      expect(await erc404st.solidifiedTotal(w1.address)).to.eq(0);
      expect(await erc404st.ownedTotal(w1.address)).to.eq(0);
      expect(await erc404st.solidifiedTotal(w2.address)).to.eq(0);
      expect(await erc404st.ownedTotal(w2.address)).to.eq(0);

      expect(await erc404st.ownerOf(tokenId_w1_0)).to.eq(w1.address);
      await expect(erc404st.ownerOf(tokenId_w1_1)).to.revertedWithCustomError(erc404st, "InvalidToken");
      expect(await erc404st.ownerOf(tokenId_w2_0)).to.eq(w2.address);
      await expect(erc404st.ownerOf(tokenId_w2_1)).to.revertedWithCustomError(erc404st, "InvalidToken");
    });
  });

  it('Mint when NFT#2 Solidified. make sure ID reserved', async function () {
    const { erc404st, erc721events, owner, w1, w2 } = await loadFixture(deployFixture);
    await erc404st.connect(owner).transferFrom(owner.address, w1.address, 2n * oneERC20);
    let tokenId = await erc404st.encodeOwnerAndId(w1.address, 1);
    await erc404st.connect(w1).transferFrom(w1.address, w2.address, tokenId);

    tokenId = await erc404st.encodeOwnerAndId(w1.address, 2);
    await expect(erc404st.connect(owner).transferFrom(owner.address, w1.address, oneERC20))
      .to.emit(erc721events, 'Transfer')
      .withArgs(ethers.ZeroAddress, w1.address, tokenId);
  });

  describe('Burn', function () {
    it('Burn Malleable and solidified', async function () {
      const { erc404st, erc721events, owner, w1, w2 } = await loadFixture(deployFixture);
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
        .to.emit(erc721events, 'Transfer')
        .withArgs(w1.address, ethers.ZeroAddress, tokenId_w1_1)
        .emit(erc404st, 'Solidified')
        .withArgs(w1.address, tokenId_w1_1)
        .emit(erc404st, 'Transfer')
        .withArgs(w1.address, ethers.ZeroAddress, oneERC20);

      await expect(erc404st.ownerOf(tokenId_w1_1)).to.revertedWithCustomError(erc404st, "InvalidToken");

      await expect(erc404st.connect(w1).transferFrom(w1.address, w2.address, tokenId_w1_0))
        .emit(erc721events, 'Transfer')
        .withArgs(w1.address, w2.address, tokenId_w1_0)
        .emit(erc404st, 'Solidified')
        .withArgs(w1.address, tokenId_w1_0);

      await expect(erc404st.connect(w2).burn(tokenId_w1_0))
        .to.emit(erc721events, 'Transfer')
        .withArgs(w2.address, ethers.ZeroAddress, tokenId_w1_0)
        .emit(erc404st, 'Transfer')
        .withArgs(w2.address, ethers.ZeroAddress, oneERC20);

      await expect(erc404st.ownerOf(tokenId_w1_1)).to.revertedWithCustomError(erc404st, "InvalidToken");
      await expect(erc404st.ownerOf(tokenId_w1_0)).to.revertedWithCustomError(erc404st, "InvalidToken");
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
      await expect(erc404st.ownerOf(tokenId_w1_1)).to.revertedWithCustomError(erc404st, "InvalidToken");
    });

    it('Burn ERC20 + Burn ERC721', async function () {
      const { erc404st, erc721events, owner, w1, w2 } = await loadFixture(deployFixture);
      let tokenId_w1_0 = await erc404st.encodeOwnerAndId(w1.address, 0);
      let tokenId_w1_1 = await erc404st.encodeOwnerAndId(w1.address, 1);

      await erc404st.connect(owner).transferFrom(owner.address, w1.address, 2n * oneERC20);
      expect(await erc404st.solidifiedTotal(w1.address)).to.eq(0);
      expect(await erc404st.ownerOf(tokenId_w1_0)).to.eq(w1.address);
      expect(await erc404st.ownerOf(tokenId_w1_1)).to.eq(w1.address);

      await expect(erc404st.connect(w1).burn(oneERC20))
        .to.emit(erc721events, 'Transfer')
        .withArgs(w1.address, ethers.ZeroAddress, tokenId_w1_1)
        .emit(erc404st, 'Transfer')
        .withArgs(w1.address, ethers.ZeroAddress, oneERC20);
      await expect(erc404st.ownerOf(tokenId_w1_1)).to.revertedWithCustomError(erc404st, "InvalidToken");

      expect(await erc404st.balanceOf(w1.address)).to.eq(oneERC20);
    });

    it('Burn ERC20 + Burn first solidified ERC721', async function () {
      const { erc404st, erc721events, owner, w1, w2 } = await loadFixture(deployFixture);
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
        .to.emit(erc721events, 'Transfer')
        .withArgs(w2.address, ethers.ZeroAddress, tokenId_w1_0)
        .emit(erc404st, 'Transfer')
        .withArgs(w2.address, ethers.ZeroAddress, oneERC20);
      expect(await erc404st.ownedTotal(w2.address)).to.eq(1);

      await expect(erc404st.ownerOf(tokenId_w1_0)).to.revertedWithCustomError(erc404st, "InvalidToken");

      expect(await erc404st.balanceOf(w2.address)).to.eq(oneERC20);
    });
  });

  describe('Check owner', function () {
    it('ownerOf first NFT', async function () {
      const { erc404st, owner, w1, w2 } = await loadFixture(deployFixture);
      let tokenId = await erc404st.encodeOwnerAndId(w1.address, 0);
      await expect(erc404st.ownerOf(tokenId)).to.be.revertedWithCustomError(erc404st, "InvalidToken");
      await erc404st.connect(owner).transferFrom(owner.address, w1.address, oneERC20);
      expect(await erc404st.ownerOf(tokenId)).to.eq(w1.address);
      tokenId = await erc404st.encodeOwnerAndId(w1.address, 2);
      await erc404st.connect(owner).transferFrom(owner.address, w1.address, 2n * oneERC20);
      expect(await erc404st.ownerOf(tokenId)).to.eq(w1.address);
    });

    it('Mallable Owner non-existent', async function () {
      const { erc404st, owner, w1, w2 } = await loadFixture(deployFixture);
      let tokenId = await erc404st.encodeOwnerAndId(w1.address, 0);
      await expect(erc404st.ownerOf(tokenId)).to.be.revertedWithCustomError(erc404st, "InvalidToken");
    });

    it('Owned Owner', async function () {
      const { erc404st, owner, w1, w2 } = await loadFixture(deployFixture);
      let tokenId_w1_0 = await erc404st.encodeOwnerAndId(w1.address, 0);
      let tokenId_w1_1 = await erc404st.encodeOwnerAndId(w1.address, 1);
      await erc404st.connect(owner).transferFrom(owner.address, w1.address, oneERC20);
      await erc404st.connect(w1).transferFrom(w1.address, w2.address, tokenId_w1_0);
      expect(await erc404st.ownerOf(tokenId_w1_0)).to.eq(w2.address);
      await expect(erc404st.ownerOf(tokenId_w1_1)).to.be.revertedWithCustomError(erc404st, "InvalidToken");
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
    it('Approve ERC20 uint256.max', async function () {
      const { erc404st, owner, w1, w2, w3, w4 } = await loadFixture(deployFixture);
      await erc404st.connect(owner).transferFrom(owner.address, w1.address, 2n * oneERC20);

      await erc404st.connect(w1).approve(w2.address, ethers.MaxUint256);
      await erc404st.connect(w2).transferFrom(w1.address, w3.address, 2n * oneERC20);
      await erc404st.connect(owner).transferFrom(owner.address, w1.address, 20n * oneERC20);
      await erc404st.connect(w2).transferFrom(w1.address, w3.address, 20n * oneERC20);

      expect(await erc404st.balanceOf(w1)).to.eq(0);
      expect(await erc404st.balanceOf(w3)).to.eq(22n * oneERC20);
    });
  });

  describe('Events', function () {
    it('Solidify by transfer', async function () {
      const { erc404st, erc721events, owner, w1, w2 } = await loadFixture(deployFixture);
      let tokenId = await erc404st.encodeOwnerAndId(w1.address, 0);
      await erc404st.connect(owner).transferFrom(owner.address, w1.address, oneERC20);
      await expect(erc404st.connect(w1).transferFrom(w1.address, w2.address, tokenId))
        .to.emit(erc721events, 'Transfer')
        .withArgs(w1.address, w2.address, tokenId)
        .emit(erc404st, 'Solidified')
        .withArgs(w1.address, tokenId);
      expect(await erc404st.solidifiedTotal(w1.address)).to.eq(1);
      expect(await erc404st.ownedTotal(w2.address)).to.eq(1);
    });

    it('UnSolidify', async function () {
      const { erc404st, erc721events, owner, w1, w2 } = await loadFixture(deployFixture);
      let tokenId = await erc404st.encodeOwnerAndId(w1.address, 0);
      await erc404st.connect(owner).transferFrom(owner.address, w1.address, oneERC20);
      await erc404st.connect(w1).transferFrom(w1.address, w2.address, tokenId);

      expect(await erc404st.solidifiedTotal(w1.address)).to.eq(1);
      await expect(erc404st.connect(w2).transferFrom(w2.address, w1.address, tokenId))
        .to.emit(erc721events, 'Transfer')
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
      const { erc404st, erc721events, owner, w1, w2, w3 } = await loadFixture(deployFixture);
      let tokenId = await erc404st.encodeOwnerAndId(w1.address, 0);
      await erc404st.connect(owner).transferFrom(owner.address, w1.address, oneERC20);
      await expect(erc404st.connect(w1).burn(tokenId))
        .to.emit(erc721events, 'Transfer')
        .withArgs(w1.address, ethers.ZeroAddress, tokenId)
        .to.emit(erc404st, 'Transfer')
        .withArgs(w1.address, ethers.ZeroAddress, oneERC20);

      expect(await erc404st.balanceOf(w1.address)).to.eq(0);
    });

    it('burn Owned + ERC20 Transfer', async function () {
      const { erc404st, erc721events, owner, w1, w2, w3 } = await loadFixture(deployFixture);
      let tokenId = await erc404st.encodeOwnerAndId(w1.address, 0);
      await erc404st.connect(owner).transferFrom(owner.address, w1.address, oneERC20);
      await erc404st.connect(w1).transferFrom(w1.address, w2.address, tokenId);
      await expect(erc404st.connect(w2).burn(tokenId))
        .to.emit(erc721events, 'Transfer')
        .withArgs(w2.address, ethers.ZeroAddress, tokenId)
        .to.emit(erc404st, 'Transfer')
        .withArgs(w2.address, ethers.ZeroAddress, oneERC20);

      expect(await erc404st.balanceOf(w2.address)).to.eq(0);
    });
  });
/*
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

      gas = await erc404st.connect(w1).transferFrom.estimateGas(w1.address, owner.address, oneERC20);
      console.log(`Gas for 1 ERC20 transfer back to owner: ${gas}`);

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
*/
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

    const ERC20InterfaceId = '0x36372b07';
    expect(await erc404st.supportsInterface(ERC20InterfaceId)).to.eq(true);

    const ERC721InterfaceId = '0x80ac58cd';
    expect(await erc404st.supportsInterface(ERC721InterfaceId)).to.eq(false);

    // const _INTERFACE_ID_ERC721_METADATA = "0x5b5e139f";
    // expect(await erc404st.supportsInterface(_INTERFACE_ID_ERC721_METADATA)).to.eq(true);

    // const _INTERFACE_ID_ERC721_ENUMERABLE = '0x780e9d63';
    // expect(await erc404st.supportsInterface(_INTERFACE_ID_ERC721_ENUMERABLE)).to.eq(true);
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
      await expect(erc404st.tokenOfOwnerByIndex(w1.address, 2)).to.revertedWithCustomError(erc404st,'IndexOutOfBounds');

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
      await expect(erc404st.tokenOfOwnerByIndex(w2.address, 3)).to.revertedWithCustomError(erc404st,'IndexOutOfBounds');

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
      await expect(erc404st.tokenByIndex(1)).to.revertedWithCustomError(erc404st,'IndexOutOfBounds');
    });
  });

  describe('Ownable', function () {
    it('all', async function () {
      const { erc404st, owner, w1, w2, w3 } = await loadFixture(deployFixture);

      await expect(erc404st.connect(owner).setWhitelist(w2.address, true)).to.not.reverted;
      await expect(erc404st.connect(w1).setWhitelist(owner.address, false)).to.revertedWithCustomError(
        erc404st,
        'Unauthorized',
      );

      await expect(erc404st.connect(owner).transferOwnership(w1.address)).to.not.reverted;
      await expect(erc404st.connect(w2).transferOwnership(owner.address)).to.revertedWithCustomError(
        erc404st,
        'Unauthorized',
      );

      await expect(erc404st.connect(w1).revokeOwnership()).to.not.reverted;
      await expect(erc404st.connect(w2).revokeOwnership()).to.revertedWithCustomError(erc404st, 'Unauthorized');
    });
  });

  describe('Whitelist', function () {
    it('enable/disable', async function () {
      const { erc404st, erc721events, owner, w1, w2, w3 } = await loadFixture(deployFixture);

      let tokenId_w1_0 = await erc404st.encodeOwnerAndId(w1.address, 0);
      let tokenId_w2_1 = await erc404st.encodeOwnerAndId(w2.address, 1);

      await expect(erc404st.connect(owner).transferFrom(owner.address, w1.address, oneERC20))
        .to.emit(erc721events, 'Transfer')
        .withArgs(ethers.ZeroAddress, w1.address, tokenId_w1_0);

      await erc404st.connect(owner).setWhitelist(w2.address, true);

      // dont have an option to separate to.not.emit(erc721events, 'Transfer') from to.not.emit(erc404st, 'Transfer')
      // await expect(erc404st.connect(owner).transferFrom(owner.address, w2.address, oneERC20))
      //   .to.emit(erc404st, 'Transfer')
      //   .withArgs(owner.address, w2.address, oneERC20)
      //   .to.not.emit(erc721events, 'Transfer');

      await erc404st.connect(owner).setWhitelist(w2.address, false);

      await expect(erc404st.connect(owner).transferFrom(owner.address, w2.address, 2n * oneERC20))
        .to.emit(erc721events, 'Transfer')
        .withArgs(ethers.ZeroAddress, w2.address, tokenId_w2_1);
    });
  });

  describe('setSelfERC721TransferExempt', function () {
    it('State already set', async function () {
      const { erc404st, erc721events, owner, w1, w2, w3 } = await loadFixture(deployFixture);

      await erc404st.connect(w1).setSelfERC721TransferExempt(true);
      await expect(erc404st.connect(w1).setSelfERC721TransferExempt(true)).to.revertedWithCustomError(erc404st, 'StateAlreadySet');
    })

    it('enable/disable', async function () {
      const { erc404st, erc721events, owner, w1, w2, w3 } = await loadFixture(deployFixture);
      let tokenId_w1_0 = await erc404st.encodeOwnerAndId(w1.address, 0);
      let tokenId_w1_1 = await erc404st.encodeOwnerAndId(w1.address, 1);
      let tokenId_w2_0 = await erc404st.encodeOwnerAndId(w2.address, 0);
      let tokenId_w2_1 = await erc404st.encodeOwnerAndId(w2.address, 1);
      let tokenId_w2_2 = await erc404st.encodeOwnerAndId(w2.address, 2);

      await expect(erc404st.connect(w1).setSelfERC721TransferExempt(true)).to.emit(erc404st, 'SetERC721TransferExempt').withArgs(w1.address, true);
      
      await erc404st.connect(owner).transferFrom(owner.address, w2.address, 2n * oneERC20);

      await erc404st.connect(owner).transferFrom(owner.address, w1.address, 2n * oneERC20);

      expect( await erc404st.ownerOf(tokenId_w2_0)).to.eq(w2.address);
      expect( await erc404st.ownerOf(tokenId_w2_1)).to.eq(w2.address);

      await expect(erc404st.connect(w1).setSelfERC721TransferExempt(false))
        .to.emit(erc404st, 'SetERC721TransferExempt').withArgs(w1.address, false)
        .to.emit(erc721events, 'Transfer').withArgs(ethers.ZeroAddress, w1.address, tokenId_w1_0)
        .to.emit(erc721events, 'Transfer').withArgs(ethers.ZeroAddress, w1.address, tokenId_w1_1)

      await expect(erc404st.connect(w1).setSelfERC721TransferExempt(true))
        .to.emit(erc404st, 'SetERC721TransferExempt').withArgs(w1.address, true)
        .to.emit(erc721events, 'Transfer').withArgs(w1.address, ethers.ZeroAddress, tokenId_w1_0)
        .to.emit(erc721events, 'Transfer').withArgs(w1.address, ethers.ZeroAddress, tokenId_w1_1)
      
      await erc404st.connect(w2).transferFrom(w2.address, w1.address, tokenId_w2_0);

      await erc404st.connect(w1).transfer(ethers.ZeroAddress, 2n * oneERC20);

      await expect(erc404st.connect(w1).setSelfERC721TransferExempt(false)).to.not.emit(erc404st, 'Transfer');

      await erc404st.connect(w1).setSelfERC721TransferExempt(true)

      expect( await erc404st.ownerOf(tokenId_w2_0)).to.eq(w1.address);
      expect( await erc404st.ownerOf(tokenId_w2_1)).to.eq(w2.address);
      await expect(erc404st.ownerOf(tokenId_w2_2)).to.revertedWithCustomError(erc404st, "InvalidToken");

      await expect(erc404st.connect(w1).transfer(w2.address, oneERC20))
        .to.emit(erc404st, 'Transfer').withArgs(w1.address, w2.address, oneERC20)
        .to.emit(erc721events, 'Transfer').withArgs(w1.address, ethers.ZeroAddress, tokenId_w2_0)
        .to.emit(erc721events, 'Transfer').withArgs(ethers.ZeroAddress, w2.address, tokenId_w2_2);

    });
  });
});
