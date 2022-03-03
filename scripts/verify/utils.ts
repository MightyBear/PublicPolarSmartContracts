/*
 * Copyright (c) 2022 Mighty Bear Games
 */

import { run } from "hardhat";

export async function verify(
	contractName: string,
	address: string,
	...args: any[]
): Promise<void> {
	console.log(`Verifying contract ${contractName}...`);

	await run("verify:verify", {
		contract: contractName,
		address: address,
		constructorArguments: args,
	});

	console.log(`Contract ${contractName} verified.`);
}
