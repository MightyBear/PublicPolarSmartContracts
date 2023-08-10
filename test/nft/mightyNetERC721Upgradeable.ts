/*
 * Copyright (c) 2023 Mighty Bear Games
 */

import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { BytesLike } from "ethers";
import { ethers, upgrades } from "hardhat";
import {
	OperatorFilterRegistry,
	MightyNetERC721RestrictedRegistry,
	MightyNetERC721Upgradeable,
} from "../../typechain";
import {
	deployOperatorFilterRegistry,
	setProxyAdmin,
	setTransparentUpgradeableProxyAdmin,
} from "./utils/testHelper";
import { deployUpgradeable } from "./utils/deploy";
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("MightyNetERC721Upgradeable Tests", async () => {
	let contractNameArray: Array<string> = ["MightyActionHeroesGadget", "MightyActionHeroesHeroes"];

	contractNameArray.forEach(contractName => {
		describe(contractName, () => {
			const baseUri = "https://mightyverse.com/api/" + contractName + "/";
			const contractUri = "https://mightyverse.com/api/" + contractName;
			let mightyNetERC721UpgradeableContract: MightyNetERC721Upgradeable;

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
			let minterRole: BytesLike;

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

				const operatorFilterRegistry =
					await deployOperatorFilterRegistry();
				const restrictedRegistry = (await deployUpgradeable(
					"MightyNetERC721RestrictedRegistry",
					"initialize"
				)) as MightyNetERC721RestrictedRegistry;
				await restrictedRegistry.grantRole(
					await restrictedRegistry.RESTRICTOR_ROLE(),
					restrictor.address
				);

				// Deploy MightyNetERC721Upgradeable contract
				const contract = (await deployUpgradeable(
					contractName,
					"initialize",
					baseUri,
					contractUri,
					operatorFilterRegistry.address,
					restrictedRegistry.address
				)) as MightyNetERC721Upgradeable;

				await contract.deployed();

				adminRole = await contract.DEFAULT_ADMIN_ROLE();
				minterRole = await contract.MINTER_ROLE();

				originalProxyAdminAddress = (await upgrades.admin.getInstance())
					.address;

				setProxyAdmin(
					originalProxyAdminAddress,
					owner,
					contract.address,
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
					contract: contract,
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
					contract,
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
				mightyNetERC721UpgradeableContract = contract;
			});

			describe("Deployment", () => {
				it("should be owned by deployer", async () => {
					expect(
						await mightyNetERC721UpgradeableContract.owner()
					).to.be.equal(owner.address);
				});

				it("should have correct baseURI", async () => {
					expect(
						await mightyNetERC721UpgradeableContract.baseURI()
					).to.be.equal(baseUri);
				});

				it("should have correct contractURI", async () => {
					expect(
						await mightyNetERC721UpgradeableContract.contractURI()
					).to.be.equal(contractUri);
				});

				it("should have correct operator filter registry address", async () => {
					expect(
						await mightyNetERC721UpgradeableContract.operatorFilterRegistry()
					).to.be.equal(operatorFilterRegistry.address);
				});

				it("should have default royalty", async () => {
					const price = ethers.utils.parseEther("1");

					const royaltyInfo =
						await mightyNetERC721UpgradeableContract.royaltyInfo(
							1,
							price
						);

					expect(royaltyInfo[0]).to.be.equal(owner.address);
					expect(royaltyInfo[1]).to.be.equal(
						ethers.utils.parseEther("0.075")
					);
				});

				it("should be unpaused", async () => {
					expect(await mightyNetERC721UpgradeableContract.paused()).to
						.be.false;
				});
			});

			describe("Administration", () => {
				it("should pause and unpause contract", async () => {
					await mightyNetERC721UpgradeableContract.pause();

					expect(await mightyNetERC721UpgradeableContract.paused()).to
						.be.true;

					await mightyNetERC721UpgradeableContract.unpause();

					expect(await mightyNetERC721UpgradeableContract.paused()).to
						.be.false;
				});

				it("only admins should be able to pause and unpause", async () => {
					await expect(
						mightyNetERC721UpgradeableContract
							.connect(player1)
							.pause()
					).to.be.reverted;

					await mightyNetERC721UpgradeableContract.pause();

					await expect(
						mightyNetERC721UpgradeableContract
							.connect(player1)
							.unpause()
					).to.be.reverted;
				});

				it("should grant admin role", async () => {
					await mightyNetERC721UpgradeableContract.grantRole(
						adminRole,
						player1.address
					);

					expect(
						await mightyNetERC721UpgradeableContract.hasRole(
							adminRole,
							player1.address
						)
					).to.be.true;
				});

				it("only admins should be able to grant roles", async () => {
					await expect(
						mightyNetERC721UpgradeableContract
							.connect(player1)
							.grantRole(adminRole, player1.address)
					).to.be.reverted;
				});

				it("should grant minter address", async () => {
					await mightyNetERC721UpgradeableContract.grantRole(
						minterRole,
						minter.address
					);

					expect(
						await mightyNetERC721UpgradeableContract.hasRole(
							minterRole,
							minter.address
						)
					).to.be.equal(true);
				});

				it("only admins should be able to set minter address", async () => {
					await expect(
						mightyNetERC721UpgradeableContract
							.connect(player1)
							.grantRole(minterRole, minter.address)
					).to.be.reverted;

					// Minter should still be zero address
					expect(
						await mightyNetERC721UpgradeableContract.hasRole(
							minterRole,
							minter.address
						)
					).to.be.equal(false);
				});

				it("should transfer ownership", async () => {
					await mightyNetERC721UpgradeableContract.transferOwnership(
						player1.address
					);

					expect(
						await mightyNetERC721UpgradeableContract.owner()
					).to.be.equal(player1.address);
				});

				it("only owner should be able to transfer ownership", async () => {
					await expect(
						mightyNetERC721UpgradeableContract
							.connect(player1)
							.transferOwnership(player1.address)
					).to.be.revertedWith("Ownable: caller is not the owner");

					// Contract should still be owned by the original owner
					expect(
						await mightyNetERC721UpgradeableContract.owner()
					).to.be.equal(owner.address);
				});
			});

			describe("Minting", () => {
				const tokenId = 1;

				beforeEach(async () => {
					mightyNetERC721UpgradeableContract.grantRole(
						minterRole,
						minter.address
					);
				});

				it("should mint MightyNetERC721Upgradeable for player", async () => {
					await mightyNetERC721UpgradeableContract
						.connect(minter)
						.mint(player1.address, tokenId);

					// MightyNetERC721Upgradeable should now exist
					expect(
						await mightyNetERC721UpgradeableContract.exists(tokenId)
					).to.be.true;

					// MightyNetERC721Upgradeable should be owned by player 1
					expect(
						await mightyNetERC721UpgradeableContract.ownerOf(
							tokenId
						)
					).to.be.equal(player1.address);
				});

				it("only minter should be able to mint", async () => {
					await expect(
						mightyNetERC721UpgradeableContract.mint(
							player1.address,
							tokenId
						)
					).to.be.revertedWith(
						`AccessControl: account ${owner.address.toLowerCase()} is missing role ${minterRole}`
					);

					await mightyNetERC721UpgradeableContract
						.connect(minter)
						.mint(player1.address, tokenId);
				});

				it("should revert mint when paused", async () => {
					await mightyNetERC721UpgradeableContract.pause();

					await expect(
						mightyNetERC721UpgradeableContract
							.connect(minter)
							.mint(player1.address, 1)
					).to.be.revertedWith("Pausable: paused");

					await mightyNetERC721UpgradeableContract.unpause();

					await mightyNetERC721UpgradeableContract
						.connect(minter)
						.mint(player1.address, tokenId);
				});
			});

			describe("Burning", () => {
				beforeEach(async () => {
					mightyNetERC721UpgradeableContract.grantRole(
						minterRole,
						minter.address
					);
				});

				it("should burn MightyNetERC721Upgradeable", async () => {
					const tokenId = 1;

					await mightyNetERC721UpgradeableContract
						.connect(minter)
						.mint(player1.address, tokenId);

					// MightyNetERC721Upgradeable should be owned by player 1
					expect(
						await mightyNetERC721UpgradeableContract.ownerOf(
							tokenId
						)
					).to.be.equal(player1.address);

					await mightyNetERC721UpgradeableContract
						.connect(player1)
						.burn(tokenId);

					// MightyNetERC721Upgradeable should be owned by nobody
					expect(
						await mightyNetERC721UpgradeableContract.exists(tokenId)
					).to.be.false;
				});

				it("only admins should be able to burn the MightyNetERC721Upgradeable", async () => {
					const tokenId = 1;

					await mightyNetERC721UpgradeableContract
						.connect(minter)
						.mint(player1.address, tokenId);

					await expect(
						mightyNetERC721UpgradeableContract.burn(tokenId)
					).to.be.revertedWith(
						"ERC721: caller is not token owner or approved"
					);

					// MightyNetERC721Upgradeable should still exist
					expect(
						await mightyNetERC721UpgradeableContract.exists(tokenId)
					).to.be.true;
					// MightyNetERC721Upgradeable should still be owned by player 1
					expect(
						await mightyNetERC721UpgradeableContract.ownerOf(
							tokenId
						)
					).to.be.equal(player1.address);
				});
			});

			describe("Transfers", () => {
				beforeEach(async () => {
					mightyNetERC721UpgradeableContract.grantRole(
						minterRole,
						minter.address
					);
				});

				it("should allow transfer MightyNetERC721Upgradeable by non-filtered operator", async () => {
					const tokenId = 1;

					await mightyNetERC721UpgradeableContract
						.connect(minter)
						.mint(player1.address, tokenId);

					// MightyNetERC721Upgradeable should still be owned by player 1
					expect(
						await mightyNetERC721UpgradeableContract.ownerOf(
							tokenId
						)
					).to.be.equal(player1.address);

					// Grant approval to operator
					await mightyNetERC721UpgradeableContract
						.connect(player1)
						.approve(operator.address, 1);

					// Check if operator is approved
					expect(
						await mightyNetERC721UpgradeableContract.getApproved(
							tokenId
						)
					).to.be.equal(operator.address);

					await mightyNetERC721UpgradeableContract
						.connect(operator)
					["safeTransferFrom(address,address,uint256)"](
						player1.address,
						player2.address,
						tokenId
					);

					// MightyNetERC721Upgradeable should now be owned by player 2
					expect(
						await mightyNetERC721UpgradeableContract.ownerOf(
							tokenId
						)
					).to.be.equal(player2.address);
				});

				it("should revert transfer MightyNetERC721Upgradeable by filtered operator", async () => {
					const tokenId = 1;

					await mightyNetERC721UpgradeableContract
						.connect(minter)
						.mint(player1.address, tokenId);

					// MightyNetERC721Upgradeable should still be owned by player 1
					expect(
						await mightyNetERC721UpgradeableContract.ownerOf(
							tokenId
						)
					).to.be.equal(player1.address);

					// Grant approval to operator
					await mightyNetERC721UpgradeableContract
						.connect(player1)
						.approve(operator.address, 1);

					// Check if operator is approved
					expect(
						await mightyNetERC721UpgradeableContract.getApproved(
							tokenId
						)
					).to.be.equal(operator.address);

					// Add operator to the filtered operators
					await operatorFilterRegistry.updateOperator(
						mightyNetERC721UpgradeableContract.address,
						operator.address,
						true
					);

					await expect(
						mightyNetERC721UpgradeableContract
							.connect(operator)
						["safeTransferFrom(address,address,uint256)"](
							player1.address,
							player2.address,
							tokenId
						)
					).to.be.revertedWith(
						`AddressFiltered("${operator.address}")`
					);
				});

				it("should transfer MightyNetERC721Upgradeable from player to player", async () => {
					const tokenId = 1;

					await mightyNetERC721UpgradeableContract
						.connect(minter)
						.mint(player1.address, tokenId);

					// MightyNetERC721Upgradeable should still be owned by player 1
					expect(
						await mightyNetERC721UpgradeableContract.ownerOf(
							tokenId
						)
					).to.be.equal(player1.address);

					await mightyNetERC721UpgradeableContract
						.connect(player1)
					["safeTransferFrom(address,address,uint256)"](
						player1.address,
						player2.address,
						tokenId
					);

					// MightyNetERC721Upgradeable should now be owned by player 2
					expect(
						await mightyNetERC721UpgradeableContract.ownerOf(
							tokenId
						)
					).to.be.equal(player2.address);
				});

				it("should revert transfer if signer is not the owner of the MightyNetERC721Upgradeable", async () => {
					const tokenId = 1;

					await mightyNetERC721UpgradeableContract
						.connect(minter)
						.mint(player1.address, tokenId);

					await expect(
						mightyNetERC721UpgradeableContract[
							"safeTransferFrom(address,address,uint256)"
						](player1.address, player2.address, tokenId)
					).to.be.revertedWith(
						"ERC721: caller is not token owner or approved"
					);
				});

				it("should revert transfer when paused", async () => {
					const tokenId = 1;

					await mightyNetERC721UpgradeableContract
						.connect(minter)
						.mint(player1.address, tokenId);

					await mightyNetERC721UpgradeableContract.pause();

					await expect(
						mightyNetERC721UpgradeableContract
							.connect(player1)
						["safeTransferFrom(address,address,uint256)"](
							player1.address,
							player2.address,
							tokenId
						)
					).to.be.revertedWith("Pausable: paused");

					await mightyNetERC721UpgradeableContract.unpause();

					mightyNetERC721UpgradeableContract
						.connect(player1)
					["safeTransferFrom(address,address,uint256)"](
						player1.address,
						player2.address,
						tokenId
					);
				});

				it("should revert transfer if recipient is a contract that does not implement IERC721Receiver", async () => {
					const tokenId = 1;

					await mightyNetERC721UpgradeableContract
						.connect(minter)
						.mint(player1.address, tokenId);

					const factory = await ethers.getContractFactory("ERC20");
					const erc20 = await factory.deploy("Dummy", "DMY");

					await expect(
						mightyNetERC721UpgradeableContract
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
					mightyNetERC721UpgradeableContract.grantRole(
						minterRole,
						minter.address
					);
				});

				it("should return owner of MightyNetERC721Upgradeable", async () => {
					await mightyNetERC721UpgradeableContract
						.connect(minter)
						.mint(player1.address, 1);

					expect(
						await mightyNetERC721UpgradeableContract.ownerOf(1)
					).to.be.equal(player1.address);
				});

				it("should return new owner of transferred MightyNetERC721Upgradeable", async () => {
					await mightyNetERC721UpgradeableContract
						.connect(minter)
						.mint(player1.address, 1);

					// Transfer MightyNetERC721Upgradeable from player 2 to player 1
					await mightyNetERC721UpgradeableContract
						.connect(player1)
					["safeTransferFrom(address,address,uint256)"](
						player1.address,
						player2.address,
						1
					);

					expect(
						await mightyNetERC721UpgradeableContract.ownerOf(1)
					).to.be.equal(player2.address);
				});
			});

			describe("Metadata", () => {
				let newBaseUri = "https://mightyverse.com/api/v2/bbs/";
				let newContractUri = "https://mightyverse.com/api/v2/bbs";

				it("should return correct metadata URI of MightyNetERC721Upgradeable", async () => {
					mightyNetERC721UpgradeableContract.grantRole(
						minterRole,
						minter.address
					);

					const tokenId = 1;

					await mightyNetERC721UpgradeableContract
						.connect(minter)
						.mint(player1.address, tokenId);

					// MightyNetERC721Upgradeable should have correct token URI
					expect(
						await mightyNetERC721UpgradeableContract.tokenURI(
							tokenId
						)
					).to.be.equal(
						baseUri +
						mightyNetERC721UpgradeableContract.address.toLowerCase() +
						"/" +
						tokenId
					);
				});

				it("should not return correct metadata URI of MightyNetERC721Upgradeable if tokenId not minted", async () => {
					const tokenId = 1;

					await expect(
						mightyNetERC721UpgradeableContract.tokenURI(tokenId)
					).to.be.revertedWith("ERC721: invalid token ID");
				});

				it("should set base URI", async () => {
					await mightyNetERC721UpgradeableContract.setBaseURI(
						newBaseUri
					);

					expect(
						await mightyNetERC721UpgradeableContract.baseURI()
					).to.be.equal(newBaseUri);
				});

				it("only admins should be able to set base URI", async () => {
					await expect(
						mightyNetERC721UpgradeableContract
							.connect(player1)
							.setBaseURI(newBaseUri)
					).to.be.reverted;

					// Base URI should not have changed
					expect(
						await mightyNetERC721UpgradeableContract.baseURI()
					).to.be.equal(baseUri);
				});

				it("should set contract URI", async () => {
					await mightyNetERC721UpgradeableContract.setContractURI(
						newContractUri
					);

					expect(
						await mightyNetERC721UpgradeableContract.contractURI()
					).to.be.equal(newContractUri);
				});

				it("only admins should be able to set contract URI", async () => {
					await expect(
						mightyNetERC721UpgradeableContract
							.connect(player1)
							.setContractURI(contractUri)
					).to.be.reverted;

					// Contract URI should not have changed
					expect(
						await mightyNetERC721UpgradeableContract.contractURI()
					).to.be.equal(contractUri);
				});
			});

			describe("Royalties", () => {
				it("should set default royalty", async () => {
					// Set default royalty to 8%
					await mightyNetERC721UpgradeableContract.setDefaultRoyalty(
						owner.address,
						800
					);

					const price = ethers.utils.parseEther("1");

					const royaltyInfo =
						await mightyNetERC721UpgradeableContract.royaltyInfo(
							1,
							price
						);

					expect(royaltyInfo[0]).to.be.equal(owner.address);
					expect(royaltyInfo[1]).to.be.equal(
						ethers.utils.parseEther("0.08")
					);
				});

				it("only admins should be able to set default royalty", async () => {
					await expect(
						mightyNetERC721UpgradeableContract
							.connect(player1)
							.setDefaultRoyalty(owner.address, 800)
					).to.be.reverted;
				});

				it("should delete default royalty", async () => {
					await mightyNetERC721UpgradeableContract.deleteDefaultRoyalty();

					const price = ethers.utils.parseEther("1");

					const royaltyInfo =
						await mightyNetERC721UpgradeableContract.royaltyInfo(
							1,
							price
						);

					expect(royaltyInfo[0]).to.be.equal(
						ethers.constants.AddressZero
					);
					expect(royaltyInfo[1]).to.be.equal(
						ethers.utils.parseEther("0")
					);
				});

				it("only admins should be able to delete default royalty", async () => {
					await expect(
						mightyNetERC721UpgradeableContract
							.connect(player1)
							.deleteDefaultRoyalty()
					).to.be.reverted;
				});

				it("should set token royalty", async () => {
					const tokenId = 1;

					await mightyNetERC721UpgradeableContract.setTokenRoyalty(
						tokenId,
						owner.address,
						1000
					);

					const price = ethers.utils.parseEther("1");

					const royaltyInfo =
						await mightyNetERC721UpgradeableContract.royaltyInfo(
							tokenId,
							price
						);

					expect(royaltyInfo[0]).to.be.equal(owner.address);
					expect(royaltyInfo[1]).to.be.equal(
						ethers.utils.parseEther("0.1")
					);
				});

				it("only admins should be able to set token royalty", async () => {
					await expect(
						mightyNetERC721UpgradeableContract
							.connect(player1)
							.setTokenRoyalty(1, owner.address, 1000)
					).to.be.reverted;
				});

				it("token royalty should only apply to that token", async () => {
					await mightyNetERC721UpgradeableContract.setTokenRoyalty(
						1,
						owner.address,
						1000
					);

					const price = ethers.utils.parseEther("1");

					// Get royalty info of token 2 instead
					const royaltyInfo =
						await mightyNetERC721UpgradeableContract.royaltyInfo(
							2,
							price
						);

					expect(royaltyInfo[0]).to.be.equal(owner.address);
					expect(royaltyInfo[1]).to.be.equal(
						ethers.utils.parseEther("0.075")
					);
				});

				it("should reset token royalty", async () => {
					const tokenId = 1;

					await mightyNetERC721UpgradeableContract.setTokenRoyalty(
						tokenId,
						owner.address,
						1000
					);
					await mightyNetERC721UpgradeableContract.resetTokenRoyalty(
						tokenId
					);

					const price = ethers.utils.parseEther("1");

					const royaltyInfo =
						await mightyNetERC721UpgradeableContract.royaltyInfo(
							tokenId,
							price
						);

					expect(royaltyInfo[0]).to.be.equal(owner.address);
					expect(royaltyInfo[1]).to.be.equal(
						ethers.utils.parseEther("0.075")
					);
				});

				it("only admins should be able to reset token royalty", async () => {
					await expect(
						mightyNetERC721UpgradeableContract
							.connect(player1)
							.resetTokenRoyalty(1)
					).to.be.reverted;
				});
			});

			describe("Upgrade", () => {
				let mngUpgrade: MightyNetERC721Upgradeable;

				let tokenId = 1;

				beforeEach(async () => {
					setTransparentUpgradeableProxyAdmin(
						mightyNetERC721UpgradeableContract.address,
						proxyUpgradeAdmin,
						originalProxyAdminAddress
					);

					mightyNetERC721UpgradeableContract.grantRole(
						minterRole,
						minter.address
					);

					await mightyNetERC721UpgradeableContract
						.connect(minter)
						.mint(player1.address, tokenId);

					// Upgrade contract to MightyNetERC721Upgradeable Upgradeable V2
					let factory = await ethers.getContractFactory(contractName);

					const contract = await upgrades.upgradeProxy(
						mightyNetERC721UpgradeableContract.address,
						factory
					);
					mngUpgrade = factory.attach(contract.address);
				});

				it("should upgrade successfully", async () => {
					expect(mngUpgrade).to.not.be.undefined;
				});

				it("should carry over state", async () => {
					// Base and contract URI should be carried over
					expect(await mngUpgrade.baseURI()).to.be.equal(baseUri);
					expect(await mngUpgrade.contractURI()).to.be.equal(
						contractUri
					);

					// Minter role should be carried over
					expect(
						await mngUpgrade.hasRole(minterRole, minter.address)
					).to.be.equal(true);

					// Token ownership should be carried over
					expect(await mngUpgrade.ownerOf(tokenId)).to.be.equal(
						player1.address
					);
				});
			});

			describe("Restriction", () => {
				beforeEach(async () => {
					mightyNetERC721UpgradeableContract.grantRole(
						minterRole,
						minter.address
					);
					await mightyNetERC721UpgradeableContract
						.connect(minter)
						.mint(player1.address, 1);
					await mightyNetERC721UpgradeableContract
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
						.restrict(mightyNetERC721UpgradeableContract.address, [
							1,
						]);

					await expect(
						restrictedRegistry
							.connect(player1)
							.unrestrict(
								mightyNetERC721UpgradeableContract.address,
								[1]
							)
					).to.be.revertedWith(
						`InvalidRestrictor(\"${player1.address}\")`
					);
				});

				it("should not be able to transfer a restricted token", async () => {
					await restrictedRegistry
						.connect(restrictor)
						.restrict(mightyNetERC721UpgradeableContract.address, [
							1,
						]);
					await expect(
						mightyNetERC721UpgradeableContract
							.connect(player1)
							.transferFrom(player1.address, player2.address, 1)
					).to.be.revertedWith("TokenIsRestricted(1)");
				});

				it("should not be able to burn a restricted token", async () => {
					await restrictedRegistry
						.connect(restrictor)
						.restrict(mightyNetERC721UpgradeableContract.address, [
							1,
						]);
					await expect(
						mightyNetERC721UpgradeableContract
							.connect(player1)
							.burn(1)
					).to.be.revertedWith("TokenIsRestricted(1)");
				});

				it("should be able to transfer an unrestricted token", async () => {
					await expect(
						mightyNetERC721UpgradeableContract
							.connect(player1)
							.transferFrom(player1.address, player2.address, 1)
					).to.not.be.reverted;
				});

				it("should be able to burn an unrestricted token", async () => {
					await expect(
						mightyNetERC721UpgradeableContract
							.connect(player1)
							.burn(1)
					).to.not.be.reverted;
				});
			});
		});
	});
});
