/*
 * Copyright (c) 2022 Mighty Bear Games
 */

import { deployProxy } from "../utils";

const argv = process.argv.slice(2);

console.info(`Deploying MightyNetGenesisPass with args: ${argv}`);

deployProxy("MightyNetGenesisPass", "initialize", ...argv).catch(error => {
	console.error(error);
	process.exitCode = 1;
});
