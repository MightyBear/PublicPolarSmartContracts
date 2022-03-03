/*
 * Copyright (c) 2022 Mighty Bear Games
 */

import { setupERC721 } from "../utils";

const argv = process.argv.slice(2);

console.info(`Setting Up MightyNetERC721Upgradeable with args: ${argv}`);

setupERC721(argv[0], argv[1], argv[2]).catch(error => {
	console.error(error);
	process.exitCode = 1;
});
