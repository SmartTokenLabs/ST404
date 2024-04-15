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
    const deployer = await ethers.getImpersonatedSigner('0x388C818CA8B9251b393131C08a736A67ccB19297');
    const owner = await ethers.getImpersonatedSigner('0x1f9090aaE28b8a3dCeaDf281B0F12828e676c326');
    const w1 = await ethers.getImpersonatedSigner('0x4675C7e5BaAFBFFbca748158bEcBA61ef3b0a263');

    // 0x388C818CA8B9251b393131C08a736A67ccB19297 has 45 ETH

    const ST404 = (await ethers.getContractFactory('ERC404StDev')).connect(deployer);
    const erc404st = await ST404.deploy(
      'Token',
      'TKN',
      decimals,
      100_000_000,
      owner.address,
      '0x9c4171b69E5659647556E81007EF941f9B042b1a',
      1000,
    );

    const ERC721Events = await ethers.getContractFactory('ERC721Events');
    const erc721events = await ERC721Events.attach(erc404st.target);

    return { erc404st, owner, erc721events, w1 };
  }

  it('Detect owner balance after deploy', async function () {
    const { erc404st, owner, w1 } = await loadFixture(deployFixture);

    expect(await erc404st.balanceOf(owner.address)).to.eq(100_000_000n * oneERC20);
  });

  it('event TransferValidatorUpdated', async function () {
    const { erc404st, owner, w1 } = await loadFixture(deployFixture);

    await expect(erc404st.connect(owner).setToDefaultSecurityPolicy()).to.emit(erc404st, 'TransferValidatorUpdated');
    expect(await erc404st.getTransferValidator()).to.eq('0x0000721C310194CcfC01E523fc93C9cCcFa2A0Ac');

    await expect(erc404st.getSecurityPolicy()).to.not.reverted;
    await expect(erc404st.getWhitelistedOperators()).to.not.reverted;
    await expect(erc404st.getPermittedContractReceivers()).to.not.reverted;
  });

  it('event TransferValidatorUpdated', async function () {
    const { erc404st, owner, w1 } = await loadFixture(deployFixture);

    let tokenId = await erc404st.encodeOwnerAndId(w1.address, 0);
    await erc404st.connect(owner).transferFrom(owner.address, w1.address, oneERC20);

    expect(await erc404st.royaltyInfo(tokenId, 100)).to.deep.eq(['0x9c4171b69E5659647556E81007EF941f9B042b1a', 10]);
  });
});
