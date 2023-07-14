/*
 * Copyright (c) 2022 Mighty Bear Games
 */
import { verify } from "./utils";

const address = process.argv[2];
const argv = process.argv.slice(3);

console.info(`Verifying MightyNetERC1155Claimer at ${address} with args: ${argv}`);

verify("contracts/claimer/MightyNetERC1155Claimer.sol:MightyNetERC1155Claimer", address, ...argv).catch(
	error => {
		console.error(error);
		process.exitCode = 1;
	}
);
