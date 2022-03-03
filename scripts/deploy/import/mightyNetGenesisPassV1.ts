/*
 * Copyright (c) 2022 Mighty Bear Games
 */

import { forceImport } from "../utils";

var address = process.argv.slice(2)[0];

console.info(`Importing MightyNetGenesisPassV1 from address: ${address}`);

forceImport(
	"contracts/1337/old-versions/MightyNetGenesisPassV1.sol:MightyNetGenesisPassV1",
	address
).catch(error => {
	console.error(error);
	process.exitCode = 1;
});
