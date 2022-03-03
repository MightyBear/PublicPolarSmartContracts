/*
 * Copyright (c) 2022 Mighty Bear Games
 */

import { upgradeProxy } from "../utils";

var address = process.argv.slice(2)[0];

console.info(`Upgrading to MightyNetGenesisPassV3 at address: ${address}`);

upgradeProxy(
	"contracts/1337/MightyNetGenesisPass.sol:MightyNetGenesisPass",
	address
).catch(error => {
	console.error(error);
	process.exitCode = 1;
});
