/*
 * Copyright (c) 2022 Mighty Bear Games
 */

import { BigNumber } from "ethers";
import { keccak256 } from "ethers/lib/utils";
import { network } from "hardhat";
import { BigBearSyndicate, BigBearSyndicateMinter } from "../../../typechain";
import { deployUpgradeable } from "./deploy";
import { buildMerkleTree } from "./testHelper";

export class BigBearSyndicateMinterTestHelper {
	constructor(public bbsMinter: BigBearSyndicateMinter) {}

	async readyAllowListMint(
		address: string,
		startPhase = true,
		supply: number | undefined = undefined
	): Promise<string[]> {
		// Set supply if necessary
		if (supply != undefined) await this.bbsMinter.setSupplyLimit(supply);

		const merkleTree = await buildMerkleTree(address);

		// Set contract Merkle root hash
		const rootHash = merkleTree.getRoot();

		await this.bbsMinter.setAllowListMerkleRoot(rootHash);

		// Get proof for address
		const hexProof = merkleTree.getHexProof(keccak256(address));

		if (startPhase) {
			await this.startAllowListPhase();
		}

		return hexProof;
	}

	async readyPaidMints(
		address: string,
		mints: number,
		startPhase = true,
		supply: number | undefined = undefined
	): Promise<string[]> {
		// allowlist mint but with higher mint limit
		// Set supply if necessary
		if (supply != undefined) await this.bbsMinter.setSupplyLimit(supply);

		const merkleTree = await buildMerkleTree(address);

		// Set contract Merkle root hash
		const rootHash = merkleTree.getRoot();

		await this.bbsMinter.setAllowListMerkleRoot(rootHash);

		// Get proof for address
		const hexProof = merkleTree.getHexProof(keccak256(address));

		await this.bbsMinter.setPaidMints(address, mints);

		if (startPhase) {
			await this.startAllowListPhase();
		}

		return hexProof;
	}

	async readyFreeMint(
		address: string,
		mints: number,
		startPhase = true,
		supply: number | undefined = undefined
	): Promise<void> {
		// Set supply if necessary
		if (supply != undefined) await this.bbsMinter.setSupplyLimit(supply);

		await this.bbsMinter.setFreeMintClaims(address, mints);

		if (startPhase) {
			await this.startFreeMintPhase();
		}
	}

	async startFreeMintPhase() {
		// Set start time to 1 second ago
		const now = Date.now();

		const startTime = BigNumber.from(now - 1000);

		await this.bbsMinter.setFreeMintStartTime(startTime);

		await network.provider.send("evm_mine", [now]);
	}

	async startAllowListPhase() {
		// Set start time to 1 second ago
		const now = Date.now();

		const startTime = BigNumber.from(now - 1000);

		await this.bbsMinter.setAllowListStartTime(startTime);

		await network.provider.send("evm_mine", [now]);
	}

	async startPublicPhase() {
		// Set start time to 1 second ago
		const now = Date.now();

		const startTime = BigNumber.from(now - 1000);

		await this.bbsMinter.setPublicStartTime(startTime);

		await network.provider.send("evm_mine", [now]);
	}
}

export async function deployBbs(
	baseUri: string,
	contractUri: string,
	operatorFilterRegistryAddress: string,
	restrictedRegistryAddress: string
): Promise<BigBearSyndicate> {
	return await deployUpgradeable(
		"BigBearSyndicate",
		"initialize",
		baseUri,
		contractUri,
		operatorFilterRegistryAddress,
		restrictedRegistryAddress
	);
}

export async function deployBbsMinter(
	bbsAddress: string
): Promise<BigBearSyndicateMinter> {
	return await deployUpgradeable(
		"BigBearSyndicateMinter",
		"initialize",
		bbsAddress
	);
}
