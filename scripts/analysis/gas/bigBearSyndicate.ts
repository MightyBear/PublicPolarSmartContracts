/*
 * Copyright (c) 2022 Mighty Bear Games
 */

import { BigNumber } from "ethers";
import { ethers, network, upgrades } from "hardhat";
import { exportGas } from "../utils";

const baseUri = "https://mighty.net/api/bbs/";
const contractUri = "https://mighty.net/api/bbs";

async function main() {
	const methodGas: Record<string, BigNumber> = {};

	const [owner, minter, player1, player2] = await ethers.getSigners();

	const bbsFactory = await ethers.getContractFactory("BigBearSyndicate");

	// ------------------------------
	// 			 Deployment
	// ------------------------------
	const bbs = await upgrades.deployProxy(bbsFactory, [baseUri, contractUri], {
		initializer: "initialize",
	});

	await bbs.deployed();

	methodGas["Proxy Deployment"] = bbs.deployTransaction.gasLimit;

	// ------------------------------
	// 			  Minting
	// ------------------------------
	await bbs.setMinter(minter.address);

	methodGas["Mint token"] = await bbs
		.connect(minter)
		.estimateGas.mint(player1.address, 1);

	// ------------------------------
	// 			  Burning
	// ------------------------------

	// Mint token for burning
	await bbs.connect(minter).mint(player1.address, 1);

	methodGas["Burn token"] = await bbs.connect(player1).estimateGas.burn(1);

	// ------------------------------
	// 			 Transfers
	// ------------------------------

	// Mint token for transfers
	await bbs.connect(minter).mint(player1.address, 2);
	await bbs.connect(minter).mint(player1.address, 3);

	methodGas["Transfer token"] = await bbs
		.connect(player1)
		.estimateGas.transferFrom(player1.address, player2.address, 2);

	methodGas["Safe transfer token"] = await bbs
		.connect(player1)
		.estimateGas["safeTransferFrom(address,address,uint256)"](
			player1.address,
			player2.address,
			3
		);

	// ------------------------------
	// 			  Pausing
	// ------------------------------
	methodGas["Pause"] = await bbs.connect(owner).estimateGas.pause();

	// Pause contract to unpause
	await bbs.pause();

	methodGas["Unpause"] = await bbs.connect(owner).estimateGas.unpause();

	await bbs.unpause();

	// ------------------------------
	// 			  Setters
	// ------------------------------
	methodGas["Set base URI"] = await bbs.estimateGas.setBaseURI(baseUri);
	methodGas["Set contract URI"] = await bbs.estimateGas.setContractURI(
		contractUri
	);
	methodGas["Set minter address"] = await bbs.estimateGas.setMinter(
		minter.address
	);
	methodGas["Set mints per address"] =
		await bbs.estimateGas.setMintsPerAddress(3);

	await exportGas(methodGas, "BigBearSyndicate");
}

main();
