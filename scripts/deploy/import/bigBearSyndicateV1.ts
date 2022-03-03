/*
 * Copyright (c) 2022 Mighty Bear Games
 */

import { forceImport } from "../utils";

var address = process.argv.slice(2)[0];

console.info(`Importing BigBearSyndicateV1 from address: ${address}`);

forceImport(
	"contracts/bbs/old-versions/BigBearSyndicateV1.sol:BigBearSyndicateV1",
	address
).catch(error => {
	console.error(error);
	process.exitCode = 1;
});
