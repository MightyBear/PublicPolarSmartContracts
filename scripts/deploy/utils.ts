/*
 * Copyright (c) 2022 Mighty Bear Games
 */

import { artifacts, ethers, upgrades } from "hardhat";
import fs from "fs";
import { Contract } from "ethers";
import { MightyNetERC1155Upgradeable } from "../../typechain/MightyNetERC1155Upgradeable";
import { MightyNetERC721Upgradeable } from "../../typechain/MightyNetERC721Upgradeable";

export async function deploy(
	contractName: string,
	...args: any[]
): Promise<string> {
	console.log(`Deploying contract ${contractName}...`);

	let factory = await ethers.getContractFactory(contractName);

	let contract = await factory.deploy(...args);

	console.log(`Confirming contract ${contractName} deployment...`);

	await contract.deployed();

	const chainId = (await ethers.provider.getNetwork()).chainId;

	saveArtifacts(contract, chainId, contractName);

	console.log(`${contractName} contract deployed to `, contract.address);

	return contract.address;
}

export async function deployProxy(
	contractName: string,
	initializer: string,
	...args: any[]
): Promise<string> {
	console.log(`Deploying proxy contract ${contractName}...`);

	let factory = await ethers.getContractFactory(contractName);

	let contract = await upgrades.deployProxy(factory, args, {
		initializer: initializer,
	});

	console.log(`Confirming proxy contract ${contractName} deployment...`);

	await contract.deployed();

	const chainId = (await ethers.provider.getNetwork()).chainId;

	saveArtifacts(contract, chainId, contractName);

	console.log(
		`${contractName} proxy contract deployed to`,
		`${contract.address}.`,
		"For the actual logic contract, look up the transactions of the deployer address on Etherscan."
	);

	return contract.address;
}

export async function upgradeProxy(
	contractName: string,
	address: string
): Promise<string> {
	console.log(`Upgrading proxy contract ${contractName}...`);

	let factory = await ethers.getContractFactory(contractName);

	let contract = await upgrades.upgradeProxy(address, factory);

	const chainId = (await ethers.provider.getNetwork()).chainId;

	saveArtifacts(contract, chainId, contractName);

	console.log(
		`${contractName} proxy contract upgraded at`,
		`${contract.address}.`,
		"For the upgraded logic contract, look up the transactions of the deployer address on Etherscan."
	);

	return contract.address;
}

export async function forceImport(contractName: string, address: string) {
	console.log(`Importing contract ${contractName}...`);

	let factory = await ethers.getContractFactory(contractName);

	await upgrades.forceImport(address, factory);

	console.log(`Successfully imported contract ${contractName}.`);
}

function saveArtifacts(
	contract: Contract,
	chainId: number,
	contractName: string
) {
	let artifactsDir = process.cwd() + "/dist/contracts";

	if (!fs.existsSync(artifactsDir)) {
		fs.mkdirSync(artifactsDir, { recursive: true });
	}

	const artifact = {
		address: contract.address,
		chainId: chainId,
		artifact: artifacts.readArtifactSync(contractName),
	};

	fs.writeFileSync(
		artifactsDir + `/${artifact.artifact.contractName}.json`,
		JSON.stringify(artifact, null, 2)
	);
}

// Transfer ownership of proxy admin to a new address
export async function transferProxyAdminOwnership(newOwner: string) {
	console.log(`Transferring ownership of proxy admin to ${newOwner}...`);

	await upgrades.admin.transferProxyAdminOwnership(newOwner);

	console.log(`Successfully transferred ownership of proxy admin.`);
}

export async function getAdminAddress(proxyAddress: string) {
	console.log(`Getting admin address of proxy ${proxyAddress}...`);

	const address = await upgrades.erc1967.getAdminAddress(proxyAddress);

	console.log(`Admin address of proxy ${proxyAddress} is ${address}.`);
}

export async function setupERC1155(
	contractName: string,
	erc1155ContractAddress: string,
	terminalContractAddress: string
) {
	console.log(`Granting minter and burner role from ${erc1155ContractAddress} (${contractName}) to terminal contract at ${terminalContractAddress}...`);

	let erc1155Factory = await ethers.getContractFactory(contractName);
	let erc1155Contract = await erc1155Factory.attach(erc1155ContractAddress) as MightyNetERC1155Upgradeable;

	await erc1155Contract
		.grantRole(await erc1155Contract.MINTER_ROLE(), terminalContractAddress);
	await erc1155Contract
		.grantRole(await erc1155Contract.BURNER_ROLE(), terminalContractAddress);

	console.log(`Granting registering ${erc1155ContractAddress}(${contractName}) as ERC1155 Contract on  to terminal contract at ${terminalContractAddress}...`);
	let terminalFactory = await ethers.getContractFactory("MightyNetTerminal");
	let terminalContract = terminalFactory.attach(terminalContractAddress);

	terminalContract.setTokenContracts(erc1155ContractAddress, await terminalContract.ERC1155_CONTRACT_TYPE());

	console.log(`Successfully ERC1155 setup.`);
}

export async function setupERC721(
	contractName: string,
	erc721ContractAddress: string,
	terminalContractAddress: string
) {
	console.log(`Granting minter role from ${erc721ContractAddress} (${contractName}) to terminal contract at ${terminalContractAddress}...`);

	let erc721Factory = await ethers.getContractFactory(contractName);
	let erc721Contract = await erc721Factory.attach(erc721ContractAddress) as MightyNetERC721Upgradeable;

	await erc721Contract
		.connect(terminalContractAddress)
		.grantRole(await erc721Contract.MINTER_ROLE(), terminalContractAddress);

	console.log(`Granting registering ${erc721ContractAddress}(${contractName}) as ERC721 Contract on  to terminal contract at ${terminalContractAddress}...`);
	let terminalFactory = await ethers.getContractFactory("MightyNetTerminal");
	let terminalContract = terminalFactory.attach(terminalContractAddress);

	terminalContract.setTokenContracts(erc721ContractAddress, await terminalContract.ERC721_CONTRACT_TYPE());

	console.log(`Successfully ERC721 setup.`);
}
