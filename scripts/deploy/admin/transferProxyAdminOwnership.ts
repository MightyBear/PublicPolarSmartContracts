/*
 * Copyright (c) 2022 Mighty Bear Games
 */

import { transferProxyAdminOwnership } from "../utils";

var address = process.argv.slice(2)[0];

console.info(`Transfering proxy admin ownership to ${address}...`);

transferProxyAdminOwnership(address).catch(error => {
	console.error(error);
	process.exitCode = 1;
});
