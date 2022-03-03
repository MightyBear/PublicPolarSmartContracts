/*
 * Copyright (c) 2023 Mighty Bear Games
 */

import { deployProxy } from "../utils";

const argv = process.argv.slice(2);

console.info(`Deploying MightyNetShop with args: ${argv}`);

deployProxy("MightyNetShop", "initialize", ...argv).catch(error => {
	console.error(error);
	process.exitCode = 1;
});
