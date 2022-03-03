/*
 * Copyright (c) 2022 Mighty Bear Games
 */

import { setupERC1155 } from "../utils";

const argv = process.argv.slice(2);

console.info(`Setting Up MightyNetERC1155Upgradeable with args: ${argv}`);

setupERC1155(argv[0], argv[1], argv[2]).catch(error => {
	console.error(error);
	process.exitCode = 1;
});
