/*
 * Copyright (c) 2022 Mighty Bear Games
 */

import { ethers, upgrades } from "hardhat";
import { deployBbs } from "../../../test/nft/utils/bbsMinterTestHelper";
import { BigNumber } from "ethers";
import { exportGas } from "../utils";
import {
	deployOperatorFilterRegistry,
	getBlockNumber,
	mineBlocks,
	setBlockNumber,
} from "../../../test/nft/utils/testHelper";
import { deployUpgradeable } from "../../../test/nft/utils/deploy";
import {
	MightyNetERC721RestrictedRegistry,
	MightyNetLocking,
} from "../../../typechain";

async function main() {
	const [owner, minter, restrictor] = await ethers.getSigners();

	const pfpBaseUri = "https://mighty.net/api/pfp/";
	const pfpContractUri = "https://mighty.net/api/pfp";

	const operatorFilterRegistry = await deployOperatorFilterRegistry();
	const restrictedRegistry: MightyNetERC721RestrictedRegistry =
		await deployUpgradeable(
			"MightyNetERC721RestrictedRegistry",
			"initialize"
		);

	await restrictedRegistry.grantRole(
		await restrictedRegistry.RESTRICTOR_ROLE(),
		restrictor.address
	);

	// Deploy BigBearSyndicate contract
	const bbs = await deployBbs(
		pfpBaseUri,
		pfpContractUri,
		operatorFilterRegistry.address,
		restrictedRegistry.address
	);

	await bbs.deployed();
	await bbs.setMinter(minter.address);

	const mightyNetLockingFactory = await ethers.getContractFactory(
		"MightyNetLocking"
	);

	const mightyNetLocking = await upgrades.deployProxy(
		mightyNetLockingFactory,
		[restrictedRegistry.address],
		{
			initializer: "initialize",
		}
	);
	await mightyNetLocking.deployed();

	await restrictedRegistry.grantRole(
		await restrictedRegistry.RESTRICTOR_ROLE(),
		mightyNetLocking.address
	);

	const record: Record<string, BigNumber> = {};
	record["deploy"] = mightyNetLocking.deployTransaction.gasLimit;

	record["setBlocksPerDay"] = await mightyNetLocking
		.connect(owner)
		.estimateGas.setSecondsPerBlock(1);
	await mightyNetLocking.connect(owner).setSecondsPerBlock(1);

	record["setTokenContract"] = await mightyNetLocking
		.connect(owner)
		.estimateGas.setTokenContract(bbs.address, 10000);
	await mightyNetLocking.connect(owner).setTokenContract(bbs.address, 10000);

	const lockDuration = 60;

	record["setTimeBoost"] = await mightyNetLocking
		.connect(owner)
		.estimateGas.setTimeBoost(lockDuration, 120000);
	await mightyNetLocking.connect(owner).setTimeBoost(lockDuration, 120000);

	const batchCount = 20;

	let currentTokenId = 1;

	for (let i = 0; i < batchCount; ++i) {
		await bbs.connect(minter).mint(owner.address, currentTokenId++);
	}

	const lockGas = await mightyNetLocking
		.connect(owner)
		.estimateGas.lock([1], bbs.address, lockDuration);

	record["lock a token"] = lockGas;

	await mightyNetLocking.connect(owner).lock([1], bbs.address, lockDuration);

	let lockedEndBlockNumber = (await getBlockNumber()) + lockDuration;

	await setBlockNumber(lockedEndBlockNumber);

	const unlockGas = await mightyNetLocking
		.connect(owner)
		.estimateGas.unlock([1], bbs.address);

	record["unlock a token"] = unlockGas;

	await mightyNetLocking.connect(owner).unlock([1], bbs.address);

	let tokens = [];

	for (let i = 1; i <= batchCount; ++i) {
		tokens.push(i);
	}

	record["setLockLimit"] = await mightyNetLocking
		.connect(owner)
		.estimateGas.setLockLimit(batchCount);
	await mightyNetLocking.connect(owner).setLockLimit(batchCount);

	const batchLockGas = await mightyNetLocking
		.connect(owner)
		.estimateGas.lock(tokens, bbs.address, lockDuration);

	record[`lock ${batchCount} tokens`] = batchLockGas;

	await mightyNetLocking
		.connect(owner)
		.lock(tokens, bbs.address, lockDuration);

	lockedEndBlockNumber = (await getBlockNumber()) + lockDuration;

	await setBlockNumber(lockedEndBlockNumber);

	const batchUnlockGas = await mightyNetLocking
		.connect(owner)
		.estimateGas.unlock(tokens, bbs.address);

	record[`unlock ${batchCount} tokens`] = batchUnlockGas;

	record[`unlock last token in ${batchCount} tokens`] = await mightyNetLocking
		.connect(owner)
		.estimateGas.unlock([tokens[tokens.length - 1]], bbs.address);

	record[`lock ${batchCount} to 1 ratio`] = ethers.utils.parseEther(
		batchLockGas.div(lockGas).toString()
	);

	record[`unlock ${batchCount} to 1 ratio`] = ethers.utils.parseEther(
		batchUnlockGas.div(unlockGas).toString()
	);

	exportGas(record, "MightyNetLocking");
}

main();
