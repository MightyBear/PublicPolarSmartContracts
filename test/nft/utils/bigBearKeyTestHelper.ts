/*
 * Copyright (c) 2022 Mighty Bear Games
 */

import { BigBearKey } from "../../../typechain";
import { deployUpgradeable } from "./deploy";

export async function deployBigBearKey(
	baseUri: string,
	contractUri: string
): Promise<BigBearKey> {
	const contract = (await deployUpgradeable(
		"contracts/bbkey/BigBearKey.sol:BigBearKey",
		"initialize",
		baseUri,
		contractUri
	)) as BigBearKey;

	return contract;
}
