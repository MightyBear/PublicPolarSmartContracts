/*
 * Copyright (c) 2022 Mighty Bear Games
 */

import { upgradeProxy } from "../utils";

var address = process.argv.slice(2)[0];

console.info(`Upgrading to MightyNetTerminal at address: ${address}`);

upgradeProxy("contracts/terminal/MightyNetTerminal.sol:MightyNetTerminal", address).catch(
	error => {
		console.error(error);
		process.exitCode = 1;
	}
);
