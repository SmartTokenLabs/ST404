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

  const [deployer, owner, w1, w2] = await ethers.getSigners();
  const decimals = 8n;
  const initialOwnerBalance = 100_000_000;;

  const ERC404ST = (await ethers.getContractFactory('ERC404ST')).connect(admin);
  const erc404st = await ERC404ST.deploy('Token', 'TKN', decimals, initialOwnerBalance, admin.address);

  await erc404st.waitForDeployment();

  console.log(
    `erc404st deployed to ${erc404st.target}`
  );
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
