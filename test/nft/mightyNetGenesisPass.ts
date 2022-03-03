/*
 * Copyright (c) 2022 Mighty Bear Games
 */

import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { BytesLike } from "ethers";
import { ethers, upgrades } from "hardhat";
import {
	MightyNetGenesisPass,
	MightyNetGenesisPass__factory,
	OperatorFilterRegistry,
	MightyNetERC721RestrictedRegistry,
} from "../../typechain";
import { deployMightyNetGP } from "./utils/mightyNetGPMinterTestHelper";
import {
	deployOperatorFilterRegistry,
	setProxyAdmin,
	setTransparentUpgradeableProxyAdmin,
} from "./utils/testHelper";
import { deployUpgradeable } from "./utils/deploy";
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("MightyNet Genesis Pass", () => {
	let baseUri = "https://mightynet.xyz/metadata/1337/";
	let contractUri = "https://mightynet.xyz/metadata/1337";
	let mightyNetGP: MightyNetGenesisPass;

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
		// Deploy MightyNetGenesisPass contract
		const mightyNetGP = await deployMightyNetGP(
			baseUri,
			contractUri,
			operatorFilterRegistry.address,
			restrictedRegistry.address
		);

		adminRole = await mightyNetGP.DEFAULT_ADMIN_ROLE();

		originalProxyAdminAddress = (await upgrades.admin.getInstance())
			.address;

		setProxyAdmin(
			originalProxyAdminAddress,
			owner,
			mightyNetGP.address,
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
			mightyNetGPContract: mightyNetGP,
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
			mightyNetGPContract,
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
		mightyNetGP = mightyNetGPContract;
	});

	describe("Deployment", () => {
		it("should be owned by deployer", async () => {
			expect(await mightyNetGP.owner()).to.be.equal(owner.address);
		});

		it("should have correct baseURI", async () => {
			expect(await mightyNetGP.baseURI()).to.be.equal(baseUri);
		});

		it("should have correct contractURI", async () => {
			expect(await mightyNetGP.contractURI()).to.be.equal(contractUri);
		});

		it("should have no minter", async () => {
			expect(await mightyNetGP.minter()).to.be.equal(
				ethers.constants.AddressZero
			);
		});

		it("should have correct operator filter registry address", async () => {
			expect(await mightyNetGP.operatorFilterRegistry()).to.be.equal(
				operatorFilterRegistry.address
			);
		});

		it("should have default royalty", async () => {
			const price = ethers.utils.parseEther("1");

			const royaltyInfo = await mightyNetGP.royaltyInfo(1, price);

			expect(royaltyInfo[0]).to.be.equal(owner.address);
			expect(royaltyInfo[1]).to.be.equal(
				ethers.utils.parseEther("0.075")
			);
		});

		it("should be unpaused", async () => {
			expect(await mightyNetGP.paused()).to.be.false;
		});
	});

	describe("Administration", () => {
		it("should pause and unpause contract", async () => {
			await mightyNetGP.pause();

			expect(await mightyNetGP.paused()).to.be.true;

			await mightyNetGP.unpause();

			expect(await mightyNetGP.paused()).to.be.false;
		});

		it("only admins should be able to pause and unpause", async () => {
			await expect(mightyNetGP.connect(player1).pause()).to.be.reverted;

			await mightyNetGP.pause();

			await expect(mightyNetGP.connect(player1).unpause()).to.be.reverted;
		});

		it("should grant admin role", async () => {
			await mightyNetGP.grantRole(adminRole, player1.address);

			expect(await mightyNetGP.hasRole(adminRole, player1.address)).to.be
				.true;
		});

		it("only admins should be able to grant roles", async () => {
			await expect(
				mightyNetGP
					.connect(player1)
					.grantRole(adminRole, player1.address)
			).to.be.reverted;
		});

		it("should set minter address", async () => {
			await mightyNetGP.setMinter(minter.address);

			expect(await mightyNetGP.minter()).to.be.equal(minter.address);
		});

		it("only admins should be able to set minter address", async () => {
			await expect(mightyNetGP.connect(player1).setMinter(minter.address))
				.to.be.reverted;

			// Minter should still be zero address
			expect(await mightyNetGP.minter()).to.be.equal(
				ethers.constants.AddressZero
			);
		});

		it("should transfer ownership", async () => {
			await mightyNetGP.transferOwnership(player1.address);

			expect(await mightyNetGP.owner()).to.be.equal(player1.address);
		});

		it("only owner should be able to transfer ownership", async () => {
			await expect(
				mightyNetGP.connect(player1).transferOwnership(player1.address)
			).to.be.revertedWith("Ownable: caller is not the owner");

			// Contract should still be owned by the original owner
			expect(await mightyNetGP.owner()).to.be.equal(owner.address);
		});
	});

	describe("Minting", () => {
		beforeEach(async () => {
			mightyNetGP.setMinter(minter.address);
		});

		it("should mint MightyNetGenesisPass for player", async () => {
			const tokenId = 1;

			await mightyNetGP.connect(minter).mint(player1.address, tokenId);

			// MightyNetGenesisPass should now exist
			expect(await mightyNetGP.exists(tokenId)).to.be.true;

			// MightyNetGenesisPass should be owned by player 1
			expect(await mightyNetGP.ownerOf(tokenId)).to.be.equal(
				player1.address
			);
		});

		it("only minter should be able to mint", async () => {
			const tokenId = 1;

			await expect(
				mightyNetGP.mint(player1.address, tokenId)
			).to.be.revertedWith("Unauthorized()");

			await mightyNetGP.connect(minter).mint(player1.address, tokenId);
		});

		it("should revert mint when paused", async () => {
			await mightyNetGP.pause();

			const tokenId = 1;

			await expect(
				mightyNetGP.connect(minter).mint(player1.address, 1)
			).to.be.revertedWith("Pausable: paused");

			await mightyNetGP.unpause();

			await mightyNetGP.connect(minter).mint(player1.address, tokenId);
		});
	});

	describe("Burning", () => {
		beforeEach(async () => {
			mightyNetGP.setMinter(minter.address);
		});

		it("should burn MightyNetGenesisPass", async () => {
			const tokenId = 1;

			await mightyNetGP.connect(minter).mint(player1.address, tokenId);

			// MightyNetGenesisPass should be owned by player 1
			expect(await mightyNetGP.ownerOf(tokenId)).to.be.equal(
				player1.address
			);

			await mightyNetGP.connect(player1).burn(tokenId);

			// MightyNetGenesisPass should be owned by nobody
			expect(await mightyNetGP.exists(tokenId)).to.be.false;
		});

		it("only admins should be able to burn the MightyNetGenesisPass", async () => {
			const tokenId = 1;

			await mightyNetGP.connect(minter).mint(player1.address, tokenId);

			await expect(mightyNetGP.burn(tokenId)).to.be.revertedWith(
				"ERC721: caller is not token owner or approved"
			);

			// MightyNetGenesisPass should still exist
			expect(await mightyNetGP.exists(tokenId)).to.be.true;
			// MightyNetGenesisPass should still be owned by player 1
			expect(await mightyNetGP.ownerOf(tokenId)).to.be.equal(
				player1.address
			);
		});
	});

	describe("Transfers", () => {
		beforeEach(async () => {
			mightyNetGP.setMinter(minter.address);
		});

		it("should allow transfer MightyNetGenesisPass by non-filtered operator", async () => {
			const tokenId = 1;

			await mightyNetGP.connect(minter).mint(player1.address, tokenId);

			// MightyNetGenesisPass should still be owned by player 1
			expect(await mightyNetGP.ownerOf(tokenId)).to.be.equal(
				player1.address
			);

			// Grant approval to operator
			await mightyNetGP.connect(player1).approve(operator.address, 1);

			// Check if operator is approved
			expect(await mightyNetGP.getApproved(tokenId)).to.be.equal(
				operator.address
			);

			await mightyNetGP
				.connect(operator)
				["safeTransferFrom(address,address,uint256)"](
					player1.address,
					player2.address,
					tokenId
				);

			// MightyNetGenesisPass should now be owned by player 2
			expect(await mightyNetGP.ownerOf(tokenId)).to.be.equal(
				player2.address
			);
		});

		it("should revert transfer MightyNetGenesisPass by filtered operator", async () => {
			const tokenId = 1;

			await mightyNetGP.connect(minter).mint(player1.address, tokenId);

			// MightyNetGenesisPass should still be owned by player 1
			expect(await mightyNetGP.ownerOf(tokenId)).to.be.equal(
				player1.address
			);

			// Grant approval to operator
			await mightyNetGP.connect(player1).approve(operator.address, 1);

			// Check if operator is approved
			expect(await mightyNetGP.getApproved(tokenId)).to.be.equal(
				operator.address
			);

			// Add operator to the filtered operators
			await operatorFilterRegistry.updateOperator(
				mightyNetGP.address,
				operator.address,
				true
			);

			await expect(
				mightyNetGP
					.connect(operator)
					["safeTransferFrom(address,address,uint256)"](
						player1.address,
						player2.address,
						tokenId
					)
			).to.be.revertedWith(`AddressFiltered("${operator.address}")`);
		});

		it("should transfer MightyNetGenesisPass from player to player", async () => {
			const tokenId = 1;

			await mightyNetGP.connect(minter).mint(player1.address, tokenId);

			// MightyNetGenesisPass should still be owned by player 1
			expect(await mightyNetGP.ownerOf(tokenId)).to.be.equal(
				player1.address
			);

			await mightyNetGP
				.connect(player1)
				["safeTransferFrom(address,address,uint256)"](
					player1.address,
					player2.address,
					tokenId
				);

			// MightyNetGenesisPass should now be owned by player 2
			expect(await mightyNetGP.ownerOf(tokenId)).to.be.equal(
				player2.address
			);
		});

		it("should revert transfer if signer is not the owner of the MightyNetGenesisPass", async () => {
			const tokenId = 1;

			await mightyNetGP.connect(minter).mint(player1.address, tokenId);

			await expect(
				mightyNetGP["safeTransferFrom(address,address,uint256)"](
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

			await mightyNetGP.connect(minter).mint(player1.address, tokenId);

			await mightyNetGP.pause();

			await expect(
				mightyNetGP
					.connect(player1)
					["safeTransferFrom(address,address,uint256)"](
						player1.address,
						player2.address,
						tokenId
					)
			).to.be.revertedWith("Pausable: paused");

			await mightyNetGP.unpause();

			mightyNetGP
				.connect(player1)
				["safeTransferFrom(address,address,uint256)"](
					player1.address,
					player2.address,
					tokenId
				);
		});

		it("should revert transfer if recipient is a contract that does not implement IERC721Receiver", async () => {
			const tokenId = 1;

			await mightyNetGP.connect(minter).mint(player1.address, tokenId);

			const factory = await ethers.getContractFactory("ERC20");
			const erc20 = await factory.deploy("Dummy", "DMY");

			await expect(
				mightyNetGP
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
			mightyNetGP.setMinter(minter.address);
		});

		it("should return owner of MightyNetGenesisPass", async () => {
			await mightyNetGP.connect(minter).mint(player1.address, 1);

			expect(await mightyNetGP.ownerOf(1)).to.be.equal(player1.address);
		});

		it("should return new owner of transferred MightyNetGenesisPass", async () => {
			await mightyNetGP.connect(minter).mint(player1.address, 1);

			// Transfer MightyNetGenesisPass from player 2 to player 1
			await mightyNetGP
				.connect(player1)
				["safeTransferFrom(address,address,uint256)"](
					player1.address,
					player2.address,
					1
				);

			expect(await mightyNetGP.ownerOf(1)).to.be.equal(player2.address);
		});
	});

	describe("Metadata", () => {
		let newBaseUri = "https://mightyverse.com/api/v2/bbs/";
		let newContractUri = "https://mightyverse.com/api/v2/bbs";

		it("should return correct metadata URI of MightyNetGenesisPass", async () => {
			mightyNetGP.setMinter(minter.address);

			const tokenId = 1;

			await mightyNetGP.connect(minter).mint(player1.address, tokenId);

			// MightyNetGenesisPass should have correct token URI
			expect(await mightyNetGP.tokenURI(tokenId)).to.be.equal(
				baseUri + tokenId
			);
		});

		it("should set base URI", async () => {
			await mightyNetGP.setBaseURI(newBaseUri);

			expect(await mightyNetGP.baseURI()).to.be.equal(newBaseUri);
		});

		it("only admins should be able to set base URI", async () => {
			await expect(mightyNetGP.connect(player1).setBaseURI(newBaseUri)).to
				.be.reverted;

			// Base URI should not have changed
			expect(await mightyNetGP.baseURI()).to.be.equal(baseUri);
		});

		it("should set contract URI", async () => {
			await mightyNetGP.setContractURI(newContractUri);

			expect(await mightyNetGP.contractURI()).to.be.equal(newContractUri);
		});

		it("only admins should be able to set contract URI", async () => {
			await expect(
				mightyNetGP.connect(player1).setContractURI(contractUri)
			).to.be.reverted;

			// Contract URI should not have changed
			expect(await mightyNetGP.contractURI()).to.be.equal(contractUri);
		});
	});

	describe("Royalties", () => {
		it("should set default royalty", async () => {
			// Set default royalty to 8%
			await mightyNetGP.setDefaultRoyalty(owner.address, 800);

			const price = ethers.utils.parseEther("1");

			const royaltyInfo = await mightyNetGP.royaltyInfo(1, price);

			expect(royaltyInfo[0]).to.be.equal(owner.address);
			expect(royaltyInfo[1]).to.be.equal(ethers.utils.parseEther("0.08"));
		});

		it("only admins should be able to set default royalty", async () => {
			await expect(
				mightyNetGP
					.connect(player1)
					.setDefaultRoyalty(owner.address, 800)
			).to.be.reverted;
		});

		it("should delete default royalty", async () => {
			await mightyNetGP.deleteDefaultRoyalty();

			const price = ethers.utils.parseEther("1");

			const royaltyInfo = await mightyNetGP.royaltyInfo(1, price);

			expect(royaltyInfo[0]).to.be.equal(ethers.constants.AddressZero);
			expect(royaltyInfo[1]).to.be.equal(ethers.utils.parseEther("0"));
		});

		it("only admins should be able to delete default royalty", async () => {
			await expect(mightyNetGP.connect(player1).deleteDefaultRoyalty()).to
				.be.reverted;
		});

		it("should set token royalty", async () => {
			const tokenId = 1;

			await mightyNetGP.setTokenRoyalty(tokenId, owner.address, 1000);

			const price = ethers.utils.parseEther("1");

			const royaltyInfo = await mightyNetGP.royaltyInfo(tokenId, price);

			expect(royaltyInfo[0]).to.be.equal(owner.address);
			expect(royaltyInfo[1]).to.be.equal(ethers.utils.parseEther("0.1"));
		});

		it("only admins should be able to set token royalty", async () => {
			await expect(
				mightyNetGP
					.connect(player1)
					.setTokenRoyalty(1, owner.address, 1000)
			).to.be.reverted;
		});

		it("token royalty should only apply to that token", async () => {
			await mightyNetGP.setTokenRoyalty(1, owner.address, 1000);

			const price = ethers.utils.parseEther("1");

			// Get royalty info of token 2 instead
			const royaltyInfo = await mightyNetGP.royaltyInfo(2, price);

			expect(royaltyInfo[0]).to.be.equal(owner.address);
			expect(royaltyInfo[1]).to.be.equal(
				ethers.utils.parseEther("0.075")
			);
		});

		it("should reset token royalty", async () => {
			const tokenId = 1;

			await mightyNetGP.setTokenRoyalty(tokenId, owner.address, 1000);
			await mightyNetGP.resetTokenRoyalty(tokenId);

			const price = ethers.utils.parseEther("1");

			const royaltyInfo = await mightyNetGP.royaltyInfo(tokenId, price);

			expect(royaltyInfo[0]).to.be.equal(owner.address);
			expect(royaltyInfo[1]).to.be.equal(
				ethers.utils.parseEther("0.075")
			);
		});

		it("only admins should be able to reset token royalty", async () => {
			await expect(mightyNetGP.connect(player1).resetTokenRoyalty(1)).to
				.be.reverted;
		});
	});

	describe("Upgrade", () => {
		let bbsUpgrade: MightyNetGenesisPass;

		let tokenId = 1;
		let token2Id = 2;

		beforeEach(async () => {
			setTransparentUpgradeableProxyAdmin(
				mightyNetGP.address,
				proxyUpgradeAdmin,
				originalProxyAdminAddress
			);

			mightyNetGP.setMinter(minter.address);

			await mightyNetGP.connect(minter).mint(player1.address, tokenId);

			let factory = (await ethers.getContractFactory(
				"contracts/1337/MightyNetGenesisPass.sol:MightyNetGenesisPass"
			)) as MightyNetGenesisPass__factory;

			const contract = await upgrades.upgradeProxy(
				mightyNetGP.address,
				factory
			);

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

			// Operator filter registry should be carried over
			expect(await bbsUpgrade.operatorFilterRegistry()).to.be.equal(
				operatorFilterRegistry.address
			);

			// Token ownership should be carried over
			expect(await bbsUpgrade.ownerOf(tokenId)).to.be.equal(
				player1.address
			);
		});

		it("should mint MightyNetGenesisPass for playe with same restriction after upgrade", async () => {
			const tokenId = 1;

			mightyNetGP.setMinter(minter.address);

			await expect(
				mightyNetGP.mint(player1.address, token2Id)
			).to.be.revertedWith("Unauthorized()");

			await mightyNetGP.connect(minter).mint(player1.address, token2Id);

			// MightyNetGenesisPass should now exist
			expect(await mightyNetGP.exists(token2Id)).to.be.true;

			// MightyNetGenesisPass should be owned by player 1
			expect(await mightyNetGP.ownerOf(token2Id)).to.be.equal(
				player1.address
			);
		});
	});

	describe("Restriction", () => {
		beforeEach(async () => {
			await mightyNetGP.setMinter(minter.address);
			await mightyNetGP.connect(minter).mint(player1.address, 1);
			await mightyNetGP
				.connect(player1)
				.setApprovalForAll(player2.address, true);
		});

		it("should not be able to unrestrict other restrictor's restricted tokens", async () => {
			await restrictedRegistry.grantRole(
				await restrictedRegistry.RESTRICTOR_ROLE(),
				player1.address
			);

			await restrictedRegistry
				.connect(restrictor)
				.restrict(mightyNetGP.address, [1]);

			await expect(
				restrictedRegistry
					.connect(player1)
					.unrestrict(mightyNetGP.address, [1])
			).to.be.revertedWith(`InvalidRestrictor(\"${player1.address}\")`);
		});

		it("should not be able to transfer a restricted token", async () => {
			await restrictedRegistry
				.connect(restrictor)
				.restrict(mightyNetGP.address, [1]);
			await expect(
				mightyNetGP
					.connect(player1)
					.transferFrom(player1.address, player2.address, 1)
			).to.be.revertedWith("TokenIsRestricted(1)");
		});

		it("should not be able to burn a restricted token", async () => {
			await restrictedRegistry
				.connect(restrictor)
				.restrict(mightyNetGP.address, [1]);
			await expect(
				mightyNetGP.connect(player1).burn(1)
			).to.be.revertedWith("TokenIsRestricted(1)");
		});

		it("should be able to transfer an unrestricted token", async () => {
			await expect(
				mightyNetGP
					.connect(player1)
					.transferFrom(player1.address, player2.address, 1)
			).to.not.be.reverted;
		});

		it("should be able to burn an unrestricted token", async () => {
			await expect(mightyNetGP.connect(player1).burn(1)).to.not.be
				.reverted;
		});
	});
});
