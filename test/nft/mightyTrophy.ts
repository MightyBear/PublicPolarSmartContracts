/*
 * Copyright (c) 2022 Mighty Bear Games
 */

import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { BytesLike } from "ethers";
import { ethers, upgrades } from "hardhat";
import { MightyTrophy } from "../../typechain";
import { deployMightyTrophy } from "./utils/mightyTrophyTestHelper";
import {
	setProxyAdmin,
	setTransparentUpgradeableProxyAdmin,
} from "./utils/testHelper";
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("Mighty Trophy", () => {
	const baseUri = "https://dev.cdn.mightynet.xyz/mtt/metadata/";
	const contractUri = "https://dev.cdn.mightynet.xyz/mtt/metadata/contract";
	let mightyTrophy: MightyTrophy;

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

		const mightyTrophy = await deployMightyTrophy(baseUri, contractUri);
		adminRole = await mightyTrophy.DEFAULT_ADMIN_ROLE();

		originalProxyAdminAddress = (await upgrades.admin.getInstance())
			.address;

		setProxyAdmin(
			originalProxyAdminAddress,
			owner,
			mightyTrophy.address,
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
			mightyTrophyContract: mightyTrophy,
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
			mightyTrophyContract,
		} = await loadFixture(deployTestFixture);
		owner = ownerSigner;
		minter = minterSigner;
		user1 = user1Signer;
		user2 = user2Signer;
		operator = operatorSigner;
		proxyUpgradeAdmin = proxyUpgradeAdminSigner;
		mightyTrophy = mightyTrophyContract;
	});

	describe("Deployment", () => {
		it("should be owned by deployer", async () => {
			expect(await mightyTrophy.owner()).to.be.equal(owner.address);
		});
		it("should have correct baseURI", async () => {
			expect(await mightyTrophy.baseURI()).to.be.equal(baseUri);
		});

		it("should have correct contractURI", async () => {
			expect(await mightyTrophy.contractURI()).to.be.equal(contractUri);
		});
		it("minter should be set to deployer", async () => {
			expect(await mightyTrophy.minter()).to.be.equal(owner.address);
		});
		it("should be unpaused", async () => {
			expect(await mightyTrophy.paused()).to.be.false;
		});

		it("should mint token id 0 during initialization", async () => {
			expect(await mightyTrophy.exists(0)).to.be.true;
		});
	});

	describe("Administration", () => {
		it("should pause and unpause contract", async () => {
			await mightyTrophy.pause();

			expect(await mightyTrophy.paused()).to.be.true;

			await mightyTrophy.unpause();

			expect(await mightyTrophy.paused()).to.be.false;
		});

		it("only admins should be able to pause and unpause", async () => {
			await expect(mightyTrophy.connect(user1).pause()).to.be.reverted;

			await mightyTrophy.pause();

			await expect(mightyTrophy.connect(user1).unpause()).to.be.reverted;
		});

		it("should grant admin role", async () => {
			await mightyTrophy.grantRole(adminRole, user1.address);

			expect(await mightyTrophy.hasRole(adminRole, user1.address)).to.be
				.true;
		});

		it("only admins should be able to grant roles", async () => {
			await expect(
				mightyTrophy.connect(user1).grantRole(adminRole, user1.address)
			).to.be.reverted;
		});

		it("should set minter address", async () => {
			await mightyTrophy.setMinter(minter.address);

			expect(await mightyTrophy.minter()).to.be.equal(minter.address);
		});

		it("only admins should be able to set minter address", async () => {
			await expect(mightyTrophy.connect(user1).setMinter(minter.address))
				.to.be.reverted;

			// Minter should still be zero address
			expect(await mightyTrophy.minter()).to.be.equal(owner.address);
		});

		it("should transfer ownership", async () => {
			await mightyTrophy.transferOwnership(user1.address);

			expect(await mightyTrophy.owner()).to.be.equal(user1.address);
		});

		it("only owner should be able to transfer ownership", async () => {
			await expect(
				mightyTrophy.connect(user1).transferOwnership(user1.address)
			).to.be.revertedWith("Ownable: caller is not the owner");

			// Contract should still be owned by the original owner
			expect(await mightyTrophy.owner()).to.be.equal(owner.address);
		});
	});

	describe("Minting", () => {
		beforeEach(async () => {
			mightyTrophy.setMinter(minter.address);
		});

		it("should mint MightyTrophy for user", async () => {
			const tokenId = 1;
			await mightyTrophy
				.connect(minter)
				.batchMint([user1.address], [tokenId]);
			expect(await mightyTrophy.exists(tokenId)).to.be.true;
			expect(await mightyTrophy.ownerOf(tokenId)).to.be.equal(
				user1.address
			);
		});

		it("only minter should be able to mint", async () => {
			const tokenId = 1;

			await expect(
				mightyTrophy.batchMint([user1.address], [tokenId])
			).to.be.revertedWith("Unauthorized()");

			await mightyTrophy
				.connect(minter)
				.batchMint([user1.address], [tokenId]);
		});

		it("should revert mint when paused", async () => {
			await mightyTrophy.pause();

			const tokenId = 1;

			await expect(
				mightyTrophy
					.connect(minter)
					.batchMint([user1.address], [tokenId])
			).to.be.revertedWith("Pausable: paused");

			await mightyTrophy.unpause();

			await mightyTrophy
				.connect(minter)
				.batchMint([user1.address], [tokenId]);
		});

		it("should be able to batch mint with correct running Id", async () => {
			const tokenId1 = 1;
			const tokenId2 = 2;
			await mightyTrophy
				.connect(minter)
				.batchMint(
					[user1.address, user2.address],
					[tokenId1, tokenId2]
				);
			expect(await mightyTrophy.exists(tokenId1)).to.be.true;
			expect(await mightyTrophy.ownerOf(tokenId1)).to.be.equal(
				user1.address
			);
			expect(await mightyTrophy.exists(tokenId2)).to.be.true;
			expect(await mightyTrophy.ownerOf(tokenId2)).to.be.equal(
				user2.address
			);
		});

		it("should revert if id is wrong", async () => {
			const tokenId1 = 1;
			const tokenId2 = 3;

			await expect(
				mightyTrophy
					.connect(minter)
					.batchMint(
						[user1.address, user2.address],
						[tokenId1, tokenId2]
					)
			).to.be.revertedWith("WrongId()");

			expect(await mightyTrophy.exists(tokenId1)).to.be.false;
		});
	});

	describe("Burning", () => {
		beforeEach(async () => {
			mightyTrophy.setMinter(minter.address);
		});

		it("should burn MightyTrophy", async () => {
			const tokenId = 1;

			await mightyTrophy
				.connect(minter)
				.batchMint([user1.address], [tokenId]);

			// MightyTrophy should be owned by player 1
			expect(await mightyTrophy.ownerOf(tokenId)).to.be.equal(
				user1.address
			);

			await mightyTrophy.connect(user1).burn(tokenId);

			// MightyTrophy should be owned by nobody
			expect(await mightyTrophy.exists(tokenId)).to.be.false;
		});

		it("only owners of the tokens should be able to burn their own MightyTrophy", async () => {
			const tokenId = 1;

			await mightyTrophy
				.connect(minter)
				.batchMint([user1.address], [tokenId]);

			await expect(mightyTrophy.burn(tokenId)).to.be.revertedWith(
				"ERC721: caller is not token owner"
			);

			// MightyTrophy should still exist
			expect(await mightyTrophy.exists(tokenId)).to.be.true;
			// MightyTrophy should still be owned by player 1
			expect(await mightyTrophy.ownerOf(tokenId)).to.be.equal(
				user1.address
			);
		});
	});

	describe("Transfers", () => {
		beforeEach(async () => {
			mightyTrophy.setMinter(minter.address);
		});

		it("should revert when try to set approval for all", async () => {
			const tokenId = 1;

			await mightyTrophy
				.connect(minter)
				.batchMint([user1.address], [tokenId]);

			// MightyTrophy should still be owned by player 1
			expect(await mightyTrophy.ownerOf(tokenId)).to.be.equal(
				user1.address
			);

			// Should revert when attempting to approve
			await expect(
				mightyTrophy
					.connect(user1)
					.setApprovalForAll(operator.address, true)
			).to.be.revertedWith(`NonTransferrable()`);
		});

		it("should revert when try to transfer MightyTrophy", async () => {
			const tokenId = 1;

			await mightyTrophy
				.connect(minter)
				.batchMint([user1.address], [tokenId]);

			// MightyTrophy should still be owned by player 1
			expect(await mightyTrophy.ownerOf(tokenId)).to.be.equal(
				user1.address
			);

			await expect(
				mightyTrophy
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
			mightyTrophy.setMinter(minter.address);
		});

		it("should return owner of MightyTrophy", async () => {
			await mightyTrophy.connect(minter).batchMint([user1.address], [1]);

			expect(await mightyTrophy.ownerOf(1)).to.be.equal(user1.address);
		});
	});

	describe("Upgrade", () => {
		let mightyTrophyUpgrade: MightyTrophy;

		let tokenId = 1;

		beforeEach(async () => {
			setTransparentUpgradeableProxyAdmin(
				mightyTrophy.address,
				proxyUpgradeAdmin,
				originalProxyAdminAddress
			);

			mightyTrophy.setMinter(minter.address);

			await mightyTrophy
				.connect(minter)
				.batchMint([user1.address], [tokenId]);

			// Upgrade contract to MightyTrophy Upgradeable V2
			let factory = await ethers.getContractFactory("MightyTrophy");

			const contract = await upgrades.upgradeProxy(
				mightyTrophy.address,
				factory
			);

			mightyTrophyUpgrade = factory.attach(contract.address);
		});

		it("should upgrade successfully", async () => {
			expect(mightyTrophyUpgrade).to.not.be.undefined;
		});

		it("should carry over state", async () => {
			// Base and contract URI should be carried over
			expect(await mightyTrophyUpgrade.baseURI()).to.be.equal(baseUri);
			expect(await mightyTrophyUpgrade.contractURI()).to.be.equal(
				contractUri
			);

			// Minter should be carried over
			expect(await mightyTrophyUpgrade.minter()).to.be.equal(
				minter.address
			);

			// Token ownership should be carried over
			expect(await mightyTrophyUpgrade.ownerOf(tokenId)).to.be.equal(
				user1.address
			);
		});

		it("should not mint admin token again", async () => {
			expect(await mightyTrophy.exists(tokenId)).to.be.true;
			expect(await mightyTrophy.exists(tokenId + 1)).to.be.false;
		});

		it("should set minter address", async () => {
			const token2Id = 2;
			await mightyTrophy.setMinter(user1.address);

			expect(await mightyTrophy.minter()).to.be.equal(user1.address);

			await expect(
				mightyTrophy
					.connect(minter)
					.batchMint([user1.address], [token2Id])
			).to.be.revertedWith("Unauthorized()");

			await mightyTrophy
				.connect(user1)
				.batchMint([user1.address], [token2Id]);

			expect(await mightyTrophy.exists(token2Id)).to.be.true;
			expect(await mightyTrophy.ownerOf(token2Id)).to.be.equal(
				user1.address
			);
		});
	});
});
