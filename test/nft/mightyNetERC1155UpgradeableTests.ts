/*
 * Copyright (c) 2023 Mighty Bear Games
 */

import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { BigNumber, BytesLike } from "ethers";
import { ethers, upgrades } from "hardhat";
import {
	MightyNetERC1155Upgradeable,
	OperatorFilterRegistry,
} from "../../typechain";
import { deployUpgradeable } from "./utils/deploy";
import {
	deployOperatorFilterRegistry,
	setProxyAdmin,
	setTransparentUpgradeableProxyAdmin,
} from "./utils/testHelper";
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("MightyNetERC1155Upgradeable Tests", async () => {
	let contractNameArray: Array<string> = [
		"MightyActionHeroesSupplyCrates",
		"MightyActionHeroesBlueprints",
		"MightyActionHeroesPARTS",
	];

	contractNameArray.forEach(contractName => {
		describe(contractName, () => {
			const baseUri =
				"https://mightynet.xyz/metadata/";
			const contractUri =
				"https://mightynet.xyz/metadata/";
			const idUri = "{id}";

			let operatorFilterRegistry: OperatorFilterRegistry;
			let adminRole: BytesLike,
				minterRole: BytesLike,
				burnerRole: BytesLike;

			let originalProxyAdminAddress: string;

			async function deployTokenFixture() {
				const [
					owner,
					minter,
					burner,
					player1,
					player2,
					operator,
					proxyUpgradeAdmin,
				] = await ethers.getSigners();

				operatorFilterRegistry = await deployOperatorFilterRegistry();

				const mightyNetERC1155UpgradeableDeployed =
					(await deployUpgradeable(
						contractName,
						"initialize",
						baseUri,
						contractUri,
						operatorFilterRegistry.address
					)) as MightyNetERC1155Upgradeable;

				await mightyNetERC1155UpgradeableDeployed.deployed();

				adminRole =
					await mightyNetERC1155UpgradeableDeployed.DEFAULT_ADMIN_ROLE();

				minterRole =
					await mightyNetERC1155UpgradeableDeployed.MINTER_ROLE();
				burnerRole =
					await mightyNetERC1155UpgradeableDeployed.BURNER_ROLE();

				originalProxyAdminAddress = (await upgrades.admin.getInstance())
					.address;

				setProxyAdmin(
					originalProxyAdminAddress,
					owner,
					mightyNetERC1155UpgradeableDeployed.address,
					proxyUpgradeAdmin.address
				);

				// Fixtures can return anything you consider useful for your tests
				return {
					contract: mightyNetERC1155UpgradeableDeployed,
					ownerSigner: owner,
					minterSigner: minter,
					burnerSigner: burner,
					player1Signer: player1,
					player2Signer: player2,
					operatorSigner: operator,
					proxyUpgradeAdminSigner: proxyUpgradeAdmin,
				};
			}

			let testFixture: any;

			beforeEach(async () => {
				testFixture = await loadFixture(deployTokenFixture);
			});

			describe("Deployment", () => {
				let owner: SignerWithAddress;
				let mightyNetERC1155Upgradeable: MightyNetERC1155Upgradeable;

				beforeEach(async () => {
					const { ownerSigner, contract } = testFixture;
					owner = ownerSigner;
					mightyNetERC1155Upgradeable = contract;
				});

				it("should be owned by deployer", async () => {
					expect(
						await mightyNetERC1155Upgradeable.owner()
					).to.be.equal(owner.address);
				});

				it("should have correct baseURI", async () => {
					const id = 0;
					const baseUriFromContract =
						await mightyNetERC1155Upgradeable.uri(id);

					expect(baseUriFromContract).to.be.equal(baseUri + mightyNetERC1155Upgradeable.address.toLowerCase() + "/{id}");
				});

				it("should have correct contractURI", async () => {
					expect(
						await mightyNetERC1155Upgradeable.contractURI()
					).to.be.equal(contractUri + mightyNetERC1155Upgradeable.address.toLowerCase());
				});

				it("should have correct role", async () => {
					expect(
						await mightyNetERC1155Upgradeable.hasRole(
							adminRole,
							owner.address
						)
					).to.be.equal(true);
				});

				it("should have correct operator filter registry address", async () => {
					expect(
						await mightyNetERC1155Upgradeable.operatorFilterRegistry()
					).to.be.equal(operatorFilterRegistry.address);
				});

				it("should be unpaused", async () => {
					expect(await mightyNetERC1155Upgradeable.paused()).to.be
						.false;
				});
			});

			describe("Administration", () => {
				let owner: SignerWithAddress,
					player1: SignerWithAddress,
					minter: SignerWithAddress;
				let mightyNetERC1155Upgradeable: MightyNetERC1155Upgradeable;

				beforeEach(async () => {
					const {
						ownerSigner,
						contract,
						player1Signer,
						minterSigner,
					} = testFixture;
					owner = ownerSigner;
					player1 = player1Signer;
					minter = minterSigner;
					mightyNetERC1155Upgradeable = contract;
				});

				it("should be able to pause and unpause contract as admin", async () => {
					await mightyNetERC1155Upgradeable.pause();

					expect(await mightyNetERC1155Upgradeable.paused()).to.be
						.true;

					await mightyNetERC1155Upgradeable.unpause();

					expect(await mightyNetERC1155Upgradeable.paused()).to.be
						.false;
				});

				it("only admins should be able to pause and unpause", async () => {
					await expect(
						mightyNetERC1155Upgradeable.connect(player1).pause()
					).to.be.reverted;

					await mightyNetERC1155Upgradeable.pause();

					await expect(
						mightyNetERC1155Upgradeable.connect(player1).unpause()
					).to.be.reverted;
				});

				it("should be able to grant admin role as admin", async () => {
					await mightyNetERC1155Upgradeable.grantRole(
						adminRole,
						player1.address
					);

					expect(
						await mightyNetERC1155Upgradeable.hasRole(
							adminRole,
							player1.address
						)
					).to.be.true;
				});

				it("only admins should be able to grant roles", async () => {
					await expect(
						mightyNetERC1155Upgradeable
							.connect(player1)
							.grantRole(adminRole, player1.address)
					).to.be.reverted;
				});

				it("should be able to set minter address as admin", async () => {
					await mightyNetERC1155Upgradeable.grantRole(
						minterRole,
						minter.address
					);

					expect(
						await mightyNetERC1155Upgradeable.hasRole(
							minterRole,
							minter.address
						)
					).to.be.equal(true);
				});

				it("should be able to set burner address as admin", async () => {
					await mightyNetERC1155Upgradeable.grantRole(
						burnerRole,
						player1.address
					);

					expect(
						await mightyNetERC1155Upgradeable.hasRole(
							burnerRole,
							player1.address
						)
					).to.be.equal(true);
				});

				it("only admins should be able to grant role", async () => {
					await expect(
						mightyNetERC1155Upgradeable
							.connect(player1)
							.grantRole(minterRole, minter.address)
					).to.be.reverted;

					// minter address should not have minter role
					expect(
						await mightyNetERC1155Upgradeable.hasRole(
							minterRole,
							minter.address
						)
					).to.be.equal(false);
				});

				it("should be able to transfer ownership as admin", async () => {
					await mightyNetERC1155Upgradeable.transferOwnership(
						player1.address
					);

					expect(
						await mightyNetERC1155Upgradeable.owner()
					).to.be.equal(player1.address);
				});

				it("only owner should be able to transfer ownership", async () => {
					await expect(
						mightyNetERC1155Upgradeable
							.connect(player1)
							.transferOwnership(player1.address)
					).to.be.revertedWith("Ownable: caller is not the owner");

					// Contract should still be owned by the original owner
					expect(
						await mightyNetERC1155Upgradeable.owner()
					).to.be.equal(owner.address);
				});
			});

			describe("Minting", () => {
				let owner: SignerWithAddress,
					player1: SignerWithAddress,
					minter: SignerWithAddress;
				let mightyNetERC1155Upgradeable: MightyNetERC1155Upgradeable;

				const tokenId = 1;
				const tokenQuantity = 10;

				beforeEach(async () => {
					const {
						ownerSigner,
						contract,
						player1Signer,
						minterSigner,
					} = testFixture;
					owner = ownerSigner;
					player1 = player1Signer;
					minter = minterSigner;
					mightyNetERC1155Upgradeable = contract;
					await mightyNetERC1155Upgradeable.grantRole(
						minterRole,
						minter.address
					);
				});

				it("should mint token for player 1", async () => {
					await mightyNetERC1155Upgradeable
						.connect(minter)
						.mint(player1.address, tokenId, tokenQuantity);

					expect(
						await mightyNetERC1155Upgradeable.balanceOf(
							player1.address,
							tokenId
						)
					).to.equal(tokenQuantity);
				});

				it("only minter should be able to mint", async () => {
					await expect(
						mightyNetERC1155Upgradeable.mint(
							player1.address,
							tokenId,
							tokenQuantity
						)
					).to.be.revertedWith(
						`AccessControl: account ${owner.address.toLowerCase()} is missing role ${minterRole}`
					);

					await mightyNetERC1155Upgradeable
						.connect(minter)
						.mint(player1.address, tokenId, tokenQuantity);
				});

				it("should revert mint when paused", async () => {
					await mightyNetERC1155Upgradeable.pause();

					await expect(
						mightyNetERC1155Upgradeable
							.connect(minter)
							.mint(player1.address, tokenId, tokenQuantity)
					).to.be.revertedWith("Pausable: paused");

					await mightyNetERC1155Upgradeable.unpause();

					await mightyNetERC1155Upgradeable
						.connect(minter)
						.mint(player1.address, tokenId, tokenQuantity);
				});
			});

			describe("Batch Minting", () => {
				let owner: SignerWithAddress,
					player1: SignerWithAddress,
					minter: SignerWithAddress;
				let mightyNetERC1155Upgradeable: MightyNetERC1155Upgradeable;

				const token1Id = 1;
				const token1Quantity = 10;
				const token2Id = 2;
				const token2Quantity = 20;

				const tokenIds = [token1Id, token2Id];
				const tokenQuantities = [token1Quantity, token2Quantity];

				beforeEach(async () => {
					const {
						ownerSigner,
						contract,
						player1Signer,
						minterSigner,
					} = testFixture;
					owner = ownerSigner;
					player1 = player1Signer;
					minter = minterSigner;
					mightyNetERC1155Upgradeable = contract;
					await mightyNetERC1155Upgradeable.grantRole(
						minterRole,
						minter.address
					);
				});

				it("should mint multiple tokens for player 1", async () => {
					await mightyNetERC1155Upgradeable
						.connect(minter)
						.mintBatch(player1.address, tokenIds, tokenQuantities);

					expect(
						await mightyNetERC1155Upgradeable.balanceOf(
							player1.address,
							token1Id
						)
					).to.equal(token1Quantity);

					expect(
						await mightyNetERC1155Upgradeable.balanceOf(
							player1.address,
							token2Id
						)
					).to.equal(token2Quantity);
				});

				it("only minter should be able to batch mint", async () => {
					await expect(
						mightyNetERC1155Upgradeable.mintBatch(
							player1.address,
							tokenIds,
							tokenQuantities
						)
					).to.be.revertedWith(
						`AccessControl: account ${owner.address.toLowerCase()} is missing role ${minterRole}`
					);

					await mightyNetERC1155Upgradeable
						.connect(minter)
						.mintBatch(player1.address, tokenIds, tokenQuantities);
				});

				it("should revert batch mint when paused", async () => {
					await mightyNetERC1155Upgradeable.pause();

					await expect(
						mightyNetERC1155Upgradeable
							.connect(minter)
							.mintBatch(
								player1.address,
								tokenIds,
								tokenQuantities
							)
					).to.be.revertedWith("Pausable: paused");

					await mightyNetERC1155Upgradeable.unpause();

					await mightyNetERC1155Upgradeable
						.connect(minter)
						.mintBatch(player1.address, tokenIds, tokenQuantities);
				});

				it("should revert mint when paused", async () => {
					await mightyNetERC1155Upgradeable.pause();

					await expect(
						mightyNetERC1155Upgradeable
							.connect(minter)
							.mint(player1.address, token1Id, token1Quantity)
					).to.be.revertedWith("Pausable: paused");

					await mightyNetERC1155Upgradeable.unpause();

					await mightyNetERC1155Upgradeable
						.connect(minter)
						.mint(player1.address, token1Id, token1Quantity);
				});
			});

			describe("Burning", () => {
				let player1: SignerWithAddress,
					minter: SignerWithAddress,
					burner: SignerWithAddress;
				let mightyNetERC1155Upgradeable: MightyNetERC1155Upgradeable;

				const token1Id = 1;
				const token2Id = 2;
				const tokenQuantity = 10;
				const burnQuantity = 5;
				const overBurnQuantity = 15;

				beforeEach(async () => {
					const {
						contract,
						player1Signer,
						minterSigner,
						burnerSigner,
					} = testFixture;
					player1 = player1Signer;
					minter = minterSigner;
					burner = burnerSigner;
					mightyNetERC1155Upgradeable = contract;
					await mightyNetERC1155Upgradeable.grantRole(
						minterRole,
						minter.address
					);
					await mightyNetERC1155Upgradeable.grantRole(
						burnerRole,
						burner.address
					);

					// Mint token 1 to player 1 before every test
					await mightyNetERC1155Upgradeable
						.connect(minter)
						.mint(player1.address, token1Id, tokenQuantity);
				});

				it("should burn Token 1", async () => {
					expect(
						await mightyNetERC1155Upgradeable.balanceOf(
							player1.address,
							token1Id
						)
					).to.equal(tokenQuantity);

					await mightyNetERC1155Upgradeable
						.connect(burner)
						.burn(player1.address, token1Id, burnQuantity);

					// Some token 1 should have been burned away
					expect(
						await mightyNetERC1155Upgradeable.balanceOf(
							player1.address,
							token1Id
						)
					).to.equal(tokenQuantity - burnQuantity);
				});

				it("only burner should be able to burn the Tokens", async () => {
					await expect(
						mightyNetERC1155Upgradeable
							.connect(player1)
							.burn(player1.address, token1Id, tokenQuantity)
					).to.be.revertedWith(
						`AccessControl: account ${player1.address.toLowerCase()} is missing role ${burnerRole}`
					);

					// Tokens should still exist
					expect(
						await mightyNetERC1155Upgradeable.balanceOf(
							player1.address,
							token1Id
						)
					).to.equal(tokenQuantity);
				});

				it("Burn should not exceed hold amount", async () => {
					await expect(
						mightyNetERC1155Upgradeable
							.connect(burner)
							.burn(player1.address, token1Id, overBurnQuantity)
					).to.be.revertedWith(
						"ERC1155: burn amount exceeds balance"
					);

					// Tokens should still exist
					expect(
						await mightyNetERC1155Upgradeable.balanceOf(
							player1.address,
							token1Id
						)
					).to.equal(tokenQuantity);
				});

				it("burner should not be able to mint, and vice versa", async () => {
					await expect(
						mightyNetERC1155Upgradeable
							.connect(burner)
							.mint(player1.address, token1Id, tokenQuantity)
					).to.be.revertedWith(
						`AccessControl: account ${burner.address.toLowerCase()} is missing role ${minterRole}`
					);

					await expect(
						mightyNetERC1155Upgradeable
							.connect(minter)
							.burn(player1.address, token1Id, tokenQuantity)
					).to.be.revertedWith(
						`AccessControl: account ${minter.address.toLowerCase()} is missing role ${burnerRole}`
					);
				});

				it("burning token 1 should not affect token 2", async () => {
					await mightyNetERC1155Upgradeable
						.connect(minter)
						.mint(player1.address, token2Id, tokenQuantity);

					expect(
						await mightyNetERC1155Upgradeable.balanceOf(
							player1.address,
							token1Id
						)
					).to.equal(tokenQuantity);

					expect(
						await mightyNetERC1155Upgradeable.balanceOf(
							player1.address,
							token2Id
						)
					).to.equal(tokenQuantity);

					await mightyNetERC1155Upgradeable
						.connect(burner)
						.burn(player1.address, token1Id, burnQuantity);

					// Token 1 should have some value burned away
					expect(
						await mightyNetERC1155Upgradeable.balanceOf(
							player1.address,
							token1Id
						)
					).to.equal(tokenQuantity - burnQuantity);

					// Token 2 should remain the same
					expect(
						await mightyNetERC1155Upgradeable.balanceOf(
							player1.address,
							token2Id
						)
					).to.equal(tokenQuantity);
				});
			});

			describe("Batch Burning", () => {
				let player1: SignerWithAddress,
					minter: SignerWithAddress,
					burner: SignerWithAddress;
				let mightyNetERC1155Upgradeable: MightyNetERC1155Upgradeable;

				const token1Id = 1;
				const token2Id = 2;
				const token1Quantity = 10;
				const token2Quantity = 20;
				const burnToken1Quantity = 5;
				const burnToken2Quantity = 12;
				const overBurnToken1Quantity = 15;

				const tokenIds = [token1Id, token2Id];
				const tokenQuantities = [token1Quantity, token2Quantity];
				const burnQuantities = [burnToken1Quantity, burnToken2Quantity];

				beforeEach(async () => {
					const {
						contract,
						player1Signer,
						minterSigner,
						burnerSigner,
					} = testFixture;
					player1 = player1Signer;
					minter = minterSigner;
					burner = burnerSigner;
					mightyNetERC1155Upgradeable = contract;
					await mightyNetERC1155Upgradeable.grantRole(
						minterRole,
						minter.address
					);
					await mightyNetERC1155Upgradeable.grantRole(
						burnerRole,
						burner.address
					);

					// Mint token 1 & 2 to player 1 before every test
					await mightyNetERC1155Upgradeable
						.connect(minter)
						.mintBatch(player1.address, tokenIds, tokenQuantities);
				});

				it("should batch burn Token 1 and 2", async () => {
					expect(
						await mightyNetERC1155Upgradeable.balanceOf(
							player1.address,
							token1Id
						)
					).to.equal(token1Quantity);

					expect(
						await mightyNetERC1155Upgradeable.balanceOf(
							player1.address,
							token2Id
						)
					).to.equal(token2Quantity);

					await mightyNetERC1155Upgradeable
						.connect(burner)
						.burnBatch(player1.address, tokenIds, burnQuantities);

					expect(
						await mightyNetERC1155Upgradeable.balanceOfBatch(
							[player1.address, player1.address],
							[token1Id, token2Id]
						)
					).to.deep.equal([
						BigNumber.from(token1Quantity - burnToken1Quantity),
						BigNumber.from(token2Quantity - burnToken2Quantity),
					]);
				});

				it("only burner approved should be able to batch burn the Tokens", async () => {
					await expect(
						mightyNetERC1155Upgradeable
							.connect(player1)
							.burnBatch(
								player1.address,
								tokenIds,
								tokenQuantities
							)
					).to.be.revertedWith(
						`AccessControl: account ${player1.address.toLowerCase()} is missing role ${burnerRole}`
					);

					// Tokens should still exist
					expect(
						await mightyNetERC1155Upgradeable.balanceOfBatch(
							[player1.address, player1.address],
							[token1Id, token2Id]
						)
					).to.deep.equal([
						BigNumber.from(token1Quantity),
						BigNumber.from(token2Quantity),
					]);
				});

				it("Burn should not exceed hold amount", async () => {
					await expect(
						mightyNetERC1155Upgradeable
							.connect(burner)
							.burnBatch(
								player1.address,
								[token1Id, token2Id],
								[overBurnToken1Quantity, burnToken2Quantity]
							)
					).to.be.revertedWith(
						"ERC1155: burn amount exceeds balance"
					);

					// Tokens should still exist
					expect(
						await mightyNetERC1155Upgradeable.balanceOfBatch(
							[player1.address, player1.address],
							[token1Id, token2Id]
						)
					).to.deep.equal([
						BigNumber.from(token1Quantity),
						BigNumber.from(token2Quantity),
					]);
				});

				it("burner should not be able to batch mint, and vice versa", async () => {
					await expect(
						mightyNetERC1155Upgradeable
							.connect(burner)
							.mintBatch(
								player1.address,
								tokenIds,
								tokenQuantities
							)
					).to.be.revertedWith(
						`AccessControl: account ${burner.address.toLowerCase()} is missing role ${minterRole}`
					);

					await expect(
						mightyNetERC1155Upgradeable
							.connect(minter)
							.burnBatch(
								player1.address,
								tokenIds,
								tokenQuantities
							)
					).to.be.revertedWith(
						`AccessControl: account ${minter.address.toLowerCase()} is missing role ${burnerRole}`
					);
				});
			});

			//Take into acconunt transfer more than what the player have
			describe("Transfers", () => {
				let player1: SignerWithAddress,
					player2: SignerWithAddress,
					minter: SignerWithAddress,
					operator: SignerWithAddress;
				let mightyNetERC1155Upgradeable: MightyNetERC1155Upgradeable;

				const token1Id = 1;
				const tokenQuantity = 10;
				const transferAmount = 5;
				const overTransferAmount = 15;

				beforeEach(async () => {
					const {
						contract,
						player1Signer,
						player2Signer,
						minterSigner,
						operatorSigner,
					} = testFixture;

					player1 = player1Signer;
					player2 = player2Signer;
					minter = minterSigner;
					operator = operatorSigner;
					mightyNetERC1155Upgradeable = contract;
					await mightyNetERC1155Upgradeable.grantRole(
						minterRole,
						minter.address
					);

					// Mint token 1 to player 1 before every test
					await mightyNetERC1155Upgradeable
						.connect(minter)
						.mint(player1.address, token1Id, tokenQuantity);
				});

				it("should allow transfer MightyNetERC1155Upgradeable token by non-filtered operator", async () => {
					// 10 Token 1 should be owned by player 1
					expect(
						await mightyNetERC1155Upgradeable.balanceOf(
							player1.address,
							token1Id
						)
					).to.equal(tokenQuantity);

					// Grant approval to operator
					await mightyNetERC1155Upgradeable
						.connect(player1)
						.setApprovalForAll(operator.address, true);

					// Check if operator is approved
					expect(
						await mightyNetERC1155Upgradeable.isApprovedForAll(
							player1.address,
							operator.address
						)
					).to.be.equal(true);

					await mightyNetERC1155Upgradeable
						.connect(operator)
					["safeTransferFrom(address,address,uint256,uint256)"](
						player1.address,
						player2.address,
						token1Id,
						transferAmount
					);

					// Player 2 should have transfer amount of token 1
					expect(
						await mightyNetERC1155Upgradeable.balanceOf(
							player2.address,
							token1Id
						)
					).to.equal(transferAmount);

					// Player 1 should have the transferred amount of token 1 deducted
					expect(
						await mightyNetERC1155Upgradeable.balanceOf(
							player1.address,
							token1Id
						)
					).to.equal(tokenQuantity - transferAmount);
				});

				it("should revert transfer MightyNetERC1155Upgradeables by filtered operator", async () => {
					// 10 Token 1 should be owned by player 1
					expect(
						await mightyNetERC1155Upgradeable.balanceOf(
							player1.address,
							token1Id
						)
					).to.equal(tokenQuantity);

					// Grant approval to operator
					await mightyNetERC1155Upgradeable
						.connect(player1)
						.setApprovalForAll(operator.address, true);

					// Check if operator is approved
					expect(
						await mightyNetERC1155Upgradeable.isApprovedForAll(
							player1.address,
							operator.address
						)
					).to.be.equal(true);

					// Add operator to the filtered operators
					await operatorFilterRegistry.updateOperator(
						mightyNetERC1155Upgradeable.address,
						operator.address,
						true
					);

					await expect(
						mightyNetERC1155Upgradeable
							.connect(operator)
						[
							"safeTransferFrom(address,address,uint256,uint256)"
						](
							player1.address,
							player2.address,
							token1Id,
							transferAmount
						)
					).to.be.revertedWith(
						`AddressFiltered("${operator.address}")`
					);
				});

				it("should transfer MightyNetERC1155Upgradeable token from player to player", async () => {
					// 10 Token 1 should be owned by player 1
					expect(
						await mightyNetERC1155Upgradeable.balanceOf(
							player1.address,
							token1Id
						)
					).to.equal(tokenQuantity);

					await mightyNetERC1155Upgradeable
						.connect(player1)
					["safeTransferFrom(address,address,uint256,uint256)"](
						player1.address,
						player2.address,
						token1Id,
						transferAmount
					);

					// Player 2 should have transferred amount
					expect(
						await mightyNetERC1155Upgradeable.balanceOf(
							player2.address,
							token1Id
						)
					).to.equal(transferAmount);

					// Player 1 should have transferred amount deducted
					expect(
						await mightyNetERC1155Upgradeable.balanceOf(
							player2.address,
							token1Id
						)
					).to.equal(tokenQuantity - transferAmount);
				});

				it("should revert transfer if signer is not the owner of the token", async () => {
					await expect(
						mightyNetERC1155Upgradeable[
							"safeTransferFrom(address,address,uint256,uint256)"
						](
							player1.address,
							player2.address,
							token1Id,
							transferAmount
						)
					).to.be.revertedWith(
						"ERC1155: caller is not token owner or approved"
					);
				});

				it("should revert transfer when paused", async () => {
					await mightyNetERC1155Upgradeable.pause();

					await expect(
						mightyNetERC1155Upgradeable
							.connect(player1)
						[
							"safeTransferFrom(address,address,uint256,uint256)"
						](
							player1.address,
							player2.address,
							token1Id,
							transferAmount
						)
					).to.be.revertedWith("Pausable: paused");

					await mightyNetERC1155Upgradeable.unpause();

					await mightyNetERC1155Upgradeable
						.connect(player1)
					["safeTransferFrom(address,address,uint256,uint256)"](
						player1.address,
						player2.address,
						token1Id,
						transferAmount
					);

					// Player 2 should have transferred amount
					expect(
						await mightyNetERC1155Upgradeable.balanceOf(
							player2.address,
							token1Id
						)
					).to.equal(transferAmount);

					// Player 1 should have transferred amount deducted
					expect(
						await mightyNetERC1155Upgradeable.balanceOf(
							player1.address,
							token1Id
						)
					).to.equal(tokenQuantity - transferAmount);
				});

				it("should revert transfer if recipient is a contract that does not implement IERC1155ReceiverUpgradeable", async () => {
					// 10 Token 1 should be owned by player 1
					expect(
						await mightyNetERC1155Upgradeable.balanceOf(
							player1.address,
							token1Id
						)
					).to.equal(tokenQuantity);

					const factory = await ethers.getContractFactory("ERC20");
					const erc20 = await factory.deploy("Dummy", "DMY");

					await expect(
						mightyNetERC1155Upgradeable
							.connect(player1)
						[
							"safeTransferFrom(address,address,uint256,uint256)"
						](
							player1.address,
							erc20.address,
							token1Id,
							transferAmount
						)
					).to.be.revertedWith(
						"ERC1155: transfer to non-ERC1155Receiver implementer"
					);
				});

				it("should revert transfer if owner do not have enough token", async () => {
					// 10 Token 1 should be owned by player 1
					expect(
						await mightyNetERC1155Upgradeable.balanceOf(
							player1.address,
							token1Id
						)
					).to.equal(tokenQuantity);

					await expect(
						mightyNetERC1155Upgradeable
							.connect(player1)
						[
							"safeTransferFrom(address,address,uint256,uint256)"
						](
							player1.address,
							player2.address,
							token1Id,
							overTransferAmount
						)
					).to.be.revertedWith(
						"ERC1155: insufficient balance for transfer"
					);

					// 10 Token 1 should be still owned by player 1
					expect(
						await mightyNetERC1155Upgradeable.balanceOf(
							player1.address,
							token1Id
						)
					).to.equal(tokenQuantity);
				});
			});

			describe("Batch Transfers", () => {
				let player1: SignerWithAddress,
					player2: SignerWithAddress,
					minter: SignerWithAddress,
					operator: SignerWithAddress;
				let mightyNetERC1155Upgradeable: MightyNetERC1155Upgradeable;

				const token1Id = 1;
				const token2Id = 2;
				const token1Quantity = 10;
				const token2Quantity = 20;
				const transferToken1Amount = 5;
				const overTransferToken1Amount = 15;
				const transferToken2Amount = 8;

				const tokenIds = [token1Id, token2Id];
				const tokenQuantities = [token1Quantity, token2Quantity];
				const transferAmounts = [
					transferToken1Amount,
					transferToken2Amount,
				];

				beforeEach(async () => {
					const {
						contract,
						player1Signer,
						player2Signer,
						minterSigner,
						operatorSigner,
					} = testFixture;

					player1 = player1Signer;
					player2 = player2Signer;
					minter = minterSigner;
					operator = operatorSigner;
					mightyNetERC1155Upgradeable = contract;
					await mightyNetERC1155Upgradeable.grantRole(
						minterRole,
						minter.address
					);

					// Mint token 1 to player 1 before every test
					await mightyNetERC1155Upgradeable
						.connect(minter)
						.mintBatch(player1.address, tokenIds, tokenQuantities);
				});

				it("should allow transfer MightyNetERC1155Upgradeable token by non-filtered operator", async () => {
					// Token 1 and 2 should be owned by player 1
					expect(
						await mightyNetERC1155Upgradeable.balanceOfBatch(
							[player1.address, player1.address],
							[token1Id, token2Id]
						)
					).to.deep.equal([
						BigNumber.from(token1Quantity),
						BigNumber.from(token2Quantity),
					]);

					// Grant approval to operator
					await mightyNetERC1155Upgradeable
						.connect(player1)
						.setApprovalForAll(operator.address, true);

					// Check if operator is approved
					expect(
						await mightyNetERC1155Upgradeable.isApprovedForAll(
							player1.address,
							operator.address
						)
					).to.be.equal(true);

					await mightyNetERC1155Upgradeable
						.connect(operator)
					[
						"safeBatchTransferFrom(address,address,uint256[],uint256[])"
					](
						player1.address,
						player2.address,
						tokenIds,
						transferAmounts
					);

					// Player 1 should have transferred amount deducted
					expect(
						await mightyNetERC1155Upgradeable.balanceOfBatch(
							[player1.address, player1.address],
							[token1Id, token2Id]
						)
					).to.deep.equal([
						BigNumber.from(token1Quantity - transferToken1Amount),
						BigNumber.from(token2Quantity - transferToken2Amount),
					]);

					// Player 2 should have transferred amount
					expect(
						await mightyNetERC1155Upgradeable.balanceOfBatch(
							[player2.address, player2.address],
							[token1Id, token2Id]
						)
					).to.deep.equal([
						BigNumber.from(transferToken1Amount),
						BigNumber.from(transferToken2Amount),
					]);
				});

				it("should revert transfer MightyNetERC1155Upgradeables by filtered operator", async () => {
					// Token 1 and 2 should be owned by player 1
					expect(
						await mightyNetERC1155Upgradeable.balanceOfBatch(
							[player1.address, player1.address],
							[token1Id, token2Id]
						)
					).to.deep.equal([
						BigNumber.from(token1Quantity),
						BigNumber.from(token2Quantity),
					]);

					// Grant approval to operator
					await mightyNetERC1155Upgradeable
						.connect(player1)
						.setApprovalForAll(operator.address, true);

					// Check if operator is approved
					expect(
						await mightyNetERC1155Upgradeable.isApprovedForAll(
							player1.address,
							operator.address
						)
					).to.be.equal(true);

					// Add operator to the filtered operators
					await operatorFilterRegistry.updateOperator(
						mightyNetERC1155Upgradeable.address,
						operator.address,
						true
					);

					await expect(
						mightyNetERC1155Upgradeable
							.connect(operator)
						[
							"safeBatchTransferFrom(address,address,uint256[],uint256[])"
						](
							player1.address,
							player2.address,
							tokenIds,
							transferAmounts
						)
					).to.be.revertedWith(
						`AddressFiltered("${operator.address}")`
					);
				});

				it("should batch transfer MightyNetERC1155Upgradeable token from player to player", async () => {
					// Token 1 and 2 should be owned by player 1
					expect(
						await mightyNetERC1155Upgradeable.balanceOfBatch(
							[player1.address, player1.address],
							[token1Id, token2Id]
						)
					).to.deep.equal([
						BigNumber.from(token1Quantity),
						BigNumber.from(token2Quantity),
					]);

					await mightyNetERC1155Upgradeable
						.connect(player1)
					[
						"safeBatchTransferFrom(address,address,uint256[],uint256[])"
					](
						player1.address,
						player2.address,
						tokenIds,
						transferAmounts
					);

					// Player 1 should have transferred amount deducted
					expect(
						await mightyNetERC1155Upgradeable.balanceOfBatch(
							[player1.address, player1.address],
							[token1Id, token2Id]
						)
					).to.deep.equal([
						BigNumber.from(token1Quantity - transferToken1Amount),
						BigNumber.from(token2Quantity - transferToken2Amount),
					]);

					// Player 2 should have transferred amount
					expect(
						await mightyNetERC1155Upgradeable.balanceOfBatch(
							[player2.address, player2.address],
							[token1Id, token2Id]
						)
					).to.deep.equal([
						BigNumber.from(transferToken1Amount),
						BigNumber.from(transferToken2Amount),
					]);
				});

				it("should revert batch transfer if signer is not the owner of the token", async () => {
					await expect(
						mightyNetERC1155Upgradeable[
							"safeBatchTransferFrom(address,address,uint256[],uint256[])"
						](
							player1.address,
							player2.address,
							tokenIds,
							transferAmounts
						)
					).to.be.revertedWith(
						"ERC1155: caller is not token owner or approved"
					);
				});

				it("should revert transfer when paused", async () => {
					await mightyNetERC1155Upgradeable.pause();

					await expect(
						mightyNetERC1155Upgradeable
							.connect(player1)
						[
							"safeBatchTransferFrom(address,address,uint256[],uint256[])"
						](
							player1.address,
							player2.address,
							tokenIds,
							transferAmounts
						)
					).to.be.revertedWith("Pausable: paused");

					await mightyNetERC1155Upgradeable.unpause();

					await mightyNetERC1155Upgradeable
						.connect(player1)
					[
						"safeBatchTransferFrom(address,address,uint256[],uint256[])"
					](
						player1.address,
						player2.address,
						tokenIds,
						transferAmounts
					);

					// Player 1 should have transferred amount deducted
					expect(
						await mightyNetERC1155Upgradeable.balanceOfBatch(
							[player1.address, player1.address],
							[token1Id, token2Id]
						)
					).to.deep.equal([
						BigNumber.from(token1Quantity - transferToken1Amount),
						BigNumber.from(token2Quantity - transferToken2Amount),
					]);

					// Player 2 should have transferred amount
					expect(
						await mightyNetERC1155Upgradeable.balanceOfBatch(
							[player2.address, player2.address],
							[token1Id, token2Id]
						)
					).to.deep.equal([
						BigNumber.from(transferToken1Amount),
						BigNumber.from(transferToken2Amount),
					]);
				});

				it("should revert transfer if recipient is a contract that does not implement IERC721Receiver", async () => {
					// Token 1 and 2 should be owned by player 1
					expect(
						await mightyNetERC1155Upgradeable.balanceOfBatch(
							[player1.address, player1.address],
							[token1Id, token2Id]
						)
					).to.deep.equal([
						BigNumber.from(token1Quantity),
						BigNumber.from(token2Quantity),
					]);

					const factory = await ethers.getContractFactory("ERC20");
					const erc20 = await factory.deploy("Dummy", "DMY");

					await expect(
						mightyNetERC1155Upgradeable
							.connect(player1)
						[
							"safeBatchTransferFrom(address,address,uint256[],uint256[])"
						](
							player1.address,
							erc20.address,
							tokenIds,
							transferAmounts
						)
					).to.be.revertedWith(
						"ERC1155: transfer to non-ERC1155Receiver implementer"
					);
				});

				it("should revert transfer if owner do not have enough token", async () => {
					// Token 1 and 2 should be owned by player 1
					expect(
						await mightyNetERC1155Upgradeable.balanceOfBatch(
							[player1.address, player1.address],
							[token1Id, token2Id]
						)
					).to.deep.equal([
						BigNumber.from(token1Quantity),
						BigNumber.from(token2Quantity),
					]);

					await expect(
						mightyNetERC1155Upgradeable
							.connect(player1)
						[
							"safeBatchTransferFrom(address,address,uint256[],uint256[])"
						](
							player1.address,
							player2.address,
							[token1Id, token2Id],
							[overTransferToken1Amount, transferToken2Amount]
						)
					).to.be.revertedWith(
						"ERC1155: insufficient balance for transfer"
					);

					// Token 1 and 2 should still be owned by player 1
					expect(
						await mightyNetERC1155Upgradeable.balanceOfBatch(
							[player1.address, player1.address],
							[token1Id, token2Id]
						)
					).to.deep.equal([
						BigNumber.from(token1Quantity),
						BigNumber.from(token2Quantity),
					]);
				});
			});

			describe("Queries", () => {
				let player1: SignerWithAddress,
					player2: SignerWithAddress,
					minter: SignerWithAddress;
				let mightyNetERC1155Upgradeable: MightyNetERC1155Upgradeable;

				const token1Id = 1;
				const token1Quantity = 10;
				const token2Id = 2;
				const token2Quantity = 20;
				const transferAmount = 5;

				const tokenIds = [token1Id, token2Id];
				const tokenQuantities = [token1Quantity, token2Quantity];

				beforeEach(async () => {
					const {
						contract,
						player1Signer,
						player2Signer,
						minterSigner,
					} = testFixture;

					player1 = player1Signer;
					player2 = player2Signer;
					minter = minterSigner;
					mightyNetERC1155Upgradeable = contract;
					await mightyNetERC1155Upgradeable.grantRole(
						minterRole,
						minter.address
					);

					// Mint token 1 & 2 to player 1 before every test
					await mightyNetERC1155Upgradeable
						.connect(minter)
						.mintBatch(player1.address, tokenIds, tokenQuantities);
				});

				it("should return balance of token 1 of MightyNetERC1155Upgradeables as anyone", async () => {
					expect(
						await mightyNetERC1155Upgradeable.balanceOf(
							player1.address,
							token1Id
						)
					).to.be.equal(token1Quantity);

					expect(
						await mightyNetERC1155Upgradeable
							.connect(player2)
							.balanceOf(player1.address, token1Id)
					).to.be.equal(token1Quantity);
				});

				it("should return new token balance of transferred Token", async () => {
					// Transfer Token 1 from player 1 to player 2
					await mightyNetERC1155Upgradeable
						.connect(player1)
					["safeTransferFrom(address,address,uint256,uint256)"](
						player1.address,
						player2.address,
						token1Id,
						transferAmount
					);

					expect(
						await mightyNetERC1155Upgradeable.balanceOf(
							player1.address,
							token1Id
						)
					).to.equal(token1Quantity - transferAmount);
					expect(
						await mightyNetERC1155Upgradeable.balanceOf(
							player2.address,
							token1Id
						)
					).to.equal(transferAmount);
				});

				it("should return balance of token 1 & 2of MightyNetERC1155Upgradeables as anyone", async () => {
					expect(
						await mightyNetERC1155Upgradeable.balanceOfBatch(
							[player1.address, player1.address],
							[token1Id, token2Id]
						)
					).to.deep.equal([
						BigNumber.from(token1Quantity),
						BigNumber.from(token2Quantity),
					]);

					expect(
						await mightyNetERC1155Upgradeable
							.connect(player2)
							.balanceOfBatch(
								[player1.address, player1.address],
								[token1Id, token2Id]
							)
					).to.deep.equal([
						BigNumber.from(token1Quantity),
						BigNumber.from(token2Quantity),
					]);
				});
			});

			describe("Metadata", () => {
				const newBaseUri =
					"https://mightynet.xyz/metadata/v2/"
				const newContractUri =
					"https://mightynet.xyz/metadata/v2/";

				let owner: SignerWithAddress,
					player1: SignerWithAddress,
					minter: SignerWithAddress;
				let mightyNetERC1155Upgradeable: MightyNetERC1155Upgradeable;

				const tokenId = 1;
				const tokenQuantity = 1;

				beforeEach(async () => {
					const {
						ownerSigner,
						contract,
						player1Signer,
						minterSigner,
					} = testFixture;
					owner = ownerSigner;
					player1 = player1Signer;
					minter = minterSigner;
					mightyNetERC1155Upgradeable = contract;
				});

				it("should return correct metadata URI of MightyNetERC1155Upgradable token", async () => {
					await mightyNetERC1155Upgradeable.grantRole(
						minterRole,
						minter.address
					);

					await mightyNetERC1155Upgradeable
						.connect(minter)
						.mint(player1.address, tokenId, tokenQuantity);

					expect(
						await mightyNetERC1155Upgradeable.uri(tokenId)
					).to.be.equal(baseUri + mightyNetERC1155Upgradeable.address.toLowerCase() + "/{id}");
				});

				it("should be able set base URI as admin", async () => {
					await mightyNetERC1155Upgradeable.setBaseURI(newBaseUri);

					expect(
						await mightyNetERC1155Upgradeable.uri(tokenId)
					).to.be.equal(newBaseUri + mightyNetERC1155Upgradeable.address.toLowerCase() + "/{id}");
				});

				it("only admins should be able to set base URI", async () => {
					await expect(
						mightyNetERC1155Upgradeable
							.connect(player1)
							.setBaseURI(newBaseUri)
					).to.be.reverted;

					// Base URI should not have changed
					expect(
						await mightyNetERC1155Upgradeable.uri(tokenId)
					).to.be.equal(baseUri + mightyNetERC1155Upgradeable.address.toLowerCase() + "/{id}");
				});

				it("should be able to set contract URI as admin", async () => {
					await mightyNetERC1155Upgradeable.setContractURI(
						newContractUri
					);

					expect(
						await mightyNetERC1155Upgradeable.contractURI()
					).to.be.equal(newContractUri + mightyNetERC1155Upgradeable.address.toLowerCase());
				});

				it("only admins should be able to set contract URI", async () => {
					await expect(
						mightyNetERC1155Upgradeable
							.connect(player1)
							.setContractURI(contractUri + mightyNetERC1155Upgradeable.address.toLowerCase())
					).to.be.reverted;

					// Contract URI should not have changed
					expect(
						await mightyNetERC1155Upgradeable.contractURI()
					).to.be.equal(contractUri + mightyNetERC1155Upgradeable.address.toLowerCase());
				});
			});

			describe("Upgrade", () => {
				let player1: SignerWithAddress,
					player2: SignerWithAddress,
					minter: SignerWithAddress,
					proxyUpgradeAdmin: SignerWithAddress;
				let mightyNetERC1155Upgradeable: MightyNetERC1155Upgradeable;

				let mightyNetERC1155UpgradeableUpgrade: MightyNetERC1155Upgradeable;

				let tokenId = 1;
				let tokenQuantity = 10;

				beforeEach(async () => {
					const {
						contract,
						player1Signer,
						player2Signer,
						minterSigner,
						proxyUpgradeAdminSigner,
					} = testFixture;

					player1 = player1Signer;
					player2 = player2Signer;
					minter = minterSigner;
					proxyUpgradeAdmin = proxyUpgradeAdminSigner;

					mightyNetERC1155Upgradeable = contract;

					setTransparentUpgradeableProxyAdmin(
						mightyNetERC1155Upgradeable.address,
						proxyUpgradeAdmin,
						originalProxyAdminAddress
					);

					await mightyNetERC1155Upgradeable.grantRole(
						minterRole,
						minter.address
					);

					// Mint token 1 & 2 to player 1 before every test
					await mightyNetERC1155Upgradeable
						.connect(minter)
						.mint(player1.address, tokenId, tokenQuantity);

					// Upgrade contract to MightyNetERC1155Upgradeable V2
					const factory = await ethers.getContractFactory(
						contractName
					);

					const mightyNetERC1155UpgradeableContract =
						await upgrades.upgradeProxy(
							mightyNetERC1155Upgradeable.address,
							factory
						);

					mightyNetERC1155UpgradeableUpgrade = factory.attach(
						mightyNetERC1155UpgradeableContract.address
					) as MightyNetERC1155Upgradeable;
				});

				it("should upgrade successfully", async () => {
					expect(mightyNetERC1155UpgradeableUpgrade).to.not.be
						.undefined;
				});

				it("should carry over state", async () => {
					// Base and contract URI should be carried over
					expect(
						await mightyNetERC1155UpgradeableUpgrade.uri(0)
					).to.be.equal(baseUri + mightyNetERC1155Upgradeable.address.toLowerCase() + "/{id}");
					expect(
						await mightyNetERC1155UpgradeableUpgrade.contractURI()
					).to.be.equal(contractUri + mightyNetERC1155Upgradeable.address.toLowerCase());

					// Minter should be carried over
					expect(
						await mightyNetERC1155Upgradeable.hasRole(
							minterRole,
							minter.address
						)
					).to.be.equal(true);

					// Token ownership should be carried over
					expect(
						await mightyNetERC1155UpgradeableUpgrade.balanceOf(
							player1.address,
							tokenId
						)
					).to.be.equal(tokenQuantity);
				});

				it("should be able to call mint setter functions and mint", async () => {
					await mightyNetERC1155UpgradeableUpgrade.grantRole(
						minterRole,
						player1.address
					);
					expect(
						await mightyNetERC1155UpgradeableUpgrade.hasRole(
							minterRole,
							player1.address
						)
					).to.be.equal(true);

					await mightyNetERC1155UpgradeableUpgrade.revokeRole(
						minterRole,
						minter.address
					);
					expect(
						await mightyNetERC1155UpgradeableUpgrade.hasRole(
							minterRole,
							minter.address
						)
					).to.be.equal(false);

					await expect(
						mightyNetERC1155UpgradeableUpgrade
							.connect(minter)
							.mint(player1.address, tokenId, tokenQuantity)
					).to.be.revertedWith(
						`AccessControl: account ${minter.address.toLowerCase()} is missing role ${minterRole}`
					);

					await mightyNetERC1155UpgradeableUpgrade
						.connect(player1)
						.mint(player1.address, tokenId, tokenQuantity);

					expect(
						await mightyNetERC1155UpgradeableUpgrade.balanceOf(
							player1.address,
							tokenId
						)
					).to.be.equal(2 * tokenQuantity);
				});
			});
		});
	});
});
