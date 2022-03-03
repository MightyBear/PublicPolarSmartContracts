/*
 * Copyright (c) 2022 Mighty Bear Games
 */

import { ethers } from "hardhat";
import { MightyNetGenesisPass } from "../../../../typechain";
import { deployProxy } from "../../utils";

const argv = process.argv.slice(2);

console.info(
	`Deploying MightyNetGenesisPass and MightyNetGenesisPassMinter with args: ${argv}`
);

async function main() {
	const nftAddress = await deployProxy(
		"MightyNetGenesisPass",
		"initialize",
		...argv
	);

	const minterAddress = await deployProxy(
		"MightyNetGenesisPassMinter",
		"initialize",
		nftAddress
	);

	const factory = await ethers.getContractFactory("MightyNetGenesisPass");

	const contract = factory.attach(nftAddress) as MightyNetGenesisPass;

	await contract.setMinter(minterAddress);
}

main();
