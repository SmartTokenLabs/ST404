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
  const decimals = 8n;
  const initialOwnerBalance = 88888; // 100_000_000
  
  const C = await ethers.getContractFactory('ST404');
  const ST404 = C.connect(admin);
  // const erc404st = await ST404.deploy('ST404 Testing Token', 'STTT', decimals, initialOwnerBalance, admin.address);
  // const erc404st = await ST404.deploy('ST404 Alpha Testing 1', 'SATT1', decimals, initialOwnerBalance, "0x8349Fc69c48aF23e030A655736375d8942De5347");
  // const erc404st = await ST404.deploy('ST404 Testing Token v3', 'STTT3', decimals, initialOwnerBalance, "0x6DDD22a9bCc22811BEc8786d2090F7381Dcd22e8");
  
  if (admin.address != '0x9c4171b69E5659647556E81007EF941f9B042b1a'){
    console.log("Please set .env PRIVATE_KEY_ADMIN to be the correct key for admin.address")
    return;
  }
  
  const erc404st = await ST404.deploy('ZipCoin', 'ZIP', decimals, initialOwnerBalance, admin.address, admin.address, 1000n);
  
  await erc404st.waitForDeployment();

  console.log(
    `RB404 deployed to ${erc404rb.target}`
  );
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
