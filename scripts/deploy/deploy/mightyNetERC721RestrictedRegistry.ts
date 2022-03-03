/*
 * Copyright (c) 2023 Mighty Bear Games
 */
import { deployProxy } from "../utils";

console.info("Deploying MightyNetERC721RestrictedRegistry");

deployProxy("MightyNetERC721RestrictedRegistry", "initialize").catch(error => {
	console.error(error);
	process.exitCode = 1;
});
