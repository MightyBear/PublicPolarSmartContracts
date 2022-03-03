/*
 * Copyright (c) 2022 Mighty Bear Games
 */
import fs from "fs";
import { ethers } from "hardhat";

interface FreeMints {
	address: string;
	mints: number;
}

var argv = process.argv.slice(2);

var minterAddress = argv[0];
var freeMintsFileName = argv[1];

const failedAddressesDir = "dist/failedFreeMints";

console.info(
	`Setting the free mints of BigBearSyndicate at ${minterAddress} with addresses from ${freeMintsFileName}`
);

const main = async () => {
	// Read addresses from tsv file and convert to array
	const data = fs.readFileSync(freeMintsFileName, "utf8");

	const freeMints: FreeMints[] = data
		.split("\n")
		.filter(line => line.trim().length > 0)
		.map(line => {
			const [address, mints] = line.split("\t");
			return {
				address,
				mints: parseInt(mints),
			};
		});

	// Validate that all guaranteed mints are valid
	const invalidAddresses = freeMints.filter(
		freeMint =>
			freeMint.mints < 1 || !ethers.utils.isAddress(freeMint.address)
	);

	if (invalidAddresses.length > 0) {
		throw new Error(
			`The following addresses are invalid: ${invalidAddresses.map(
				invalidAddress => invalidAddress.address
			)}`
		);
	}

	let factory = await ethers.getContractFactory("BigBearSyndicateMinter");

	console.info(`Attaching to BigBearSyndicateMinter at ${minterAddress}`);

	let minter = await factory.attach(minterAddress);

	console.info(`Setting free mints for ${freeMints.length} addresses`);

	for (let i = 0; i < freeMints.length; i++) {
		const freeMint = freeMints[i];

		try {
			console.info(
				`Setting ${i + 1}/${freeMints.length}: ${freeMint.address} to ${
					freeMint.mints
				}`
			);

			await minter.setFreeMintClaims(freeMint.address, freeMint.mints);
		} catch (e) {
			console.error(
				`Failed to set free mints for ${freeMint.address}: ${e}`
			);

			const remainingAddressesFilename = `${failedAddressesDir}/${freeMintsFileName}.remaining.tsv`;

			console.info(
				`Saving failed addresses to ${remainingAddressesFilename}`
			);

			// Save all addresses that have not been set into a file
			const remainingFreeMints = freeMints.slice(i);
			fs.writeFileSync(
				remainingAddressesFilename,
				remainingFreeMints
					.map(freeMint => `${freeMint.address}\t${freeMint.mints}`)
					.join("\n")
			);

			break;
		}
	}
};

main();
