/*
 * Copyright (c) 2023 Mighty Bear Games
 */

import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import {
	MightyNetERC721TokenIdDecoder
} from "../../typechain";
import {
	setTransparentUpgradeableProxyAdmin,
} from "./utils/testHelper";
import { deployUpgradeable } from "./utils/deploy";
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("MightyNet ERC721 TokenIdDecoder", () => {
	let mnDecoder: MightyNetERC721TokenIdDecoder;

	let owner: SignerWithAddress,
		player1: SignerWithAddress,
		proxyUpgradeAdmin: SignerWithAddress;

	let originalProxyAdminAddress: string;

	async function deployTestFixture() {
		const [
			owner,
			player1,
			proxyUpgradeAdmin
		] = await ethers.getSigners();

		const mnDecoder = (await deployUpgradeable(
			"MightyNetERC721TokenIdDecoder",
			"initialize"
		)) as MightyNetERC721TokenIdDecoder;

		await mnDecoder.deployed();

		originalProxyAdminAddress = (await upgrades.admin.getInstance())
			.address;

		// Fixtures can return anything you consider useful for your tests
		return {
			ownerSigner: owner,
			player1Signer: player1,
			proxyUpgradeAdminSigner: proxyUpgradeAdmin,
			mightyNetDecoder: mnDecoder
		};
	}

	beforeEach(async () => {
		var {
			ownerSigner,
			player1Signer,
			proxyUpgradeAdminSigner,
			mightyNetDecoder
		} = await loadFixture(deployTestFixture);
		owner = ownerSigner;
		player1 = player1Signer;
		proxyUpgradeAdmin = proxyUpgradeAdminSigner;
		mnDecoder = mightyNetDecoder;
	});

	describe("Deployment", () => {
		it("initialize function negative check", async () => {
			await expect(mnDecoder.initialize()).to.be.revertedWith(
				"Initializable: contract is already initialized"
			);
		});
	});

	describe("Decoding", () => {
		const tokenId: number = 0b1111111111_111111111111_11111111_11111111_1111_11111;

		it("Anyone should be able to getVersion", async () => {
			expect(await mnDecoder
				.getVersion(tokenId)
			).to.equal(0b11111);

			expect(await mnDecoder
				.connect(player1)
				.getVersion(tokenId)
			).to.equal(0b11111);
		});

		it("Anyone should be able to getRarity", async () => {
			expect(await mnDecoder
				.getRarity(tokenId)
			).to.equal(0b1111);

			expect(await mnDecoder
				.connect(player1)
				.getRarity(tokenId)
			).to.equal(0b1111);
		});

		it("Anyone should be able to getGeneration", async () => {
			expect(await mnDecoder
				.getGeneration(tokenId)
			).to.equal(0b11111111);

			expect(await mnDecoder
				.connect(player1)
				.getGeneration(tokenId)
			).to.equal(0b11111111);
		});

		it("Anyone should be able to getType", async () => {
			expect(await mnDecoder
				.getType(tokenId)
			).to.equal(0b11111111);

			expect(await mnDecoder
				.connect(player1)
				.getType(tokenId)
			).to.equal(0b11111111);
		});

		it("Anyone should be able to getItemId", async () => {
			expect(await mnDecoder
				.getItemId(tokenId)
			).to.equal(0b111111111111);

			expect(await mnDecoder
				.connect(player1)
				.getItemId(tokenId)
			).to.equal(0b111111111111);
		});

		it("Anyone should be able to getUniqueTokenId", async () => {
			expect(await mnDecoder
				.getUniqueTokenId(tokenId)
			).to.equal(0b1111111111);

			expect(await mnDecoder
				.connect(player1)
				.getUniqueTokenId(tokenId)
			).to.equal(0b1111111111);
		});

		const tokenId2: number = 0b1_011100110011_01111110_11011110_1001_01011;

		it("More indepth testing of each function getUniqueTokenId", async () => {
			expect(await mnDecoder
				.getVersion(tokenId2)
			).to.equal(0b01011);

			expect(await mnDecoder
				.getRarity(tokenId2)
			).to.equal(0b1001);

			expect(await mnDecoder
				.getGeneration(tokenId2)
			).to.equal(0b11011110);

			expect(await mnDecoder
				.getType(tokenId2)
			).to.equal(0b01111110);

			expect(await mnDecoder
				.getItemId(tokenId2)
			).to.equal(0b011100110011);

			expect(await mnDecoder
				.getUniqueTokenId(tokenId2)
			).to.equal(0b1);
		});
	});

	describe("Upgrade", () => {
		let mndUpgrade: MightyNetERC721TokenIdDecoder;

		beforeEach(async () => {
			setTransparentUpgradeableProxyAdmin(
				mnDecoder.address,
				proxyUpgradeAdmin,
				originalProxyAdminAddress
			);

			// Upgrade contract to MightyActionHeroGadgets Upgradeable V2
			let factory = await ethers.getContractFactory("MightyNetERC721TokenIdDecoder");

			const contract = await upgrades.upgradeProxy(
				mnDecoder.address,
				factory
			);

			mndUpgrade = factory.attach(contract.address);
		});

		it("should upgrade successfully", async () => {
			expect(mndUpgrade).to.not.be.undefined;
		});
	});
});
