/*
 * Copyright (c) 2022 Mighty Bear Games
 */

import { MightyTrophy } from "../../../typechain";
import { deployUpgradeable } from "./deploy";

export async function deployMightyTrophy(
	baseUri: string,
	contractUri: string
): Promise<MightyTrophy> {
	const contract = (await deployUpgradeable(
		"contracts/mtt/MightyTrophy.sol:MightyTrophy",
		"initialize",
		baseUri,
		contractUri
	)) as MightyTrophy;

	return contract;
}
