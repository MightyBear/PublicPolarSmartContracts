/*
 * Copyright (c) 2023 Mighty Bear Games
 */
import { deployProxy } from "../utils";

console.info("Deploying MightyNetERC721TokenIdDecoder");

deployProxy("MightyNetERC721TokenIdDecoder", "initialize").catch(error => {
	console.error(error);
	process.exitCode = 1;
});
