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

var minterAddress = argv[0];
var guaranteedMintsFilename = argv[1];

const failedAddressesDir = "dist/failedGuaranteedMints";

console.info(
	`Setting the guaranteed mints of MightyNetGenesisPassMinter at ${minterAddress} with addresses from ${guaranteedMintsFilename}`
);

const main = async () => {
	// Read addresses from tsv file and convert to array
	const data = fs.readFileSync(guaranteedMintsFilename, "utf8");

	const guaranteedMints: GuaranteedMint[] = data
		.split("\n")
		.filter(line => line.length > 0)
		.map(line => {
			const [address, mints] = line.split("\t");
			return {
				address,
				mints: parseInt(mints),
			};
		});

	// Validate that all guaranteed mints are valid
	const invalidAddresses = guaranteedMints.filter(
		guaranteedMint =>
			guaranteedMint.mints < 1 ||
			!ethers.utils.isAddress(guaranteedMint.address)
	);

	if (invalidAddresses.length > 0) {
		throw new Error(
			`The following addresses are invalid: ${invalidAddresses.map(
				invalidAddress => invalidAddress.address
			)}`
		);
	}

	let factory = await ethers.getContractFactory("MightyNetGenesisPassMinter");

	console.info(`Attaching to MightyNetGenesisPassMinter at ${minterAddress}`);

	let minter = await factory.attach(minterAddress);

	console.info(
		`Setting guaranteed mints for ${guaranteedMints.length} addresses`
	);

	for (let i = 0; i < guaranteedMints.length; i++) {
		const guaranteedMint = guaranteedMints[i];

		try {
			console.info(
				`Setting ${i + 1}/${guaranteedMints.length}: ${
					guaranteedMint.address
				} to ${guaranteedMint.mints}`
			);

			await minter.setGuaranteedMints(
				guaranteedMint.address,
				guaranteedMint.mints
			);
		} catch (e) {
			console.error(
				`Failed to set guaranteed mints for ${guaranteedMint.address}: ${e}`
			);

			const remainingAddressesFilename = `${failedAddressesDir}/${guaranteedMintsFilename}.remaining.tsv`;

			console.info(
				`Saving failed addresses to ${remainingAddressesFilename}`
			);

			// Save all addresses that have not been set into a file
			const remainingGuaranteedMints = guaranteedMints.slice(i);
			fs.writeFileSync(
				remainingAddressesFilename,
				remainingGuaranteedMints
					.map(
						guaranteedMint =>
							`${guaranteedMint.address}\t${guaranteedMint.mints}`
					)
					.join("\n")
			);

			break;
		}
	}
};

main();
