/*
 * Copyright (c) 2022 Mighty Bear Games
 */
import fs from "fs";
import { ethers } from "hardhat";

interface Snapshot {
	address: string;
	heldCount: number;
}

var argv = process.argv.slice(2);

var minterAddress = argv[0];
var snapshotAddressesFilename = argv[1];
var allowlistAddressesFilename = argv[2];

const failedAddressesDir = "dist/failedSnapshotPaidMints";

console.info(
	`Setting snapshot paid mints for BigBearSyndicate at ${minterAddress} for addresses in ${snapshotAddressesFilename}`
);

const main = async () => {
	// Read addresses from tsv file and convert to array
	const snapshotData = fs.readFileSync(snapshotAddressesFilename, "utf8");

	const snapshots: Snapshot[] = snapshotData
		.split("\n")
		.filter(line => line.length > 0)
		.map(line => {
			const [address, heldCount] = line.split("\t");
			return {
				address,
				heldCount: parseInt(heldCount),
			};
		});

	console.info(`Found ${snapshots.length} snapshots`);

	// Validate that all snapshot mint addresses are valid
	const invalidAddresses = snapshots.filter(
		snapshots => !ethers.utils.isAddress(snapshots.address)
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

	const allowlistData = fs.readFileSync(allowlistAddressesFilename, "utf8");

	const allowlistAddresses: string[] = allowlistData
		.split("\n")
		.map(line => line.trim().split("\t")[0])
		.filter(address => address.length > 0);

	console.info(`Found ${allowlistAddresses.length} allowlisted addresses`);

	let factory = await ethers.getContractFactory("BigBearSyndicateMinter");

	console.info(`Attaching to BigBearSyndicateMinter at ${minterAddress}`);

	let minter = await factory.attach(minterAddress);

	console.info(
		`Updating snapshot paid mints for ${snapshots.length} addresses`
	);

	for (let i = 0; i < snapshots.length; i++) {
		const snapshot = snapshots[i];

		try {
			let currentMints = (
				await minter.addressToPaidMints(snapshot.address)
			).toNumber();

			if (currentMints == 0) {
				const isInAllowlist = allowlistAddresses.some(
					allowlistAddress => {
						return (
							snapshot.address.toLowerCase() ===
							allowlistAddress.toLowerCase()
						);
					}
				);

				if (isInAllowlist) {
					currentMints = 2;
				}
			}

			const newMints = currentMints + snapshot.heldCount;

			console.info(
				`Updating ${i + 1}/${snapshots.length}: ${
					snapshot.address
				} to ${currentMints}(current) + ${
					snapshot.heldCount
				}(new) = ${newMints}`
			);

			await minter.setPaidMints(snapshot.address, newMints);
		} catch (e) {
			console.error(
				`Failed to update snapshot paid mints for ${snapshot.address}: ${e}`
			);

			const remainingAddressesFilename = `${failedAddressesDir}/${snapshotAddressesFilename}.remaining.tsv`;

			console.info(
				`Saving failed addresses to ${remainingAddressesFilename}`
			);

			// Save all addresses that have not been set into a file
			const remainingSnapshots = snapshots.slice(i);

			fs.writeFileSync(
				remainingAddressesFilename,
				remainingSnapshots
					.map(
						freeMint => `${snapshot.address}\t${snapshot.heldCount}`
					)
					.join("\n")
			);

			break;
		}
	}
};

main();
