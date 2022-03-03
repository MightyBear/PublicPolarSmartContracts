/*
 * Copyright (c) 2022 Mighty Bear Games
 */

import { BigNumber } from "ethers";
import { ethers, upgrades } from "hardhat";
import {
	buildMerkleTree,
	deployBbs,
	BigBearSyndicateMinterTestHelper,
} from "../../../test/nft/utils/bbsMinterTestHelper";
import { BigBearSyndicateMinter } from "../../../typechain";
import { exportGas } from "../utils";

const pfpBaseUri = "https://mighty.net/api/pfp/";
const pfpContractUri = "https://mighty.net/api/pfp";

async function main() {
	const methodGas: Record<string, BigNumber> = {};

	const [owner, minter, player1, player2] = await ethers.getSigners();

	const bbs = await deployBbs(pfpBaseUri, pfpContractUri);

	let bbsMinterFactory = await ethers.getContractFactory(
		"BigBearSyndicateMinter"
	);

	// ------------------------------
	// 			 Deployment
	// ------------------------------
	const bbsMinter = await upgrades.deployProxy(
		bbsMinterFactory,
		[bbs.address],
		{
			initializer: "initialize",
		}
	);

	await bbs.deployed();

	methodGas["Proxy Deployment"] = bbsMinter.deployTransaction.gasLimit;

	await bbs.setMinter(bbsMinter.address);

	// ------------------------------
	// 			  Minting
	// ------------------------------
	const bbsMinterTestHelper = new BigBearSyndicateMinterTestHelper(
		bbsMinter as BigBearSyndicateMinter
	);

	const setFreeMintRanges = [1, 2, 10, 50, 100];

	const wallets = await ethers.getSigners();

	for (const range of setFreeMintRanges) {
		const addresses = wallets.slice(0, range).map(x => x.address);

		methodGas[`Set ${addresses.length} free mint`] =
			await bbsMinter.estimateGas.setFreeMintClaims(addresses);
	}

	await bbsMinterTestHelper.readyFreeMint(player1.address);

	methodGas["Free mint token"] = await bbsMinter
		.connect(player1)
		.estimateGas.freeMint();

	const price = await bbsMinter.price();

	// Paid minting
	const mintToNumAddresses: Record<number, number> = {
		1: 13,
		2: 14,
		3: 12,
		5: 21,
		10: 9,
		20: 4,
		30: 2,
		50: 3,
		75: 2,
		125: 1,
		250: 1,
	};

	for (const mint in mintToNumAddresses) {
		const numAddresses = mintToNumAddresses[mint];

		let totalGas = BigNumber.from(0);

		for (let i = 0; i < numAddresses; i++) {
			// Addresses returned by hardhat by default is 20. If we need more than that, just reuse the same addresses from the start.
			const address =
				i < 20 ? wallets[i].address : wallets[i - 20].address;

			totalGas = totalGas.add(
				await bbsMinter.estimateGas.setPaidMints(address, mint)
			);
		}

		methodGas[`Set paid mint for ${numAddresses} addresses`] = totalGas;
	}

	const paidMintRanges = [1, 2, 5, 10, 20];

	for (const range of paidMintRanges) {
		await bbsMinter.setPaidMints(player1.address, range);

		const mintPrice = price.mul(range);

		methodGas[`Paid mint ${range} tokens`] = await bbsMinter
			.connect(player1)
			.estimateGas.paidMint(range, {
				value: mintPrice,
			});
	}

	// Allow list minting
	const hexProof = await bbsMinterTestHelper.readyAllowListMint(
		player1.address
	);

	methodGas["Allow list mint 1 token"] = await bbsMinter
		.connect(player1)
		.estimateGas.allowListMint(1, hexProof, {
			value: price,
		});

	methodGas["Allow list mint 2 token"] = await bbsMinter
		.connect(player1)
		.estimateGas.allowListMint(2, hexProof, {
			value: price.mul(2),
		});

	// Public sale minting
	await bbsMinterTestHelper.startPublicPhase();

	for (const range of paidMintRanges) {
		const mintPrice = price.mul(range);

		methodGas[`Public sale mint ${range} token`] = await bbsMinter
			.connect(player1)
			.estimateGas.publicMint(range, {
				value: mintPrice,
			});
	}

	// ------------------------------
	// 			  Pausing
	// ------------------------------
	methodGas["Pause"] = await bbsMinter.estimateGas.pause();

	// Pause contract to unpause
	await bbsMinter.pause();

	methodGas["Unpause"] = await bbsMinter.estimateGas.unpause();

	await bbsMinter.unpause();

	// ------------------------------
	// 			  Setters
	// ------------------------------
	const startTime = BigNumber.from(Date.now());
	methodGas["Set phase times"] = await bbsMinter.estimateGas.setPhaseTimes(
		startTime,
		startTime
	);
	methodGas["Set allow list start time"] =
		await bbsMinter.estimateGas.setAllowListStartTime(startTime);
	methodGas["Set public start time"] =
		await bbsMinter.estimateGas.setPublicStartTime(startTime);
	methodGas["Set vault address"] =
		await bbsMinter.estimateGas.setVaultAddress(player1.address);
	methodGas["Set price"] = await bbsMinter.estimateGas.setPrice(
		ethers.utils.parseEther("1")
	);
	methodGas["Set allow list mints"] =
		await bbsMinter.estimateGas.setAllowListMints(3);

	const merkleTree = await buildMerkleTree(player1.address);

	const rootHash = merkleTree.getRoot();

	methodGas["Set allow list merkle root"] =
		await bbsMinter.estimateGas.setAllowListMerkleRoot(rootHash);

	// ------------------------------
	// 			  Withdrawal
	// ------------------------------
	await bbsMinter.connect(player1).publicMint(1, {
		value: price,
	});

	const amount = price.div(2);

	methodGas["Withdraw"] = await bbsMinter.estimateGas.withdraw(amount);
	methodGas["Withdraw all"] = await bbsMinter.estimateGas.withdrawAll();

	await exportGas(methodGas, "BigBearSyndicateMinter");
}

main();
