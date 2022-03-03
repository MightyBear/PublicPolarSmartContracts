/*
 * Copyright (c) 2022 Mighty Bear Games
 */

import { deployProxy } from "../utils";

const argv = process.argv.slice(2);

console.info(`Deploying MightyNet Locking with args: ${argv}`);

deployProxy("MightyNetLocking", "initialize", ...argv).catch(error => {
	console.error(error);
	process.exitCode = 1;
});
