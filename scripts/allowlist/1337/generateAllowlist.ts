/*
 * Copyright (c) 2022 Mighty Bear Games
 */
import fs from "fs";
import { ethers } from "hardhat";

interface GuaranteedMint {
	address: string;
	mints: number;
}

var argv = process.argv.slice(2);

var addressesFilename = argv[0];

console.info(`Generating allowlist from addresses in ${addressesFilename}`);

const main = async () => {
	// Read addresses from tsv file and convert to array
	const data = fs.readFileSync(addressesFilename, "utf8");

	const addresses: string[] = data
		.split("\n")
		.map(line => line.trim())
		.filter(line => line.length > 0);

	console.info(`Validating ${addresses.length} addresses`);

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

	const allowList = {
		addresses: addresses,
	};

	console.info(`Saving allowlist to dist/allowlist.json`);

	// Save allowlist to file
	fs.writeFileSync("dist/1337_allowlist.json", JSON.stringify(allowList));
};

main();
