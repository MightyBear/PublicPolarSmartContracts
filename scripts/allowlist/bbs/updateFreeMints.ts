/*
 * Copyright (c) 2022 Mighty Bear Games
 */
import fs from "fs";
import { ethers } from "hardhat";

interface FreeMintUpdate {
	currentAddress: string;
	newAddress: string;
}

var argv = process.argv.slice(2);

var minterAddress = argv[0];
var freeMintsUpdateFilename = argv[1];

const FAILED_ADDRESSES_DIR = "dist/failedFreeMintUpdates";

console.info(
	`Updating the free mints of BigBearSyndciateMinter at ${minterAddress} with addresses from ${freeMintsUpdateFilename}`
);

const main = async () => {
	// Read addresses from tsv file and convert to array
	const data = fs.readFileSync(freeMintsUpdateFilename, "utf8");

	const freeMintUpdates: FreeMintUpdate[] = data
		.split("\r\n")
		.filter(line => line.length > 0)
		.map(line => {
			const [currentAddress, newAddress] = line.split("\t");

			return {
				currentAddress,
				newAddress,
			};
		});

	// Validate that all guaranteed mints addresses are valid
	const invalidAddresses = freeMintUpdates
		.flatMap(update => {
			const addresses = [update.currentAddress, update.newAddress];

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

	let factory = await ethers.getContractFactory("BigBearSyndicateMinter");

	console.info(`Attaching to BigBearSyndicateMinter at ${minterAddress}`);

	let minter = await factory.attach(minterAddress);

	console.info(`Updating free mints for ${freeMintUpdates.length} addresses`);

	for (let i = 0; i < freeMintUpdates.length; i++) {
		const update = freeMintUpdates[i];

		try {
			console.info(
				`Updating ${i + 1}/${freeMintUpdates.length}: ${
					update.currentAddress
				}`
			);

			const mints = await (
				await minter.addressToFreeMintClaim(update.currentAddress)
			).toNumber();

			if (mints === 0) {
				throw new Error(
					`Address ${update.currentAddress} has no free mints`
				);
			}

			console.info(`Swapping address to ${update.newAddress}`);

			console.info(
				`Removing current address ${update.currentAddress}...`
			);
			await minter.setFreeMintClaims(update.currentAddress, 0);

			console.info(`Adding new address ${update.newAddress}...`);
			await minter.setFreeMintClaims(update.newAddress, mints);

			console.info(`\nDone\n`);
		} catch (e) {
			console.error(
				`Failed to update free mints for ${update.currentAddress}: ${e}`
			);

			const remainingAddressesFilename = `${FAILED_ADDRESSES_DIR}/${freeMintsUpdateFilename}.remaining.tsv`;

			console.info(
				`Saving failed update addresses to ${remainingAddressesFilename}`
			);

			// Save all addresses that have not been set into a file
			const remainingUpdates = freeMintUpdates.slice(i);
			fs.writeFileSync(
				remainingAddressesFilename,
				remainingUpdates
					.map(
						update =>
							`${update.currentAddress}\t${update.newAddress}`
					)
					.join("\n")
			);

			break;
		}
	}
};

main();
