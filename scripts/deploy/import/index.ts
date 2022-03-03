/*
 * Copyright (c) 2022 Mighty Bear Games
 */

import { forceImport } from "../utils";

const argv = process.argv.slice(2);

const address = argv[0];
const contractName = argv[1];

console.info(`Importing contract from address: ${address}`);

forceImport(contractName, address).catch(error => {
	console.error(error);
	process.exitCode = 1;
});
