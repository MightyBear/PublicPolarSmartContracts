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

var rawAddressesFilename = argv[0];

console.info(`Generating allowlist from addresses in ${rawAddressesFilename}`);

const main = async () => {
	// Read addresses from tsv file and convert to array
	const rawData = fs.readFileSync(rawAddressesFilename, "utf8");

	const rawAddresses: string[] = rawData
		.split("\n")
		.map(line => line.trim().split("\t")[0])
		.filter(address => address.length > 0);

	console.info(`Validating ${rawAddresses.length} addresses`);

	// Validate that all guaranteed mints are valid
	const invalidAddresses = rawAddresses.filter(
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
		addresses: rawAddresses,
	};

	console.info(`Saving allowlist to dist/bbs_allowlist.json`);

	// Save allowlist to file
	fs.writeFileSync("dist/bbs_allowlist.json", JSON.stringify(allowList));
};

main();
