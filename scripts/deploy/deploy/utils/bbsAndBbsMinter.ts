/*
 * Copyright (c) 2022 Mighty Bear Games
 */

import { ethers } from "hardhat";
import { BigBearSyndicate } from "../../../../typechain";
import { deployProxy } from "../../utils";

const argv = process.argv.slice(2);

console.info(
	`Deploying BigBearSyndicate and BigBearSyndicateMinter with args: ${argv}`
);

async function main() {
	const nftAddress = await deployProxy(
		"BigBearSyndicate",
		"initialize",
		...argv
	);

	const minterAddress = await deployProxy(
		"BigBearSyndicateMinter",
		"initialize",
		nftAddress
	);

	const factory = await ethers.getContractFactory("BigBearSyndicate");

	const contract = factory.attach(nftAddress) as BigBearSyndicate;

	await contract.setMinter(minterAddress);
}

main();
