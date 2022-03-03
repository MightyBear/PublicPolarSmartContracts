/*
 * Copyright (c) 2022 Mighty Bear Games
 */
import fs from "fs";
import { ethers } from "hardhat";

interface GuaranteedMintUpdate {
	currentAddress: string;
	newAddress?: string;
	mints: number;
}

var argv = process.argv.slice(2);

var minterAddress = argv[0];
var guaranteedMintsUpdateFilename = argv[1];

const failedAddressesDir = "dist/failedGuaranteedMintUpdates";

console.info(
	`Updating the guaranteed mints of MightyNetGenesisPassMinter at ${minterAddress} with addresses from ${guaranteedMintsUpdateFilename}`
);

const main = async () => {
	// Read addresses from tsv file and convert to array
	const data = fs.readFileSync(guaranteedMintsUpdateFilename, "utf8");

	const guaranteedMintUpdates: GuaranteedMintUpdate[] = data
		.split("\n")
		.filter(line => line.length > 0)
		.map(line => {
			const [currentAddress, newAddress, mints] = line.split("\t");
			return {
				currentAddress,
				newAddress,
				mints: parseInt(mints),
			};
		});

	// Validate that all guaranteed mints addresses are valid
	const invalidAddresses = guaranteedMintUpdates
		.flatMap(guaranteedMintUpdate => {
			const addresses = [guaranteedMintUpdate.currentAddress];

			if (guaranteedMintUpdate.newAddress) {
				addresses.push(guaranteedMintUpdate.newAddress);
			}

			return addresses;
		})
		.filter(address => !ethers.utils.isAddress(address));

	if (invalidAddresses.length > 0) {
		throw new Error(
			`The following addresses are invalid: ${invalidAddresses.map(
				address => address
			)}`
		);
	}

	let factory = await ethers.getContractFactory("MightyNetGenesisPassMinter");

	console.info(`Attaching to MightyNetGenesisPassMinter at ${minterAddress}`);

	let minter = await factory.attach(minterAddress);

	console.info(
		`Updating guaranteed mints for ${guaranteedMintUpdates.length} addresses`
	);

	for (let i = 0; i < guaranteedMintUpdates.length; i++) {
		const guaranteedMintUpdate = guaranteedMintUpdates[i];

		try {
			console.info(
				`Updating ${i + 1}/${guaranteedMintUpdates.length}: ${
					guaranteedMintUpdate.currentAddress
				}`
			);

			if (guaranteedMintUpdate.newAddress) {
				console.info(
					`Swapping address to ${guaranteedMintUpdate.newAddress}`
				);

				console.info(`Removing current address...`);
				await minter.setGuaranteedMints(
					guaranteedMintUpdate.currentAddress,
					0
				);

				console.info(`Adding new address...`);
				await minter.setGuaranteedMints(
					guaranteedMintUpdate.newAddress,
					guaranteedMintUpdate.mints
				);
			} else {
				console.info(`Setting mints to ${guaranteedMintUpdate.mints}`);
				await minter.setGuaranteedMints(
					guaranteedMintUpdate.currentAddress,
					guaranteedMintUpdate.mints
				);
			}

			console.info(`\nDone\n`);
		} catch (e) {
			console.error(
				`Failed to update guaranteed mints for ${guaranteedMintUpdate.currentAddress}: ${e}`
			);

			const remainingAddressesFilename = `${failedAddressesDir}/${guaranteedMintsUpdateFilename}.remaining.tsv`;

			console.info(
				`Saving failed update addresses to ${remainingAddressesFilename}`
			);

			// Save all addresses that have not been set into a file
			const remainingGuaranteedMints = guaranteedMintUpdates.slice(i);
			fs.writeFileSync(
				remainingAddressesFilename,
				remainingGuaranteedMints
					.map(
						guaranteedMintUpdate =>
							`${guaranteedMintUpdate.currentAddress}\t${guaranteedMintUpdate.newAddress}\t${guaranteedMintUpdate.mints}`
					)
					.join("\n")
			);

			break;
		}
	}
};

main();
