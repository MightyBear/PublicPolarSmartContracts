/*
 * Copyright (c) 2022 Mighty Bear Games
 */

import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { BytesLike } from "ethers";
import { ethers, upgrades } from "hardhat";
import { BigBearKey as BigBearKey } from "../../typechain";
import { deployBigBearKey } from "./utils/bigBearKeyTestHelper";
import {
	setProxyAdmin,
	setTransparentUpgradeableProxyAdmin,
} from "./utils/testHelper";
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("Big Bear Key", () => {
	let baseUri = "https://dev.cdn.mightynet.xyz/bbkey/metadata";
	let contractUri = "https://dev.cdn.mightynet.xyz/bbkey/metadata/contract";
	let bigBearKey: BigBearKey;

	let owner: SignerWithAddress,
		minter: SignerWithAddress,
		user1: SignerWithAddress,
		user2: SignerWithAddress,
		operator: SignerWithAddress,
		proxyUpgradeAdmin: SignerWithAddress;

	let originalProxyAdminAddress: string;

	let adminRole: BytesLike;

	async function deployTestFixture() {
		const [owner, minter, user1, user2, operator, proxyUpgradeAdmin] =
			await ethers.getSigners();

		const bigBearKey = await deployBigBearKey(baseUri, contractUri);
		adminRole = await bigBearKey.DEFAULT_ADMIN_ROLE();

		originalProxyAdminAddress = (await upgrades.admin.getInstance())
			.address;

		setProxyAdmin(
			originalProxyAdminAddress,
			owner,
			bigBearKey.address,
			proxyUpgradeAdmin.address
		);

		// Fixtures can return anything you consider useful for your tests
		return {
			ownerSigner: owner,
			minterSigner: minter,
			user1Signer: user1,
			user2Signer: user2,
			operatorSigner: operator,
			proxyUpgradeAdminSigner: proxyUpgradeAdmin,
			bigBearKeyContract: bigBearKey,
		};
	}

	beforeEach(async () => {
		var {
			ownerSigner,
			minterSigner,
			user1Signer,
			user2Signer,
			operatorSigner,
			proxyUpgradeAdminSigner,
			bigBearKeyContract,
		} = await loadFixture(deployTestFixture);
		owner = ownerSigner;
		minter = minterSigner;
		user1 = user1Signer;
		user2 = user2Signer;
		operator = operatorSigner;
		proxyUpgradeAdmin = proxyUpgradeAdminSigner;
		bigBearKey = bigBearKeyContract;
	});

	describe("Deployment", () => {
		it("should be owned by deployer", async () => {
			expect(await bigBearKey.owner()).to.be.equal(owner.address);
		});
		it("should have correct baseURI", async () => {
			expect(await bigBearKey.baseURI()).to.be.equal(baseUri);
		});

		it("should have correct contractURI", async () => {
			expect(await bigBearKey.contractURI()).to.be.equal(contractUri);
		});
		it("minter should be set to deployer", async () => {
			expect(await bigBearKey.minter()).to.be.equal(owner.address);
		});
		it("should be unpaused", async () => {
			expect(await bigBearKey.paused()).to.be.false;
		});
	});

	describe("Administration", () => {
		it("should pause and unpause contract", async () => {
			await bigBearKey.pause();

			expect(await bigBearKey.paused()).to.be.true;

			await bigBearKey.unpause();

			expect(await bigBearKey.paused()).to.be.false;
		});

		it("only admins should be able to pause and unpause", async () => {
			await expect(bigBearKey.connect(user1).pause()).to.be.reverted;

			await bigBearKey.pause();

			await expect(bigBearKey.connect(user1).unpause()).to.be.reverted;
		});

		it("should grant admin role", async () => {
			await bigBearKey.grantRole(adminRole, user1.address);

			expect(await bigBearKey.hasRole(adminRole, user1.address)).to.be
				.true;
		});

		it("only admins should be able to grant roles", async () => {
			await expect(
				bigBearKey.connect(user1).grantRole(adminRole, user1.address)
			).to.be.reverted;
		});

		it("should set minter address", async () => {
			await bigBearKey.setMinter(minter.address);

			expect(await bigBearKey.minter()).to.be.equal(minter.address);
		});

		it("only admins should be able to set minter address", async () => {
			await expect(bigBearKey.connect(user1).setMinter(minter.address)).to
				.be.reverted;

			// Minter should still be zero address
			expect(await bigBearKey.minter()).to.be.equal(owner.address);
		});

		it("should transfer ownership", async () => {
			await bigBearKey.transferOwnership(user1.address);

			expect(await bigBearKey.owner()).to.be.equal(user1.address);
		});

		it("only owner should be able to transfer ownership", async () => {
			await expect(
				bigBearKey.connect(user1).transferOwnership(user1.address)
			).to.be.revertedWith("Ownable: caller is not the owner");

			// Contract should still be owned by the original owner
			expect(await bigBearKey.owner()).to.be.equal(owner.address);
		});
	});

	describe("Minting", () => {
		beforeEach(async () => {
			bigBearKey.setMinter(minter.address);
		});

		it("should mint BigBearKey for user", async () => {
			const tokenId = 0;
			await bigBearKey.connect(minter).mint(user1.address);
			expect(await bigBearKey.exists(tokenId)).to.be.true;
			expect(await bigBearKey.ownerOf(tokenId)).to.be.equal(
				user1.address
			);
		});

		it("only minter should be able to mint", async () => {
			const tokenId = 0;

			await expect(bigBearKey.mint(user1.address)).to.be.revertedWith(
				"Unauthorized()"
			);

			await bigBearKey.connect(minter).mint(user1.address);
		});

		it("should revert mint when paused", async () => {
			await bigBearKey.pause();

			const tokenId = 0;

			await expect(
				bigBearKey.connect(minter).mint(user1.address)
			).to.be.revertedWith("Pausable: paused");

			await bigBearKey.unpause();

			await bigBearKey.connect(minter).mint(user1.address);
		});
	});

	describe("Burning", () => {
		beforeEach(async () => {
			bigBearKey.setMinter(minter.address);
		});

		it("should burn BigBearKey", async () => {
			const tokenId = 0;

			await bigBearKey.connect(minter).mint(user1.address);

			// BigBearKey should be owned by player 1
			expect(await bigBearKey.ownerOf(tokenId)).to.be.equal(
				user1.address
			);

			await bigBearKey.connect(user1).burn(tokenId);

			// BigBearKey should be owned by nobody
			expect(await bigBearKey.exists(tokenId)).to.be.false;
		});

		it("only admins should be able to burn the BigBearKey", async () => {
			const tokenId = 0;

			await bigBearKey.connect(minter).mint(user1.address);

			await expect(bigBearKey.burn(tokenId)).to.be.revertedWith(
				"ERC721: caller is not token owner"
			);

			// BigBearKey should still exist
			expect(await bigBearKey.exists(tokenId)).to.be.true;
			// BigBearKey should still be owned by player 1
			expect(await bigBearKey.ownerOf(tokenId)).to.be.equal(
				user1.address
			);
		});
	});

	describe("Transfers", () => {
		beforeEach(async () => {
			bigBearKey.setMinter(minter.address);
		});

		it("should revert when try to set approval for all", async () => {
			const tokenId = 0;

			await bigBearKey.connect(minter).mint(user1.address);

			// BigBearKey should still be owned by player 1
			expect(await bigBearKey.ownerOf(tokenId)).to.be.equal(
				user1.address
			);

			// Should revert when attempting to approve
			await expect(
				bigBearKey
					.connect(user1)
					.setApprovalForAll(operator.address, true)
			).to.be.revertedWith(`NonTransferrable()`);
		});

		it("should revert when try to transfer BigBearKey", async () => {
			const tokenId = 0;

			await bigBearKey.connect(minter).mint(user1.address);

			// BigBearKey should still be owned by player 1
			expect(await bigBearKey.ownerOf(tokenId)).to.be.equal(
				user1.address
			);

			await expect(
				bigBearKey
					.connect(user1)
					["safeTransferFrom(address,address,uint256)"](
						user1.address,
						user2.address,
						tokenId
					)
			).to.be.revertedWith(`NonTransferrable()`);
		});
	});

	describe("Queries", () => {
		beforeEach(async () => {
			bigBearKey.setMinter(minter.address);
		});

		it("should return owner of BigBearKey", async () => {
			await bigBearKey.connect(minter).mint(user1.address);

			expect(await bigBearKey.ownerOf(0)).to.be.equal(user1.address);
		});
	});

	describe("Upgrade", () => {
		let BigBearKeyUpgrade: BigBearKey;

		let tokenId = 0;

		beforeEach(async () => {
			setTransparentUpgradeableProxyAdmin(
				bigBearKey.address,
				proxyUpgradeAdmin,
				originalProxyAdminAddress
			);

			bigBearKey.setMinter(minter.address);

			await bigBearKey.connect(minter).mint(user1.address);

			// Upgrade contract to BigBearKey Upgradeable V2
			let factory = await ethers.getContractFactory("BigBearKey");

			const contract = await upgrades.upgradeProxy(
				bigBearKey.address,
				factory
			);

			BigBearKeyUpgrade = factory.attach(contract.address);
		});

		it("should upgrade successfully", async () => {
			expect(BigBearKeyUpgrade).to.not.be.undefined;
		});

		it("should carry over state", async () => {
			// Base and contract URI should be carried over
			expect(await BigBearKeyUpgrade.baseURI()).to.be.equal(baseUri);
			expect(await BigBearKeyUpgrade.contractURI()).to.be.equal(
				contractUri
			);

			// Minter should be carried over
			expect(await BigBearKeyUpgrade.minter()).to.be.equal(
				minter.address
			);

			// Token ownership should be carried over
			expect(await BigBearKeyUpgrade.ownerOf(tokenId)).to.be.equal(
				user1.address
			);
		});

		it("should set minter address be able to mint", async () => {
			await bigBearKey.setMinter(minter.address);

			expect(await bigBearKey.minter()).to.be.equal(minter.address);

			const tokenId = 0;

			await expect(bigBearKey.mint(user1.address)).to.be.revertedWith(
				"Unauthorized()"
			);

			await bigBearKey.connect(minter).mint(user1.address);
		});
	});
});
