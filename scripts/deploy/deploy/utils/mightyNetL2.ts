import fse from "fs-extra";
import { deploy, deployProxy, setupERC1155, setupERC721 } from "../../utils";

console.warn(
   "WARNING: This script is meant for deploying the whole MightyNet L2 contract suite to a testnet. It is not meant for production use."
);
console.info("Contracts will be deployed with development metadata URLs.");

const argv = process.argv.slice(2);

console.info(`Deploying MightyNet L2 contract with dev wallet: ${argv[0]}`);

async function main() {
   console.info("Cleaning up artifacts directory");
   let artifactsDir = process.cwd() + "/dist/contracts";

   if (fse.existsSync(artifactsDir)) {
      // Delete the artifacts directory
      fse.removeSync(artifactsDir);
   }

   console.info("Deploying MightyNet L2 contracts");
   await deployContracts();
}

async function deployContracts() {
   // Deploy OperatorFilterRegistry
   const operatorFilterRegistryAddress = await deploy(
      "OperatorFilterRegistry"
   );

   // Deploy MightyNetERC721RestrictedRegistry
   const restrictedRegistryAddress = await deployProxy(
      "MightyNetERC721RestrictedRegistryV2",
      "initialize"
   );

   const terminalAddress = await deployProxy(
      "MightyNetTerminal",
      "initialize",
      restrictedRegistryAddress,
      "300000000000000",
      argv[0]
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
      operatorFilterRegistryAddress
   );

   // Output contract addresses
   console.info(`MightyNetTerminal: ${terminalAddress}`);
   console.info(`MightyActionHeroesBlueprints: ${mightyActionHeroesBlueprintsAddress}`);
   console.info(`MightyActionHeroesPARTS: ${mightyActionHeroesPARTSAddress}`);
   console.info(
      `MightyActionHeroesSupplyCrates: ${mightyActionHeroesSupplyCratesAddress}`
   );
   console.info(`MightyActionHeroesGadget: ${mightyActionHeroesGadgetAddress}`);
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
      "https://mightynet-dev.mightybeargames.com:7070/api/v1/metadata/",
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
   operatorFilterRegistryAddress: string
) {
   const erc721Address = await deployProxy(
      contractName,
      "initialize",
      "https://mightynet-dev.mightybeargames.com:7070/api/v1/metadata/",
      contractUri,
      operatorFilterRegistryAddress
   );
   await setupERC721(contractName, erc721Address, terminalAddress);

   return erc721Address;
}

main();
