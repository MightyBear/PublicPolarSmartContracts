/*
 * Copyright (c) 2022 Mighty Bear Games
 */

import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { BytesLike } from "ethers";
import { ethers, upgrades } from "hardhat";
import {
	OperatorFilterRegistry,
	MightyNetERC721RestrictedRegistry,
} from "../../typechain";
import { BigBearSyndicate } from "../../typechain/BigBearSyndicate";
import { deployBbs } from "./utils/bbsMinterTestHelper";
import {
	deployOperatorFilterRegistry,
	setProxyAdmin,
	setTransparentUpgradeableProxyAdmin,
} from "./utils/testHelper";
import { deployUpgradeable } from "./utils/deploy";
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("Big Bear Syndicate", () => {
	const baseUri = "https://mightyverse.com/api/bbs/";
	const contractUri = "https://mightyverse.com/api/bbs";
	let bbs: BigBearSyndicate;

	let operatorFilterRegistry: OperatorFilterRegistry;

	let owner: SignerWithAddress,
		minter: SignerWithAddress,
		player1: SignerWithAddress,
		player2: SignerWithAddress,
		operator: SignerWithAddress,
		restrictor: SignerWithAddress,
		proxyUpgradeAdmin: SignerWithAddress;

	let originalProxyAdminAddress: string;

	let adminRole: BytesLike;

	let restrictedRegistry: MightyNetERC721RestrictedRegistry;

	async function deployTestFixture() {
		const [
			owner,
			minter,
			player1,
			player2,
			operator,
			restrictor,
			proxyUpgradeAdmin,
		] = await ethers.getSigners();

		const operatorFilterRegistry = await deployOperatorFilterRegistry();
		const restrictedRegistry = (await deployUpgradeable(
			"MightyNetERC721RestrictedRegistry",
			"initialize"
		)) as MightyNetERC721RestrictedRegistry;
		await restrictedRegistry.grantRole(
			await restrictedRegistry.RESTRICTOR_ROLE(),
			restrictor.address
		);
		// Deploy BigBearSyndicate contract
		const bbs = await deployBbs(
			baseUri,
			contractUri,
			operatorFilterRegistry.address,
			restrictedRegistry.address
		);
		adminRole = await bbs.DEFAULT_ADMIN_ROLE();

		originalProxyAdminAddress = (await upgrades.admin.getInstance())
			.address;

		setProxyAdmin(
			originalProxyAdminAddress,
			owner,
			bbs.address,
			proxyUpgradeAdmin.address
		);

		// Fixtures can return anything you consider useful for your tests
		return {
			ownerSigner: owner,
			minterSigner: minter,
			player1Signer: player1,
			player2Signer: player2,
			operatorSigner: operator,
			restrictorSigner: restrictor,
			proxyUpgradeAdminSigner: proxyUpgradeAdmin,
			operatorFilterRegis: operatorFilterRegistry,
			restrictedRegis: restrictedRegistry,
			bbsContract: bbs,
		};
	}

	beforeEach(async () => {
		var {
			ownerSigner,
			minterSigner,
			player1Signer,
			player2Signer,
			operatorSigner,
			restrictorSigner,
			proxyUpgradeAdminSigner,
			operatorFilterRegis,
			restrictedRegis,
			bbsContract,
		} = await loadFixture(deployTestFixture);
		owner = ownerSigner;
		minter = minterSigner;
		player1 = player1Signer;
		player2 = player2Signer;
		operator = operatorSigner;
		restrictor = restrictorSigner;
		proxyUpgradeAdmin = proxyUpgradeAdminSigner;
		operatorFilterRegistry = operatorFilterRegis;
		restrictedRegistry = restrictedRegis;
		bbs = bbsContract;
	});

	describe("Deployment", () => {
		it("should be owned by deployer", async () => {
			expect(await bbs.owner()).to.be.equal(owner.address);
		});

		it("should have correct baseURI", async () => {
			expect(await bbs.baseURI()).to.be.equal(baseUri);
		});

		it("should have correct contractURI", async () => {
			expect(await bbs.contractURI()).to.be.equal(contractUri);
		});

		it("should have no minter", async () => {
			expect(await bbs.minter()).to.be.equal(
				ethers.constants.AddressZero
			);
		});

		it("should have correct operator filter registry address", async () => {
			expect(await bbs.operatorFilterRegistry()).to.be.equal(
				operatorFilterRegistry.address
			);
		});

		it("should have default royalty", async () => {
			const price = ethers.utils.parseEther("1");

			const royaltyInfo = await bbs.royaltyInfo(1, price);

			expect(royaltyInfo[0]).to.be.equal(owner.address);
			expect(royaltyInfo[1]).to.be.equal(
				ethers.utils.parseEther("0.075")
			);
		});

		it("should be unpaused", async () => {
			expect(await bbs.paused()).to.be.false;
		});
	});

	describe("Administration", () => {
		it("should pause and unpause contract", async () => {
			await bbs.pause();

			expect(await bbs.paused()).to.be.true;

			await bbs.unpause();

			expect(await bbs.paused()).to.be.false;
		});

		it("only admins should be able to pause and unpause", async () => {
			await expect(bbs.connect(player1).pause()).to.be.reverted;

			await bbs.pause();

			await expect(bbs.connect(player1).unpause()).to.be.reverted;
		});

		it("should grant admin role", async () => {
			await bbs.grantRole(adminRole, player1.address);

			expect(await bbs.hasRole(adminRole, player1.address)).to.be.true;
		});

		it("only admins should be able to grant roles", async () => {
			await expect(
				bbs.connect(player1).grantRole(adminRole, player1.address)
			).to.be.reverted;
		});

		it("should set minter address", async () => {
			await bbs.setMinter(minter.address);

			expect(await bbs.minter()).to.be.equal(minter.address);
		});

		it("only admins should be able to set minter address", async () => {
			await expect(bbs.connect(player1).setMinter(minter.address)).to.be
				.reverted;

			// Minter should still be zero address
			expect(await bbs.minter()).to.be.equal(
				ethers.constants.AddressZero
			);
		});

		it("should transfer ownership", async () => {
			await bbs.transferOwnership(player1.address);

			expect(await bbs.owner()).to.be.equal(player1.address);
		});

		it("only owner should be able to transfer ownership", async () => {
			await expect(
				bbs.connect(player1).transferOwnership(player1.address)
			).to.be.revertedWith("Ownable: caller is not the owner");

			// Contract should still be owned by the original owner
			expect(await bbs.owner()).to.be.equal(owner.address);
		});
	});

	describe("Minting", () => {
		beforeEach(async () => {
			bbs.setMinter(minter.address);
		});

		it("should mint BigBearSyndicate for player", async () => {
			const tokenId = 1;

			await bbs.connect(minter).mint(player1.address, tokenId);

			// BigBearSyndicate should now exist
			expect(await bbs.exists(tokenId)).to.be.true;

			// BigBearSyndicate should be owned by player 1
			expect(await bbs.ownerOf(tokenId)).to.be.equal(player1.address);
		});

		it("only minter should be able to mint", async () => {
			const tokenId = 1;

			await expect(bbs.mint(player1.address, tokenId)).to.be.revertedWith(
				"Unauthorized()"
			);

			await bbs.connect(minter).mint(player1.address, tokenId);
		});

		it("should revert mint when paused", async () => {
			await bbs.pause();

			const tokenId = 1;

			await expect(
				bbs.connect(minter).mint(player1.address, 1)
			).to.be.revertedWith("Pausable: paused");

			await bbs.unpause();

			await bbs.connect(minter).mint(player1.address, tokenId);
		});
	});

	describe("Burning", () => {
		beforeEach(async () => {
			bbs.setMinter(minter.address);
		});

		it("should burn BigBearSyndicate", async () => {
			const tokenId = 1;

			await bbs.connect(minter).mint(player1.address, tokenId);

			// BigBearSyndicate should be owned by player 1
			expect(await bbs.ownerOf(tokenId)).to.be.equal(player1.address);

			await bbs.connect(player1).burn(tokenId);

			// BigBearSyndicate should be owned by nobody
			expect(await bbs.exists(tokenId)).to.be.false;
		});

		it("only admins should be able to burn the BigBearSyndicate", async () => {
			const tokenId = 1;

			await bbs.connect(minter).mint(player1.address, tokenId);

			await expect(bbs.burn(tokenId)).to.be.revertedWith(
				"ERC721: caller is not token owner or approved"
			);

			// BigBearSyndicate should still exist
			expect(await bbs.exists(tokenId)).to.be.true;
			// BigBearSyndicate should still be owned by player 1
			expect(await bbs.ownerOf(tokenId)).to.be.equal(player1.address);
		});
	});

	describe("Transfers", () => {
		beforeEach(async () => {
			bbs.setMinter(minter.address);
		});

		it("should allow transfer BigBearSyndicate by non-filtered operator", async () => {
			const tokenId = 1;

			await bbs.connect(minter).mint(player1.address, tokenId);

			// BigBearSyndicate should still be owned by player 1
			expect(await bbs.ownerOf(tokenId)).to.be.equal(player1.address);

			// Grant approval to operator
			await bbs.connect(player1).approve(operator.address, 1);

			// Check if operator is approved
			expect(await bbs.getApproved(tokenId)).to.be.equal(
				operator.address
			);

			await bbs
				.connect(operator)
				["safeTransferFrom(address,address,uint256)"](
					player1.address,
					player2.address,
					tokenId
				);

			// BigBearSyndicate should now be owned by player 2
			expect(await bbs.ownerOf(tokenId)).to.be.equal(player2.address);
		});

		it("should revert transfer BigBearSyndicate by filtered operator", async () => {
			const tokenId = 1;

			await bbs.connect(minter).mint(player1.address, tokenId);

			// BigBearSyndicate should still be owned by player 1
			expect(await bbs.ownerOf(tokenId)).to.be.equal(player1.address);

			// Grant approval to operator
			await bbs.connect(player1).approve(operator.address, 1);

			// Check if operator is approved
			expect(await bbs.getApproved(tokenId)).to.be.equal(
				operator.address
			);

			// Add operator to the filtered operators
			await operatorFilterRegistry.updateOperator(
				bbs.address,
				operator.address,
				true
			);

			await expect(
				bbs
					.connect(operator)
					["safeTransferFrom(address,address,uint256)"](
						player1.address,
						player2.address,
						tokenId
					)
			).to.be.revertedWith(`AddressFiltered("${operator.address}")`);
		});

		it("should transfer BigBearSyndicate from player to player", async () => {
			const tokenId = 1;

			await bbs.connect(minter).mint(player1.address, tokenId);

			// BigBearSyndicate should still be owned by player 1
			expect(await bbs.ownerOf(tokenId)).to.be.equal(player1.address);

			await bbs
				.connect(player1)
				["safeTransferFrom(address,address,uint256)"](
					player1.address,
					player2.address,
					tokenId
				);

			// BigBearSyndicate should now be owned by player 2
			expect(await bbs.ownerOf(tokenId)).to.be.equal(player2.address);
		});

		it("should revert transfer if signer is not the owner of the BigBearSyndicate", async () => {
			const tokenId = 1;

			await bbs.connect(minter).mint(player1.address, tokenId);

			await expect(
				bbs["safeTransferFrom(address,address,uint256)"](
					player1.address,
					player2.address,
					tokenId
				)
			).to.be.revertedWith(
				"ERC721: caller is not token owner or approved"
			);
		});

		it("should revert transfer when paused", async () => {
			const tokenId = 1;

			await bbs.connect(minter).mint(player1.address, tokenId);

			await bbs.pause();

			await expect(
				bbs
					.connect(player1)
					["safeTransferFrom(address,address,uint256)"](
						player1.address,
						player2.address,
						tokenId
					)
			).to.be.revertedWith("Pausable: paused");

			await bbs.unpause();

			bbs.connect(player1)["safeTransferFrom(address,address,uint256)"](
				player1.address,
				player2.address,
				tokenId
			);
		});

		it("should revert transfer if recipient is a contract that does not implement IERC721Receiver", async () => {
			const tokenId = 1;

			await bbs.connect(minter).mint(player1.address, tokenId);

			const factory = await ethers.getContractFactory("ERC20");
			const erc20 = await factory.deploy("Dummy", "DMY");

			await expect(
				bbs
					.connect(player1)
					["safeTransferFrom(address,address,uint256)"](
						player1.address,
						erc20.address,
						tokenId
					)
			).to.be.revertedWith(
				"ERC721: transfer to non ERC721Receiver implementer"
			);
		});
	});

	describe("Queries", () => {
		beforeEach(async () => {
			bbs.setMinter(minter.address);
		});

		it("should return owner of BigBearSyndicate", async () => {
			await bbs.connect(minter).mint(player1.address, 1);

			expect(await bbs.ownerOf(1)).to.be.equal(player1.address);
		});

		it("should return new owner of transferred BigBearSyndicate", async () => {
			await bbs.connect(minter).mint(player1.address, 1);

			// Transfer BigBearSyndicate from player 2 to player 1
			await bbs
				.connect(player1)
				["safeTransferFrom(address,address,uint256)"](
					player1.address,
					player2.address,
					1
				);

			expect(await bbs.ownerOf(1)).to.be.equal(player2.address);
		});
	});

	describe("Metadata", () => {
		let newBaseUri = "https://mightyverse.com/api/v2/bbs/";
		let newContractUri = "https://mightyverse.com/api/v2/bbs";

		it("should return correct metadata URI of BigBearSyndicate", async () => {
			bbs.setMinter(minter.address);

			const tokenId = 1;

			await bbs.connect(minter).mint(player1.address, tokenId);

			// BigBearSyndicate should have correct token URI
			expect(await bbs.tokenURI(tokenId)).to.be.equal(baseUri + tokenId);
		});

		it("should set base URI", async () => {
			await bbs.setBaseURI(newBaseUri);

			expect(await bbs.baseURI()).to.be.equal(newBaseUri);
		});

		it("only admins should be able to set base URI", async () => {
			await expect(bbs.connect(player1).setBaseURI(newBaseUri)).to.be
				.reverted;

			// Base URI should not have changed
			expect(await bbs.baseURI()).to.be.equal(baseUri);
		});

		it("should set contract URI", async () => {
			await bbs.setContractURI(newContractUri);

			expect(await bbs.contractURI()).to.be.equal(newContractUri);
		});

		it("only admins should be able to set contract URI", async () => {
			await expect(bbs.connect(player1).setContractURI(contractUri)).to.be
				.reverted;

			// Contract URI should not have changed
			expect(await bbs.contractURI()).to.be.equal(contractUri);
		});
	});

	describe("Royalties", () => {
		it("should set default royalty", async () => {
			// Set default royalty to 8%
			await bbs.setDefaultRoyalty(owner.address, 800);

			const price = ethers.utils.parseEther("1");

			const royaltyInfo = await bbs.royaltyInfo(1, price);

			expect(royaltyInfo[0]).to.be.equal(owner.address);
			expect(royaltyInfo[1]).to.be.equal(ethers.utils.parseEther("0.08"));
		});

		it("only admins should be able to set default royalty", async () => {
			await expect(
				bbs.connect(player1).setDefaultRoyalty(owner.address, 800)
			).to.be.reverted;
		});

		it("should delete default royalty", async () => {
			await bbs.deleteDefaultRoyalty();

			const price = ethers.utils.parseEther("1");

			const royaltyInfo = await bbs.royaltyInfo(1, price);

			expect(royaltyInfo[0]).to.be.equal(ethers.constants.AddressZero);
			expect(royaltyInfo[1]).to.be.equal(ethers.utils.parseEther("0"));
		});

		it("only admins should be able to delete default royalty", async () => {
			await expect(bbs.connect(player1).deleteDefaultRoyalty()).to.be
				.reverted;
		});

		it("should set token royalty", async () => {
			const tokenId = 1;

			await bbs.setTokenRoyalty(tokenId, owner.address, 1000);

			const price = ethers.utils.parseEther("1");

			const royaltyInfo = await bbs.royaltyInfo(tokenId, price);

			expect(royaltyInfo[0]).to.be.equal(owner.address);
			expect(royaltyInfo[1]).to.be.equal(ethers.utils.parseEther("0.1"));
		});

		it("only admins should be able to set token royalty", async () => {
			await expect(
				bbs.connect(player1).setTokenRoyalty(1, owner.address, 1000)
			).to.be.reverted;
		});

		it("token royalty should only apply to that token", async () => {
			await bbs.setTokenRoyalty(1, owner.address, 1000);

			const price = ethers.utils.parseEther("1");

			// Get royalty info of token 2 instead
			const royaltyInfo = await bbs.royaltyInfo(2, price);

			expect(royaltyInfo[0]).to.be.equal(owner.address);
			expect(royaltyInfo[1]).to.be.equal(
				ethers.utils.parseEther("0.075")
			);
		});

		it("should reset token royalty", async () => {
			const tokenId = 1;

			await bbs.setTokenRoyalty(tokenId, owner.address, 1000);
			await bbs.resetTokenRoyalty(tokenId);

			const price = ethers.utils.parseEther("1");

			const royaltyInfo = await bbs.royaltyInfo(tokenId, price);

			expect(royaltyInfo[0]).to.be.equal(owner.address);
			expect(royaltyInfo[1]).to.be.equal(
				ethers.utils.parseEther("0.075")
			);
		});

		it("only admins should be able to reset token royalty", async () => {
			await expect(bbs.connect(player1).resetTokenRoyalty(1)).to.be
				.reverted;
		});
	});

	describe("Upgrade", () => {
		let bbsUpgrade: BigBearSyndicate;

		let tokenId = 1;
		let token2Id = 2;

		beforeEach(async () => {
			setTransparentUpgradeableProxyAdmin(
				bbs.address,
				proxyUpgradeAdmin,
				originalProxyAdminAddress
			);

			bbs.setMinter(minter.address);

			await bbs.connect(minter).mint(player1.address, tokenId);

			// Upgrade contract to BigBearSyndicate Upgradeable V2
			let factory = await ethers.getContractFactory("BigBearSyndicate");

			const contract = await upgrades.upgradeProxy(bbs.address, factory);

			bbsUpgrade = factory.attach(contract.address);
		});

		it("should upgrade successfully", async () => {
			expect(bbsUpgrade).to.not.be.undefined;
		});

		it("should carry over state", async () => {
			// Base and contract URI should be carried over
			expect(await bbsUpgrade.baseURI()).to.be.equal(baseUri);
			expect(await bbsUpgrade.contractURI()).to.be.equal(contractUri);

			// Minter should be carried over
			expect(await bbsUpgrade.minter()).to.be.equal(minter.address);

			// Token ownership should be carried over
			expect(await bbsUpgrade.ownerOf(tokenId)).to.be.equal(
				player1.address
			);
		});

		it("should be able to call mint setter functions and mint", async () => {
			bbsUpgrade.setMinter(player1.address);
			expect(await bbsUpgrade.minter()).to.be.equal(player1.address);

			await expect(
				bbsUpgrade.connect(minter).mint(player1.address, token2Id)
			).to.be.revertedWith("Unauthorized()");

			bbsUpgrade.connect(player1).mint(player1.address, token2Id);

			expect(await bbsUpgrade.ownerOf(token2Id)).to.be.equal(
				player1.address
			);
		});
	});

	describe("Restriction", () => {
		beforeEach(async () => {
			await bbs.setMinter(minter.address);
			await bbs.connect(minter).mint(player1.address, 1);
			await bbs.connect(player1).setApprovalForAll(player2.address, true);
		});

		it("should not be able to unrestrict other restrictor's restricted tokens", async () => {
			await restrictedRegistry.grantRole(
				await restrictedRegistry.RESTRICTOR_ROLE(),
				player1.address
			);

			await restrictedRegistry
				.connect(restrictor)
				.restrict(bbs.address, [1]);

			await expect(
				restrictedRegistry.connect(player1).unrestrict(bbs.address, [1])
			).to.be.revertedWith(`InvalidRestrictor(\"${player1.address}\")`);
		});

		it("should not be able to transfer a restricted token", async () => {
			await restrictedRegistry
				.connect(restrictor)
				.restrict(bbs.address, [1]);
			await expect(
				bbs
					.connect(player1)
					.transferFrom(player1.address, player2.address, 1)
			).to.be.revertedWith("TokenIsRestricted(1)");
		});

		it("should not be able to burn a restricted token", async () => {
			await restrictedRegistry
				.connect(restrictor)
				.restrict(bbs.address, [1]);
			await expect(bbs.connect(player1).burn(1)).to.be.revertedWith(
				"TokenIsRestricted(1)"
			);
		});

		it("should be able to transfer an unrestricted token", async () => {
			await expect(
				bbs
					.connect(player1)
					.transferFrom(player1.address, player2.address, 1)
			).to.not.be.reverted;
		});

		it("should be able to burn an unrestricted token", async () => {
			await expect(bbs.connect(player1).burn(1)).to.not.be.reverted;
		});
	});
});
