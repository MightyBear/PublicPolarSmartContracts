/*
 * Copyright (c) 2022 Mighty Bear Games
 */

import { deployProxy } from "../utils";

const argv = process.argv.slice(2);

console.info(`Deploying MightyNetERC1155Claimer with args: ${argv}`);

deployProxy("MightyNetERC1155Claimer", "initialize", ...argv).catch(error => {
	console.error(error);
	process.exitCode = 1;
});
