/*
 * Copyright (c) 2023 Mighty Bear Games
 */

import { verify } from "./utils";

const address = process.argv[2];
const argv = process.argv.slice(3);

console.info(
	`Verifying MightyActionHeroesPARTS at ${address} with args: ${argv}`
);

verify(
	"contracts/parts/MightyActionHeroesPARTS.sol:MightyActionHeroesPARTS",
	address,
	...argv
).catch(error => {
	console.error(error);
	process.exitCode = 1;
});
