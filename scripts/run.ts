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

  const RB404 = (await ethers.getContractAt('RB404', '0xA346DDAD09151f0295dDa9586e10506A08474F13')).connect(admin);

  // await RB404.approve(
  //   '0x1738fbbe1e4a8fbd51aa45aeefce7ae7c76af458',
  //   `0x${5000000000n.toString(16)}`,
  // );

  // console.log(
  //   await RB404.isApprovedForAll(
  //     '0x851438Ecb37FAe596DcD49bDe643D170F3aa225B',
  //     '0x5E57D559fa47F2f53E72EF75bb5A2a51C25f4164',
  //   ),
  // );

  // await RB404.setApprovalForAll('0x45e40643B0AA0B8d45C4e2Bc94C2FBbbDF2fBb2b', true);

  // console.log(await ST404.allowance('0x851438Ecb37FAe596DcD49bDe643D170F3aa225B', '0xae749AE248d9c7014b6a2E951542cdAa619e14C1'));

  // console.log(await RB404.erc721BalanceOf('0x37fC30f745238AD9347F84747017265CA1787c71'));

  // const tokenId = `0x${((BigInt('0x851438Ecb37FAe596DcD49bDe643D170F3aa225B') << 96n) + BigInt(1)).toString(16)}`;

  // console.log(await RB404.ownerOf('25322790082616446355733086716868058758048503073292246395145990897110788079616'));

  // console.log((await ST404.tokenByIndex(0)).toString(16));
  // console.log((await ST404.tokenByIndex(1)).toString(16), tokenId);
  // console.log((await ST404.tokenByIndex(2)).toString(16));

  // await RB404.claim('a', '0xae749AE248d9c7014b6a2E951542cdAa619e14C1');

  await RB404.transferFrom('0x851438Ecb37FAe596DcD49bDe643D170F3aa225B', '0x37fC30f745238AD9347F84747017265CA1787c71', 100000000);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
