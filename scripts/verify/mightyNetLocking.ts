/*
 * Copyright (c) 2022 Mighty Bear Games
 */

import { verify } from "./utils";

const address = process.argv[2];

console.info(`Verifying MightyNetLocking at ${address}`);

verify(
	"contracts/locking/MightyNetLocking.sol:MightyNetLocking",
	address
).catch(error => {
	console.error(error);
	process.exitCode = 1;
});
