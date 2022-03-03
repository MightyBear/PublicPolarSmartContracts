/*
 * Copyright (c) 2022 Mighty Bear Games
 */

import { getAdminAddress } from "../utils";

var address = process.argv.slice(2)[0];

console.info(`Getting proxy admin address of proxy at ${address}...`);

getAdminAddress(address).catch(error => {
	console.error(error);
	process.exitCode = 1;
});
