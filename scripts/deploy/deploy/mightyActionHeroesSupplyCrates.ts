/*
 * Copyright (c) 2022 Mighty Bear Games
 */

import { deployProxy } from "../utils";

const argv = process.argv.slice(2);

console.info(`Deploying MightyActionHeroesSupplyCrates with args: ${argv}`);

deployProxy("MightyActionHeroesSupplyCrates", "initialize", ...argv).catch(error => {
	console.error(error);
	process.exitCode = 1;
});
