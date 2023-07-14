import fse from "fs-extra";
import { deployProxy, setupERC1155, setupERC721, setupERC1155Claimer } from "../../utils";
import { ethers } from "hardhat";
import { MightyNetTerminal, MightyNetERC721RestrictedRegistryV2 } from "../../../../typechain";

console.warn(
   "WARNING: This script is meant for deploying the whole MightyNet L2 contract suite to a testnet. It is not meant for production use."
);
console.info("Contracts will be deployed with development metadata URLs.");

const argv = process.argv.slice(2);

console.info(`Deploying MightyNet L2 contract with following variables:`);

async function main() {
   console.info("Cleaning up artifacts directory");
   let artifactsDir = process.cwd() + "/dist/contracts";

   if (fse.existsSync(artifactsDir)) {
      // Delete the artifacts directory
      fse.removeSync(artifactsDir);
   }

   const feesVaultWallet = argv[0];
   const operatorFilterRegistryAddress = argv[1]
   const shopWalletAddress = argv[2]
   console.info("Deploying MightyNet L2 contracts with following variables:");
   console.info(`fees vault wallet: ${feesVaultWallet}`)
   console.info(`operatorFilter: ${operatorFilterRegistryAddress}`);
   console.info(`shop wallet: ${shopWalletAddress}`);
   await deployContracts(feesVaultWallet, operatorFilterRegistryAddress, shopWalletAddress);
}

export async function deployContracts(feesVaultWallet: string, operatorFilterRegistryAddress: string, shopWalletAddress: string) {
   const restrictedRegistryAddress = await deployProxy(
      "MightyNetERC721RestrictedRegistryV2",
      "initialize"
   );
   let restrictedRegistry = await ethers.getContractFactory("MightyNetERC721RestrictedRegistryV2");
   let restrictedRegistryContract = await restrictedRegistry.attach(restrictedRegistryAddress) as MightyNetERC721RestrictedRegistryV2;

   const terminalAddress = await deployProxy(
      "MightyNetTerminal",
      "initialize",
      restrictedRegistryAddress,
      "300000000000000",
      feesVaultWallet
   );
   let mightyNetTerminal = await ethers.getContractFactory("MightyNetTerminal");
   let mightyNetTerminalContract = await mightyNetTerminal.attach(terminalAddress) as MightyNetTerminal;

   await mightyNetTerminalContract
      .grantRole(await mightyNetTerminalContract.RECEIVE_EXECUTOR_ROLE(), feesVaultWallet);
   await restrictedRegistryContract
      .grantRole(await restrictedRegistryContract.RESTRICTOR_ROLE(), mightyNetTerminalContract.address);

   const shopAddress = await deployProxy(
      "MightyNetShop",
      "initialize",
      shopWalletAddress
   );

   const mightyActionHeroesBlueprintsAddress = await deployERC1155(
      "MightyActionHeroesBlueprints",
      "https://dev.cdn.mightynet.xyz/mahb/metadata/contract",
      terminalAddress,
      operatorFilterRegistryAddress
   );

   const mightyActionHeroesPARTSAddress = await deployERC1155(
      "MightyActionHeroesPARTS",
      "https://dev.cdn.mightynet.xyz/mahp/metadata/contract",
      terminalAddress,
      operatorFilterRegistryAddress
   );

   const mightyActionHeroesSupplyCratesAddress = await deployERC1155(
      "MightyActionHeroesSupplyCrates",
      "https://dev.cdn.mightynet.xyz/mahsc/metadata/contract",
      terminalAddress,
      operatorFilterRegistryAddress
   );

   const mightyActionHeroesGadgetAddress = await deployERC721(
      "MightyActionHeroesGadget",
      "https://dev.cdn.mightynet.xyz/mahg/metadata/contract",
      terminalAddress,
      operatorFilterRegistryAddress,
      restrictedRegistryAddress
   );

   const mightyNetERC1155ClaimerAddresss = await deployERC1155Claimer("MightyActionHeroesSupplyCrates", mightyActionHeroesSupplyCratesAddress)

   // Output contract addresses
   console.info(`MightyNetTerminal: ${terminalAddress}`);
   console.info(`MightyNetShop: ${shopAddress}`);
   console.info(`MightyActionHeroesBlueprints: ${mightyActionHeroesBlueprintsAddress}`);
   console.info(`MightyActionHeroesPARTS: ${mightyActionHeroesPARTSAddress}`);
   console.info(
      `MightyActionHeroesSupplyCrates: ${mightyActionHeroesSupplyCratesAddress}`
   );
   console.info(`MightyActionHeroesGadget: ${mightyActionHeroesGadgetAddress}`);
   console.info(`MightyNetERC1155Claimer: ${mightyNetERC1155ClaimerAddresss}`);
   console.info(
      `MightyNetERC721RestrictedRegistry: ${restrictedRegistryAddress}`
   );
   console.info(`OperatorFilterRegistry: ${operatorFilterRegistryAddress}`);
}

async function deployERC1155(
   contractName: string,
   contractUri: string,
   terminalAddress: string,
   operatorFilterRegistryAddress: string
) {
   const erc1155Address = await deployProxy(
      contractName,
      "initialize",
      "https://mightynet-dev.mightybeargames.com:7070/api/v1/metadata/1155/",
      contractUri,
      operatorFilterRegistryAddress
   );
   await setupERC1155(contractName, erc1155Address, terminalAddress);

   return erc1155Address;
}

async function deployERC721(
   contractName: string,
   contractUri: string,
   terminalAddress: string,
   operatorFilterRegistryAddress: string,
   restrictedRegisteryAddress: string
) {
   const erc721Address = await deployProxy(
      contractName,
      "initialize",
      "https://mightynet-dev.mightybeargames.com:7070/api/v1/metadata/721/",
      contractUri,
      operatorFilterRegistryAddress,
      restrictedRegisteryAddress
   );
   await setupERC721(contractName, erc721Address, terminalAddress);

   return erc721Address;
}

async function deployERC1155Claimer(
   mightyNetERC1155contractName: string,
   mightyNetERC1155ContractAddress: string) {
      const erc1155ContractClaimerAddress = await deployProxy(
         "MightyNetERC1155Claimer",
         "initialize",
         mightyNetERC1155ContractAddress
      );
      await setupERC1155Claimer(mightyNetERC1155contractName, mightyNetERC1155ContractAddress, erc1155ContractClaimerAddress);
   
      return erc1155ContractClaimerAddress;
   }

main();
