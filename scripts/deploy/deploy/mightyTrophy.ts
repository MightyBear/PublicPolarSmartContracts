/*
 * Copyright (c) 2022 Mighty Bear Games
 */

import { deployProxy } from "../utils";

const argv = process.argv.slice(2);

console.info(`Deploying MightyTrophy with args: ${argv}`);

deployProxy("MightyTrophy", "initialize", ...argv).catch(error => {
	console.error(error);
	process.exitCode = 1;
});
