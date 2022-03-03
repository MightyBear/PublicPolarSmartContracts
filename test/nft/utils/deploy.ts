/*
 * Copyright (c) 2022 Mighty Bear Games
 */

import { BaseContract } from "ethers";
import { ethers, upgrades } from "hardhat";

export async function deploy<T extends BaseContract>(
	contractName: string,
	...args: any[]
): Promise<T> {
	let factory = await ethers.getContractFactory(contractName);

	let contract = await factory.deploy(...args);

	await contract.deployed();

	return factory.attach(contract.address) as T;
}

export async function deployUpgradeable<T extends BaseContract>(
	name: string,
	initializer: string,
	...args: any[]
): Promise<T> {
	let factory = await ethers.getContractFactory(name);

	let contract = await upgrades.deployProxy(factory, args, {
		initializer: initializer,
	});

	await contract.deployed();

	return factory.attach(contract.address) as T;
}
