/*
 * Copyright (c) 2022 Mighty Bear Games
 */
import fetch from "node-fetch";

import { keccak256 } from "ethers/lib/utils";
import { ethers } from "hardhat";
import MerkleTree from "merkletreejs";

var argv = process.argv.slice(2);

var minterAddress = argv[0];
var allowlistUrl = argv[1];

console.info(
	`Setting the merkle root of MightyNetGenesisPassMinter at ${minterAddress} with addresses from ${allowlistUrl}`
);

const main = async () => {
	const response = await fetch(allowlistUrl);
	const data = await response.json();

	const addresses = data.addresses.map((x: string) => x) as string[];

	console.info(`Found ${addresses.length} addresses`);

	console.info(`Building merkle tree`);

	const leaves = addresses.map(x => keccak256(x));
	const merkleTree = new MerkleTree(leaves, keccak256, {
		sortPairs: true,
	});

	let factory = await ethers.getContractFactory("MightyNetGenesisPassMinter");

	console.info(`Attaching to MightyNetGenesisPassMinter at ${minterAddress}`);

	let minter = await factory.attach(minterAddress);

	const rootHash = merkleTree.getRoot();

	await minter.setAllowListMerkleRoot(rootHash);

	console.info(`Merkle root set to ${rootHash.toString("hex")}`);
};

main();
