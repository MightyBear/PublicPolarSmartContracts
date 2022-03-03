/*
 * Copyright (c) 2023 Mighty Bear Games
 */
import { deployProxy } from "../utils";

console.info("Deploying MightyNetERC721RestrictedRegistryV2");

deployProxy("MightyNetERC721RestrictedRegistryV2", "initialize").catch(error => {
	console.error(error);
	process.exitCode = 1;
});
