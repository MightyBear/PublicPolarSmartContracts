/*
 * Copyright (c) 2022 Mighty Bear Games
 */
import fs from "fs";
import { ethers } from "hardhat";

var argv = process.argv.slice(2);

var minterAddress = argv[0];
var paidMintAddressesFilename = argv[1];
var mints = argv[2];

const failedAddressesDir = "dist/failedPaidMints";

console.info(
	`Setting ${mints} paid mints for BigBearSyndicate at ${minterAddress} for addresses in ${paidMintAddressesFilename}`
);

const main = async () => {
	// Read addresses from tsv file and convert to array
	const data = fs.readFileSync(paidMintAddressesFilename, "utf8");

	const addresses: string[] = data
		.split("\n")
		.map(line => line.trim().split("\t")[0])
		.filter(address => address.length > 0);

	// Validate that all guaranteed mints are valid
	const invalidAddresses = addresses.filter(
		address => !ethers.utils.isAddress(address)
	);

	if (invalidAddresses.length > 0) {
		console.info(`Found ${invalidAddresses.length} invalid addresses`);

		// Save invalid addresses to file
		fs.writeFileSync(
			"dist/invalidAddresses.txt",
			invalidAddresses.join("\n")
		);

		return;
	}

	let factory = await ethers.getContractFactory("BigBearSyndicateMinter");

	console.info(`Attaching to BigBearSyndicateMinter at ${minterAddress}`);

	let minter = await factory.attach(minterAddress);

	console.info(`Setting paid mints for ${addresses.length} addresses`);

	for (let i = 0; i < addresses.length; i++) {
		const address = addresses[i];

		try {
			console.info(
				`Setting ${i + 1}/${addresses.length}: ${address} to ${mints}`
			);

			await minter.setPaidMints(address, mints);
		} catch (e) {
			console.error(`Failed to set paid mints for ${address}: ${e}`);

			const remainingAddressesFilename = `${failedAddressesDir}/${paidMintAddressesFilename}.remaining.tsv`;

			console.info(
				`Saving failed addresses to ${remainingAddressesFilename}`
			);

			// Save all addresses that have not been set into a file
			const remainingFreeMints = addresses.slice(i);

			fs.writeFileSync(
				remainingAddressesFilename,
				remainingFreeMints.map(freeMint => `${address}`).join("\n")
			);

			break;
		}
	}
};

main();
