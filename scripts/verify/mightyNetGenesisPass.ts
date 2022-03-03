/*
 * Copyright (c) 2022 Mighty Bear Games
 */

import { verify } from "./utils";

const address = process.argv[2];
const argv = process.argv.slice(3);

console.info(`Verifying MightyNetGenesisPass at ${address} with args: ${argv}`);

verify(
	"contracts/1337/MightyNetGenesisPass.sol:MightyNetGenesisPass",
	address,
	...argv
).catch(error => {
	console.error(error);
	process.exitCode = 1;
});
