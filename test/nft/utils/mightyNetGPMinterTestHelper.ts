/*
 * Copyright (c) 2022 Mighty Bear Games
 */

import { BigNumber } from "ethers";
import { keccak256 } from "ethers/lib/utils";
import { network } from "hardhat";
import {
	MightyNetGenesisPass,
	MightyNetGenesisPassMinter,
} from "../../../typechain";
import { deployUpgradeable } from "./deploy";
import { buildMerkleTree } from "./testHelper";

export class MightyNetGenesisPassMinterTestHelper {
	constructor(public mightyNetGPMinter: MightyNetGenesisPassMinter) {}

	async readyGuaranteedMint(
		address: string,
		mints: number,
		supply: number | undefined = undefined,
		startPhase = true
	): Promise<void> {
		// Set supply if necessary
		if (supply != undefined)
			await this.mightyNetGPMinter.setSupplyLimit(supply);

		await this.mightyNetGPMinter.setGuaranteedMints(address, mints);

		if (startPhase) {
			await this.startGuaranteedPhase();
		}
	}

	async readyAllowListMint(
		address: string,
		supply: number | undefined = undefined,
		startPhase = true
	): Promise<string[]> {
		// Set supply if necessary
		if (supply != undefined)
			await this.mightyNetGPMinter.setSupplyLimit(supply);

		const merkleTree = await buildMerkleTree(address);

		// Set contract Merkle root hash
		const rootHash = merkleTree.getRoot();

		await this.mightyNetGPMinter.setAllowListMerkleRoot(rootHash);

		// Get proof for address
		const hexProof = merkleTree.getHexProof(keccak256(address));

		if (startPhase) {
			await this.startAllowListPhase();
		}

		return hexProof;
	}

	async startGuaranteedPhase() {
		// Set start time to 1 second ago
		const now = Date.now();

		const startTime = BigNumber.from(now - 1000);

		await this.mightyNetGPMinter.setGuaranteedStartTime(startTime);

		await network.provider.send("evm_mine", [now]);
	}

	async startAllowListPhase() {
		// Set start time to 1 second ago
		const now = Date.now();

		const startTime = BigNumber.from(now - 1000);

		await this.mightyNetGPMinter.setAllowListStartTime(startTime);

		await network.provider.send("evm_mine", [now]);
	}

	async startPublicPhase() {
		// Set start time to 1 second ago
		const now = Date.now();

		const startTime = BigNumber.from(now - 1000);

		await this.mightyNetGPMinter.setPublicStartTime(startTime);

		await network.provider.send("evm_mine", [now]);
	}
}

export async function deployMightyNetGP(
	baseUri: string,
	contractUri: string,
	operatorFilterRegistryAddress: string,
	restrictedRegistryAddress: string
): Promise<MightyNetGenesisPass> {
	const contract = (await deployUpgradeable(
		"contracts/1337/MightyNetGenesisPass.sol:MightyNetGenesisPass",
		"initialize",
		baseUri,
		contractUri,
		operatorFilterRegistryAddress,
		restrictedRegistryAddress
	)) as MightyNetGenesisPass;

	return contract;
}

export async function deployMightyNetGPMinter(
	mightyNetGPAddress: string
): Promise<MightyNetGenesisPassMinter> {
	return await deployUpgradeable(
		"MightyNetGenesisPassMinter",
		"initialize",
		mightyNetGPAddress
	);
}
