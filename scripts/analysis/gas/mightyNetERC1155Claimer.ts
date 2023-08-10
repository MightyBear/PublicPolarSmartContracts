/*
 * Copyright (c) 2022 Mighty Bear Games
 */

import { BigNumber } from "ethers";
import { ethers } from "hardhat";
import { keccak256 } from "ethers/lib/utils";
import { MightyActionHeroesSupplyCrates, MightyNetERC1155Claimer } from "../../../typechain";
import { exportGas } from "../utils";

import { deployUpgradeable } from "../../../test/nft/utils/deploy";
import {
	buildMerkleTree,
	deployOperatorFilterRegistry,
} from "../../../test/nft/utils/testHelper";

const baseUri = "https://mightynet.xyz/metadata/";
const contractUri = "https://mightynet.xyz/metadata/";

async function main() {
	const methodGas: Record<string, BigNumber> = {};

	// ------------------------------
	// 			 Deployment
	// ------------------------------
	const [owner, player1, player2, player3] =
		await ethers.getSigners();

	const operatorFilterRegistry = await deployOperatorFilterRegistry();

	const mightyActionHeroesSupplyCrates =
		(await deployUpgradeable(
			"MightyActionHeroesSupplyCrates",
			"initialize",
			baseUri,
			contractUri,
			operatorFilterRegistry.address
		)) as MightyActionHeroesSupplyCrates;

	await mightyActionHeroesSupplyCrates.deployed();

	const minterRole =
		await mightyActionHeroesSupplyCrates.MINTER_ROLE();

	const mnerc1155Claimer = (await deployUpgradeable(
		"MightyNetERC1155Claimer",
		"initialize",
		mightyActionHeroesSupplyCrates.address
	)) as MightyNetERC1155Claimer;

	await mnerc1155Claimer.deployed();

	await mightyActionHeroesSupplyCrates.grantRole(minterRole, mnerc1155Claimer.address);

	// ------------------------------
	// 			  Claiming
	// ------------------------------

	const merkleTree = await buildMerkleTree(
		player1.address
	);
	const root = merkleTree.getRoot();
	await mnerc1155Claimer.pushToClaimWhitelist(root);

	const merkleTree2 = await buildMerkleTree(
		player2.address
	);
	const root2 = merkleTree2.getRoot();
	await mnerc1155Claimer.pushToClaimWhitelist(root2);

	const merkleTree3 = await buildMerkleTree(
		player3.address
	);
	const root3 = merkleTree3.getRoot();
	await mnerc1155Claimer.pushToClaimWhitelist(root3);

	mnerc1155Claimer.setTokenId(0);

	const hexProof = merkleTree.getHexProof(keccak256(player1.address));
	methodGas[`Claiming 1 token`] = await mnerc1155Claimer.connect(player1).estimateGas.claim(hexProof);

	const hexProof2 = merkleTree2.getHexProof(keccak256(player2.address));
	methodGas[`Claiming 2 tokens`] = await mnerc1155Claimer.connect(player2).estimateGas.claim(hexProof2);

	const hexProof3 = merkleTree3.getHexProof(keccak256(player3.address));
	methodGas[`Claiming 3 tokens`] = await mnerc1155Claimer.connect(player3).estimateGas.claim(hexProof3);

	await exportGas(methodGas, "MightyNetERC1155Claimer");
}

main();
