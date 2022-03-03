/*
 * Copyright (c) 2022 Mighty Bear Games
 */

import { OperatorFilterRegistry } from "../../../typechain";
import { network, ethers } from "hardhat";
import { deploy } from "./deploy";
import MerkleTree from "merkletreejs";
import { keccak256 } from "ethers/lib/utils";
import { mine } from "@nomicfoundation/hardhat-network-helpers";
import {
	getProxyAdminFactory,
	getTransparentUpgradeableProxyFactory,
} from "@openzeppelin/hardhat-upgrades/dist/utils";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

const hre = require("hardhat");

export async function deployOperatorFilterRegistry(): Promise<OperatorFilterRegistry> {
	return await deploy("OperatorFilterRegistry");
}

export async function setBlockNumber(blockNumber: number) {
	const currentBlockNumber = await getBlockNumber();

	if (blockNumber > currentBlockNumber) {
		await mineBlocks(blockNumber - currentBlockNumber);

		return;
	}

	throw new Error("Cannot set block number to a previous block");
}

export async function mineBlocks(numBlocks: number) {
	await mine(numBlocks);
}

export async function setBlockTimestamp(timestamp: number) {
	await network.provider.send("evm_mine", [timestamp]);
}

export async function getBlockTimestamp(): Promise<number> {
	return (await ethers.provider.getBlock("latest")).timestamp;
}

export async function getBlockNumber(): Promise<number> {
	return (await ethers.provider.getBlock("latest")).number;
}

export async function buildMerkleTree(
	...addresses: string[]
): Promise<MerkleTree> {
	// Whitelist address and build Merkle tree
	const leaves = addresses.map(x => keccak256(x));
	const merkleTree = new MerkleTree(leaves, keccak256, {
		sortPairs: true,
	});

	return merkleTree;
}

export async function setProxyAdmin(
	originalProxyAdminAddress: string,
	owner: SignerWithAddress,
	contractAddress: string,
	newProxyAdminAddress: string
): Promise<void> {
	await (await getProxyAdminFactory(hre))
		.attach(originalProxyAdminAddress)
		.connect(owner)
		.changeProxyAdmin(contractAddress, newProxyAdminAddress);
}

export async function setTransparentUpgradeableProxyAdmin(
	contractAddress: string,
	owner: SignerWithAddress,
	newProxyAdminAddress: string
): Promise<void> {
	await (await getTransparentUpgradeableProxyFactory(hre))
		.attach(contractAddress)
		.connect(owner)
		.changeAdmin(newProxyAdminAddress);
}
