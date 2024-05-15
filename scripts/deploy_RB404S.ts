import { ethers } from "hardhat";
const hre = require('hardhat')
require('dotenv/config')

async function main() {
  let chainId = await hre.network.provider.send('eth_chainId')
  chainId = BigInt(chainId).toString()
  
  const provider = ethers.provider
  
  // admin address must be different from deployer!!!, can't be same as deployer
  const privateKeyAdmin = process.env.PRIVATE_KEY_ADMIN
  if (!privateKeyAdmin) {
    console.error('PRIVATE_KEY_ADMIN in .env required to deploy contract')
    return
  }
  const admin = new ethers.Wallet(privateKeyAdmin, provider)
  
  console.log(
    `admin: ${admin.address}`
  );
  
  if (chainId === '31337') {
    const [nodeSigner] = await ethers.getSigners()
    
    let tx = await nodeSigner.sendTransaction({
      to: admin.address,
      value: 10n ** 18n, // 1 ETH
      gasLimit: 100_000,
    })
    await tx.wait()
  }
  
  // const [deployer, owner, w1, w2] = await ethers.getSigners();
  const tokenName = "Brc:ID"
  const tokenSymbol = "BID"
  const decimals = 8n;
  const initialAmount = 0;
  const adminWallet = "0x851438Ecb37FAe596DcD49bDe643D170F3aa225B"
  const royaltyReceiver = "0x851438Ecb37FAe596DcD49bDe643D170F3aa225B"
  const royaltyAmount = 200 // 2%
  const totalClaimable = 10_000;
  const adminSigner = '0x1c18e4eF0C9740e258835Dbb26E6C5fB4684C7a0'
  throw Error("make sure you set contractURI value in the contract line 35 of ST404.sol")
  
  const C = await ethers.getContractFactory('RB404S');
  const RB404S = C.connect(admin);

  const erc404st = await RB404S.deploy(tokenName, tokenSymbol, decimals, initialAmount, adminWallet, royaltyReceiver, royaltyAmount, totalClaimable ,adminSigner);

  
  await erc404st.waitForDeployment();

  console.log(
    `ST404S deployed to ${erc404st.target}`
  );
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
