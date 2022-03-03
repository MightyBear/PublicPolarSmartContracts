/*
 * Copyright (c) 2023 Mighty Bear Games
 */

import { deployProxy } from "../utils";

const argv = process.argv.slice(2);

console.info(`Deploying MightyActionHeroesPARTS with args: ${argv}`);

deployProxy("MightyActionHeroesPARTS", "initialize", ...argv).catch(error => {
	console.error(error);
	process.exitCode = 1;
});
