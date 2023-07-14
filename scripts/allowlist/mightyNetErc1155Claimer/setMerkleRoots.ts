/*
 * Copyright (c) 2023 Mighty Bear Games
 */
/*
 * Copyright (c) 2022 Mighty Bear Games
 */
import fetch from "node-fetch";

import { keccak256 } from "ethers/lib/utils";
import { ethers } from "hardhat";
import MerkleTree from "merkletreejs";

var argv = process.argv.slice(2);

var claimerAddress = argv[0];
var snapshotUrl = argv[1];

console.info(
	`Setting the merkle root of MightyNetERC1155Claimer at ${claimerAddress} with addresses from ${snapshotUrl}`
);

interface TreasureAddressProgress {
	playerId: string;
	address: string;
	progress: number[];
	points: number;
	rewardNum: number;
}

const main = async () => {
	const response = await fetch(snapshotUrl);
	const snapshotData = (await response.json()) as Record<
		string,
		TreasureAddressProgress
	>;

	const claimsList: Record<number, string[]> = {};
	Object.keys(snapshotData).forEach(playerId => {
		const data = snapshotData[playerId];
		if (!claimsList[data.rewardNum]) {
			claimsList[data.rewardNum] = [];
		}
		claimsList[data.rewardNum].push(data.address);
	});
	let factory = await ethers.getContractFactory("MightyNetERC1155Claimer");
	console.info(`Attaching to MightyNetERC1155Claimer at ${claimerAddress}`);
	let claimer = await factory.attach(claimerAddress);

	const rewardNums = Object.keys(claimsList);
	let claimWhitelistSize = Number(await claimer.claimWhitelistSize());
	let index = 0;
	for (const rewardNum of rewardNums) {
		if (parseInt(rewardNum) == 0) {
			continue;
		}
		const addresses = claimsList[parseInt(rewardNum)];
		console.info(
			`Found ${addresses.length} addresses for ${rewardNum} claims`
		);
		console.info("address", addresses);
		console.info(`Building merkle tree`);
		const leaves = addresses.map(x => keccak256(x));
		const merkleTree = new MerkleTree(leaves, keccak256, {
			sortPairs: true,
		});
		const rootHash = merkleTree.getRoot();

		console.info(
			`RootHash for ${rewardNum} claims: ${rootHash.toString("hex")}`
		);
		const indexToUpdate = parseInt(rewardNum) - 1;
		if (indexToUpdate >= claimWhitelistSize) {
			for (let i = claimWhitelistSize; i < indexToUpdate; ++i) {
				const emptyLeaves = [keccak256(ethers.constants.AddressZero)];
				const emptyTree = new MerkleTree(emptyLeaves, keccak256, {
					sortPairs: true,
				});
				const emptyHash = emptyTree.getRoot();
				await claimer.pushToClaimWhitelist(emptyHash);
				++index;
			}
			await claimer.pushToClaimWhitelist(rootHash);

			claimWhitelistSize = indexToUpdate + 1;
		} else {
			await claimer.setClaimWhitelistMerkleRoot(rootHash, indexToUpdate);
		}

		++index;
	}
};
main();
