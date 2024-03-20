import { ethers } from 'hardhat';
const hre = require('hardhat');
require('dotenv/config');

async function main() {
  const provider = ethers.provider;

  // admin address must be different from deployer!!!, can't be same as deployer
  const privateKeyAdmin = process.env.PRIVATE_KEY_ADMIN;
  if (!privateKeyAdmin) {
    console.error('PRIVATE_KEY_ADMIN in .env required to deploy contract');
    return;
  }
  const admin = new ethers.Wallet(privateKeyAdmin, provider);

  console.log(`admin: ${admin.address}`);

  const RB404 = (await ethers.getContractAt('RB404', '0xbc97aB082C9b2Dd25873826Ab97978377169073D')).connect(admin);

  // await ST404.approve(
  //   '0xae749AE248d9c7014b6a2E951542cdAa619e14C1',
  //   `0x${100000000n.toString(16)}`,
  // );

  // console.log(
  //   await RB404.isApprovedForAll(
  //     '0x851438Ecb37FAe596DcD49bDe643D170F3aa225B',
  //     '0x5E57D559fa47F2f53E72EF75bb5A2a51C25f4164',
  //   ),
  // );

  await RB404.setApprovalForAll('0x5BcCe902F309678C7b6dca09a59d24DB8255e6e0', true);

  // console.log(await ST404.allowance('0x851438Ecb37FAe596DcD49bDe643D170F3aa225B', '0xae749AE248d9c7014b6a2E951542cdAa619e14C1'));

  // console.log(await ST404.erc721BalanceOf('0x37fC30f745238AD9347F84747017265CA1787c71'));

  // const tokenId = `0x${((BigInt('0x851438Ecb37FAe596DcD49bDe643D170F3aa225B') << 96n) + BigInt(1)).toString(16)}`;

  // console.log(await RB404.isClaimed('b'));

  // console.log((await ST404.tokenByIndex(0)).toString(16));
  // console.log((await ST404.tokenByIndex(1)).toString(16), tokenId);
  // console.log((await ST404.tokenByIndex(2)).toString(16));

  // await RB404.claim('a', '0xae749AE248d9c7014b6a2E951542cdAa619e14C1');
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
