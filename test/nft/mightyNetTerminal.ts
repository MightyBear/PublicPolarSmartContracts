/*
 * Copyright (c) 2023 Mighty Bear Games
 */

import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { BigNumber, BytesLike } from "ethers";
import { ethers, upgrades } from "hardhat";
import {
	MightyNetERC721RestrictedRegistry,
	MightyActionHeroesGadget,
	MightyNetTerminal,
	MightyActionHeroesSupplyCrates,
} from "../../typechain";
import {
	deployOperatorFilterRegistry,
	setProxyAdmin,
	setTransparentUpgradeableProxyAdmin,
} from "./utils/testHelper";
import { deployUpgradeable } from "./utils/deploy";
import { Token } from "aws-sdk";
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("MightyNet Terminal", () => {
	let mahGadgets: MightyActionHeroesGadget;
	let mnTerminal: MightyNetTerminal;
	let mnSupplyCrates: MightyActionHeroesSupplyCrates;

	let restrictedRegistry: MightyNetERC721RestrictedRegistry;

	let owner: SignerWithAddress,
		player1: SignerWithAddress,
		player2: SignerWithAddress,
		receiveExecutor: SignerWithAddress,
		restrictor: SignerWithAddress,
		proxyUpgradeAdmin: SignerWithAddress;

	let originalProxyAdminAddress: string;

	let adminRole: BytesLike;
	let receiveExecutorRole: BytesLike;
	const defaultMinFee = 1;
	const nullAddress = "0x0000000000000000000000000000000000000000";
	const requestEventId = "requestEventIdTestValue";

	async function deployTestFixture() {
		const [
			owner,
			player1,
			player2,
			receiveExecutor,
			restrictor,
			proxyUpgradeAdmin,
		] = await ethers.getSigners();

		const operatorFilterRegistry = await deployOperatorFilterRegistry();

		const restrictedRegistry = (await deployUpgradeable(
			"MightyNetERC721RestrictedRegistry",
			"initialize"
		)) as MightyNetERC721RestrictedRegistry;

		// Deploy MightyActionHeroGadgets contract
		const mahg = (await deployUpgradeable(
			"MightyActionHeroesGadget",
			"initialize",
			"https://mightyverse.com/api/mahg/",
			"https://mightyverse.com/api/mahg",
			operatorFilterRegistry.address,
			restrictedRegistry.address
		)) as MightyActionHeroesGadget;

		await mahg.deployed();

		// Deploy MightyActionHeroesSupplyCrates contract
		const mightyActionHereoesSupplyCratesContractDeloyed = (await deployUpgradeable(
			"MightyActionHeroesSupplyCrates",
			"initialize",
			"https://mightyverse.com/api/supplycrates/",
			"https://mightyverse.com/api/supplycrates/",
			operatorFilterRegistry.address
		)) as MightyActionHeroesSupplyCrates;

		await mightyActionHereoesSupplyCratesContractDeloyed.deployed();

		// Deploy Terminal contract
		const terminal = (await deployUpgradeable(
			"MightyNetTerminal",
			"initialize",
			restrictedRegistry.address,
			defaultMinFee,
			receiveExecutor.address
		)) as MightyNetTerminal;

		await terminal.deployed();

		//Grant roles
		var restrictorRole = await restrictedRegistry.RESTRICTOR_ROLE();

		await restrictedRegistry.grantRole(restrictorRole, restrictor.address);
		await restrictedRegistry.grantRole(restrictorRole, terminal.address);

		await terminal.setTokenContracts(
			mightyActionHereoesSupplyCratesContractDeloyed.address,
			await terminal.ERC1155_CONTRACT_TYPE()
		);

		await terminal.setTokenContracts(
			mahg.address,
			await terminal.ERC721_CONTRACT_TYPE()
		);

		adminRole = await terminal.DEFAULT_ADMIN_ROLE();
		receiveExecutorRole = await terminal.RECEIVE_EXECUTOR_ROLE();

		await terminal.grantRole(receiveExecutorRole, receiveExecutor.address);

		originalProxyAdminAddress = (await upgrades.admin.getInstance())
			.address;

		setProxyAdmin(
			originalProxyAdminAddress,
			owner,
			terminal.address,
			proxyUpgradeAdmin.address
		);

		// Fixtures can return anything you consider useful for your tests
		return {
			ownerSigner: owner,
			player1Signer: player1,
			player2Signer: player2,
			receiveExecutorSigner: receiveExecutor,
			restrictorSigner: restrictor,
			proxyUpgradeAdminSigner: proxyUpgradeAdmin,
			restrictedRegis: restrictedRegistry,
			mahgContract: mahg,
			terminalContract: terminal,
			supplyCrateContract: mightyActionHereoesSupplyCratesContractDeloyed,
		};
	}

	beforeEach(async () => {
		var {
			ownerSigner,
			player1Signer,
			player2Signer,
			receiveExecutorSigner,
			restrictorSigner,
			proxyUpgradeAdminSigner,
			restrictedRegis,
			mahgContract,
			terminalContract,
			supplyCrateContract,
		} = await loadFixture(deployTestFixture);
		owner = ownerSigner;
		player1 = player1Signer;
		player2 = player2Signer;
		receiveExecutor = receiveExecutorSigner;
		restrictor = restrictorSigner;
		proxyUpgradeAdmin = proxyUpgradeAdminSigner;
		restrictedRegistry = restrictedRegis;
		mahGadgets = mahgContract;
		mnTerminal = terminalContract;
		mnSupplyCrates = supplyCrateContract;
	});

	describe("Deployment", () => {

		it("should be unpaused", async () => {
			expect(await mnTerminal.paused()).to.be.false;
		});

		it("min payable amount should be the same as default value", async () => {
			expect(await mnTerminal.minimumFee()).to.be.equal(defaultMinFee);
		});

		it("feesVault should be owner by default", async () => {
			expect(await mnTerminal.feesVault()).to.be.equal(
				receiveExecutor.address
			);
		});
	});

	describe("Administration", () => {
		it("should pause and unpause contract", async () => {
			await mnTerminal.pause();

			expect(await mnTerminal.paused()).to.be.true;

			await mnTerminal.unpause();

			expect(await mnTerminal.paused()).to.be.false;
		});

		it("only admins should be able to pause and unpause", async () => {
			await expect(mnTerminal.connect(player1).pause()).to.be.reverted;

			await mnTerminal.pause();

			await expect(mnTerminal.connect(player1).unpause()).to.be.reverted;
		});

		it("should grant admin role", async () => {
			await mnTerminal.grantRole(adminRole, player1.address);

			expect(await mnTerminal.hasRole(adminRole, player1.address)).to.be
				.true;
		});

		it("only admins should be able to grant roles", async () => {
			await expect(
				mnTerminal
					.connect(player1)
					.grantRole(adminRole, player1.address)
			).to.be.reverted;
		});

		it("should register contract", async () => {
			var UNREGISTERED_CONTRACT_TYPE =
				await mnTerminal.UNREGISTERED_CONTRACT_TYPE();

			var ERC1155_CONTRACT_TYPE =
				await mnTerminal.ERC1155_CONTRACT_TYPE();

			await mnTerminal.setTokenContracts(
				mnSupplyCrates.address,
				UNREGISTERED_CONTRACT_TYPE
			);

			expect(
				await mnTerminal.tokenContracts(mnSupplyCrates.address)
			).to.be.equal(UNREGISTERED_CONTRACT_TYPE);

			await mnTerminal.setTokenContracts(
				mnSupplyCrates.address,
				ERC1155_CONTRACT_TYPE
			);

			expect(
				await mnTerminal.tokenContracts(mnSupplyCrates.address)
			).to.be.equal(ERC1155_CONTRACT_TYPE);
		});

		it("only owner should be able to register contract", async () => {
			var UNREGISTERED_CONTRACT_TYPE =
				await mnTerminal.UNREGISTERED_CONTRACT_TYPE();

			var ERC1155_CONTRACT_TYPE =
				await mnTerminal.ERC1155_CONTRACT_TYPE();

			await expect(
				mnTerminal
					.connect(player1)
					.setTokenContracts(
						mnSupplyCrates.address,
						UNREGISTERED_CONTRACT_TYPE
					)
			).to.be.revertedWith(
				`AccessControl: account ${player1.address.toLowerCase()} is missing role ${adminRole}`
			);

			// Contract should still be registered as ERC1155 contract type
			expect(
				await mnTerminal.tokenContracts(mnSupplyCrates.address)
			).to.be.equal(ERC1155_CONTRACT_TYPE);
		});

		it("setting non contract address to set token contract function should revert", async () => {
			var ERC1155_CONTRACT_TYPE =
				await mnTerminal.ERC1155_CONTRACT_TYPE();

			await expect(
				mnTerminal.setTokenContracts(
					player1.address,
					ERC1155_CONTRACT_TYPE
				)
			).to.be.revertedWith(
				`InvalidTokenContract(\"${player1.address}\")`
			);
		});

		it("setting wrong contract type for token contract function should revert", async () => {
			var INVALID_CONTRACT_TYPE = BigNumber.from(100);

			await expect(
				mnTerminal.setTokenContracts(
					mnSupplyCrates.address,
					INVALID_CONTRACT_TYPE
				)
			).to.be.revertedWith(`InvalidTokenContractType()`);
		});

		it("ERC721 contract type shouldnt register as ERC1155 and vice versa", async () => {
			var ERC721_CONTRACT_TYPE = await mnTerminal.ERC721_CONTRACT_TYPE();
			var ERC1155_CONTRACT_TYPE =
				await mnTerminal.ERC1155_CONTRACT_TYPE();

			await expect(
				mnTerminal.setTokenContracts(
					mnSupplyCrates.address,
					ERC721_CONTRACT_TYPE
				)
			).to.be.revertedWith(`InvalidTokenContractType()`);

			await expect(
				mnTerminal.setTokenContracts(
					mahGadgets.address,
					ERC1155_CONTRACT_TYPE
				)
			).to.be.revertedWith(`InvalidTokenContractType()`);
		});

		it("should be able to change minimum fee", async () => {
			const newMinPayableAmount = 100;
			await mnTerminal.setMinimumFee(newMinPayableAmount);

			expect(await mnTerminal.minimumFee()).to.be.equal(
				newMinPayableAmount
			);
		});

		it("only admin should be able to change minimum fee", async () => {
			const newMinPayableAmount = 100;

			await expect(
				mnTerminal.connect(player1).setMinimumFee(newMinPayableAmount)
			).to.be.reverted;
		});

		it("should be able to change vault address", async () => {
			await mnTerminal.setFeesVaultAddress(player1.address);

			expect(await mnTerminal.feesVault()).to.be.equal(player1.address);
		});

		it("only admin should be able to change vault address", async () => {
			await expect(
				mnTerminal.connect(player1).setFeesVaultAddress(player1.address)
			).to.be.reverted;
		});
	});

	describe("Receive From Game", () => {
		describe("ERC1155", () => {
			const token1Id = 1;
			const token2Id = 2;
			const token1ExportQuantity = 10;
			const token2ExportQuantity = 20;

			it("should be able to receive without role and emit correct event", async () => {
				const balance = await receiveExecutor.getBalance();
				await expect(
					mnTerminal
						.connect(player1)
						.requestReceiveFromGameERC1155(
							mnSupplyCrates.address,
							[token1Id],
							[token1ExportQuantity],
							{
								value: defaultMinFee,
							}
						)
				)
					.to.emit(mnTerminal, "ReceiveRequestedERC1155")
					.withArgs(
						mnSupplyCrates.address,
						player1.address,
						defaultMinFee,
						[token1Id],
						[token1ExportQuantity]
					);

				expect(await receiveExecutor.getBalance()).to.equal(
					balance.add(defaultMinFee)
				);
			});

			it("should be able to batch receive", async () => {
				const balance = await receiveExecutor.getBalance();

				await expect(
					mnTerminal
						.connect(player1)
						.requestReceiveFromGameERC1155(
							mnSupplyCrates.address,
							[token1Id, token2Id],
							[token1ExportQuantity, token2ExportQuantity],
							{
								value: defaultMinFee,
							}
						)
				)
					.to.emit(mnTerminal, "ReceiveRequestedERC1155")
					.withArgs(
						mnSupplyCrates.address,
						player1.address,
						defaultMinFee,
						[token1Id, token2Id],
						[token1ExportQuantity, token2ExportQuantity]
					);

				expect(await receiveExecutor.getBalance()).to.equal(
					balance.add(defaultMinFee)
				);
			});

			it("should fail when transferring below minmum amount", async () => {
				await expect(
					mnTerminal
						.connect(player1)
						.requestReceiveFromGameERC1155(
							mnSupplyCrates.address,
							[token1Id],
							[token1ExportQuantity],
							{
								value: 0,
							}
						)
				).to.revertedWith(
					`ValueLowerThanMinimumFee(0, ${defaultMinFee})`
				);
			});

			it("should fail when vault is not set", async () => {
				await mnTerminal.setFeesVaultAddress(nullAddress);

				await expect(
					mnTerminal
						.connect(player1)
						.requestReceiveFromGameERC1155(
							mnSupplyCrates.address,
							[token1Id],
							[token1ExportQuantity],
							{
								value: defaultMinFee,
							}
						)
				).to.revertedWith(`InvalidAddress("${nullAddress}")`);
			});

			it("should not be able to receive to game with unregistered token contract", async () => {
				await mnTerminal.setTokenContracts(
					mnSupplyCrates.address,
					await mnTerminal.UNREGISTERED_CONTRACT_TYPE()
				);

				await expect(
					mnTerminal
						.connect(player1)
						.requestReceiveFromGameERC1155(
							mnSupplyCrates.address,
							[token1Id],
							[token1ExportQuantity],
							{
								value: defaultMinFee,
							}
						)
				).to.be.revertedWith(
					`UnregisteredTokenContract(\"${mnSupplyCrates.address}\")`
				);
			});

			it("should not be able to receive to game differently registered token contract", async () => {
				await expect(
					mnTerminal
						.connect(player1)
						.requestReceiveFromGameERC1155(
							mahGadgets.address,
							[token1Id],
							[token1ExportQuantity],
							{
								value: defaultMinFee,
							}
						)
				).to.be.revertedWith(
					`UnregisteredTokenContract(\"${mahGadgets.address}\")`
				);
			});
		});

		describe("ERC721", () => {
			const token1Id = 1;
			const token2Id = 2;

			it("should be able to receive without role and emit correct event", async () => {
				const balance = await receiveExecutor.getBalance();
				await expect(
					mnTerminal
						.connect(player1)
						.requestReceiveFromGameERC721(
							mahGadgets.address,
							[token1Id],
							{
								value: defaultMinFee,
							}
						)
				)
					.to.emit(mnTerminal, "ReceiveRequestedERC721")
					.withArgs(
						mahGadgets.address,
						player1.address,
						defaultMinFee,
						[token1Id]
					);

				expect(await receiveExecutor.getBalance()).to.equal(
					balance.add(defaultMinFee)
				);
			});

			it("should be able to batch receive", async () => {
				const balance = await receiveExecutor.getBalance();

				await expect(
					mnTerminal
						.connect(player1)
						.requestReceiveFromGameERC721(
							mahGadgets.address,
							[token1Id, token2Id],
							{
								value: defaultMinFee,
							}
						)
				)
					.to.emit(mnTerminal, "ReceiveRequestedERC721")
					.withArgs(
						mahGadgets.address,
						player1.address,
						defaultMinFee,
						[token1Id, token2Id]
					);

				expect(await receiveExecutor.getBalance()).to.equal(
					balance.add(defaultMinFee)
				);
			});

			it("should fail when transferring below minmum amount", async () => {
				await expect(
					mnTerminal
						.connect(player1)
						.requestReceiveFromGameERC721(
							mahGadgets.address,
							[token1Id],
							{
								value: 0,
							}
						)
				).to.revertedWith(
					`ValueLowerThanMinimumFee(0, ${defaultMinFee})`
				);
			});

			it("should fail when vault is not set", async () => {
				await mnTerminal.setFeesVaultAddress(nullAddress);

				await expect(
					mnTerminal
						.connect(player1)
						.requestReceiveFromGameERC721(
							mahGadgets.address,
							[token1Id],
							{
								value: defaultMinFee,
							}
						)
				).to.revertedWith(`InvalidAddress("${nullAddress}")`);
			});

			it("should not be able to receive to game with unregistered token contract", async () => {
				await mnTerminal.setTokenContracts(
					mahGadgets.address,
					await mnTerminal.UNREGISTERED_CONTRACT_TYPE()
				);

				await expect(
					mnTerminal
						.connect(player1)
						.requestReceiveFromGameERC721(
							mahGadgets.address,
							[token1Id],
							{
								value: defaultMinFee,
							}
						)
				).to.be.revertedWith(
					`UnregisteredTokenContract(\"${mahGadgets.address}\")`
				);
			});

			it("should not be able to receive to game differently registered token contract", async () => {
				await expect(
					mnTerminal
						.connect(player1)
						.requestReceiveFromGameERC721(
							mnSupplyCrates.address,
							[token1Id],
							{
								value: defaultMinFee,
							}
						)
				).to.be.revertedWith(
					`UnregisteredTokenContract(\"${mnSupplyCrates.address}\")`
				);
			});
		});
	});

	describe("Finalize Receive From Game", () => {
		describe("ERC1155", () => {
			const token1Id = 1;
			const token2Id = 2;
			const token1ExportQuantity = 10;
			const token2ExportQuantity = 20;

			it("should not be able to finalize receive without correct role", async () => {
				await expect(
					mnTerminal.receiveFromGameERC1155(
						mnSupplyCrates.address,
						player1.address,
						[token1Id],
						[token1ExportQuantity],
						requestEventId
					)
				).to.be.revertedWith(
					`AccessControl: account ${owner.address.toLowerCase()} is missing role ${receiveExecutorRole}`
				);
			});

			it("should not be able to finalize receive if terminal contract is not granted correct role from token contract", async () => {
				await expect(
					mnTerminal
						.connect(receiveExecutor)
						.receiveFromGameERC1155(
							mnSupplyCrates.address,
							player1.address,
							[token1Id],
							[token1ExportQuantity],
							requestEventId
						)
				).to.be.revertedWith(
					`AccessControl: account ${mnTerminal.address.toLowerCase()} is missing role ${await mnSupplyCrates.MINTER_ROLE()}`
				);
			});

			it("should be able to finalize receive if terminal contract is granted correct role from token contract with proper events emitted", async () => {
				var supplyCrateMinterRole = await mnSupplyCrates.MINTER_ROLE();
				await mnSupplyCrates.grantRole(
					supplyCrateMinterRole,
					mnTerminal.address
				);

				expect(
					await mnTerminal
						.connect(receiveExecutor)
						.receiveFromGameERC1155(
							mnSupplyCrates.address,
							player1.address,
							[token1Id],
							[token1ExportQuantity],
							requestEventId
						)
				)
					.to.emit(mnTerminal, "ReceivedERC1155")
					.withArgs(
						mnSupplyCrates.address,
						player1.address,
						[token1Id],
						[token1ExportQuantity],
						requestEventId
					);

				await expect(
					await mnSupplyCrates.balanceOf(player1.address, token1Id)
				).to.equal(token1ExportQuantity);
			});

			it("should be able to finalize receive multiple tokens", async () => {
				var supplyCrateMinterRole = await mnSupplyCrates.MINTER_ROLE();
				await mnSupplyCrates.grantRole(
					supplyCrateMinterRole,
					mnTerminal.address
				);
				await mnTerminal
					.connect(receiveExecutor)
					.receiveFromGameERC1155(
						mnSupplyCrates.address,
						player1.address,
						[token1Id, token2Id],
						[token1ExportQuantity, token2ExportQuantity],
						requestEventId
					);

				expect(
					await mnSupplyCrates.balanceOf(player1.address, token1Id)
				).to.equal(token1ExportQuantity);

				expect(
					await mnSupplyCrates.balanceOf(player1.address, token2Id)
				).to.equal(token2ExportQuantity);
			});

			it("should revert finalize receive when paused", async () => {
				var supplyCrateMinterRole = await mnSupplyCrates.MINTER_ROLE();
				await mnSupplyCrates.grantRole(
					supplyCrateMinterRole,
					mnTerminal.address
				);

				await mnTerminal.pause();

				await expect(
					mnTerminal
						.connect(receiveExecutor)
						.receiveFromGameERC1155(
							mnSupplyCrates.address,
							player1.address,
							[token1Id],
							[token1ExportQuantity],
							requestEventId
						)
				).to.be.revertedWith("Pausable: paused");

				expect(
					await mnSupplyCrates.balanceOf(player1.address, token1Id)
				).to.equal(0);

				await mnTerminal.unpause();

				await mnSupplyCrates.pause();

				await expect(
					mnTerminal
						.connect(receiveExecutor)
						.receiveFromGameERC1155(
							mnSupplyCrates.address,
							player1.address,
							[token1Id],
							[token1ExportQuantity],
							requestEventId
						)
				).to.be.revertedWith("Pausable: paused");

				expect(
					await mnSupplyCrates.balanceOf(player1.address, token1Id)
				).to.equal(0);

				await mnSupplyCrates.unpause();

				mnTerminal
					.connect(receiveExecutor)
					.receiveFromGameERC1155(
						mnSupplyCrates.address,
						player1.address,
						[token1Id],
						[token1ExportQuantity],
						requestEventId
					);

				expect(
					await mnSupplyCrates.balanceOf(player1.address, token1Id)
				).to.equal(token1ExportQuantity);
			});

			it("should not be able to finalize receive to unregistered token contract", async () => {
				var supplyCrateMinterRole = await mnSupplyCrates.MINTER_ROLE();
				await mnSupplyCrates.grantRole(
					supplyCrateMinterRole,
					mnTerminal.address
				);

				await mnTerminal.setTokenContracts(
					mnSupplyCrates.address,
					await mnTerminal.UNREGISTERED_CONTRACT_TYPE()
				);

				await expect(
					mnTerminal
						.connect(receiveExecutor)
						.receiveFromGameERC1155(
							mnSupplyCrates.address,
							player1.address,
							[token1Id],
							[token1ExportQuantity],
							requestEventId
						)
				).to.be.revertedWith(
					`UnregisteredTokenContract(\"${mnSupplyCrates.address}\")`
				);
			});

			it("should not be able to finalize receive to differently registered token contract", async () => {
				var supplyCrateMinterRole = await mnSupplyCrates.MINTER_ROLE();
				await mnSupplyCrates.grantRole(
					supplyCrateMinterRole,
					mnTerminal.address
				);

				await expect(
					mnTerminal
						.connect(receiveExecutor)
						.receiveFromGameERC1155(
							mahGadgets.address,
							player1.address,
							[token1Id],
							[token1ExportQuantity],
							requestEventId
						)
				).to.be.revertedWith(
					`UnregisteredTokenContract(\"${mahGadgets.address}\")`
				);
			});
		});

		describe("ERC721", () => {
			const token1Id = 1;
			const token2Id = 2;

			it("should not be able to finalize receive without correct role", async () => {
				await expect(
					mnTerminal.receiveFromGameERC721(
						mahGadgets.address,
						player1.address,
						[token1Id],
						requestEventId
					)
				).to.be.revertedWith(
					`AccessControl: account ${owner.address.toLowerCase()} is missing role ${receiveExecutorRole}`
				);
			});

			it("should not be able to finalize receive if terminal contract is not granted correct role from token contract", async () => {
				await expect(
					mnTerminal
						.connect(receiveExecutor)
						.receiveFromGameERC721(
							mahGadgets.address,
							player1.address,
							[token1Id],
							requestEventId
						)
				).to.be.revertedWith(
					`AccessControl: account ${mnTerminal.address.toLowerCase()} is missing role ${await mnSupplyCrates.MINTER_ROLE()}`
				);
			});

			it("should be able to finalize receive if terminal contract is granted correct role from token contract and emit correct events", async () => {
				var mahgMinterRole = await mahGadgets.MINTER_ROLE();
				await mahGadgets.grantRole(mahgMinterRole, mnTerminal.address);

				expect(
					await mnTerminal
						.connect(receiveExecutor)
						.receiveFromGameERC721(
							mahGadgets.address,
							player1.address,
							[token1Id],
							requestEventId
						)
				)
					.to.emit(mnTerminal, "ReceivedERC721")
					.withArgs(
						mnSupplyCrates.address,
						player1.address,
						defaultMinFee,
						[token1Id],
						requestEventId
					);

				expect(await mahGadgets.ownerOf(token1Id)).to.be.equal(
					player1.address
				);
			});

			it("should be able to finalize receive multiple tokens", async () => {
				var mahgMinterRole = await mahGadgets.MINTER_ROLE();
				await mahGadgets.grantRole(mahgMinterRole, mnTerminal.address);
				await mnTerminal
					.connect(receiveExecutor)
					.receiveFromGameERC721(
						mahGadgets.address,
						player1.address,
						[token1Id, token2Id],
						requestEventId
					);

				expect(await mahGadgets.ownerOf(token1Id)).to.be.equal(
					player1.address
				);

				expect(await mahGadgets.ownerOf(token2Id)).to.be.equal(
					player1.address
				);
			});

			it("should not be able to finalize receive already exported token", async () => {
				var mahgMinterRole = await mahGadgets.MINTER_ROLE();
				await mahGadgets.grantRole(mahgMinterRole, mnTerminal.address);
				await mnTerminal
					.connect(receiveExecutor)
					.receiveFromGameERC721(
						mahGadgets.address,
						player1.address,
						[token1Id],
						requestEventId
					);

				expect(await mahGadgets.ownerOf(token1Id)).to.be.equal(
					player1.address
				);

				await expect(
					mnTerminal
						.connect(receiveExecutor)
						.receiveFromGameERC721(
							mahGadgets.address,
							player1.address,
							[token1Id],
							requestEventId
						)
				).to.be.revertedWith(
					`TokenNotRestricted(\"${mahGadgets.address}\", ${token1Id})`
				);
			});

			it("should revert finalize receive when paused", async () => {
				var mahgMinterRole = await mahGadgets.MINTER_ROLE();
				await mahGadgets.grantRole(mahgMinterRole, mnTerminal.address);

				await mnTerminal.pause();

				await expect(
					mnTerminal
						.connect(receiveExecutor)
						.receiveFromGameERC721(
							mahGadgets.address,
							player1.address,
							[token1Id],
							requestEventId
						)
				).to.be.revertedWith("Pausable: paused");

				expect(await mahGadgets.exists(token1Id)).to.be.equal(false);

				await mnTerminal.unpause();

				await mahGadgets.pause();

				await expect(
					mnTerminal
						.connect(receiveExecutor)
						.receiveFromGameERC721(
							mahGadgets.address,
							player1.address,
							[token1Id],
							requestEventId
						)
				).to.be.revertedWith("Pausable: paused");

				expect(await mahGadgets.exists(token1Id)).to.be.equal(false);

				await mahGadgets.unpause();

				await mnTerminal
					.connect(receiveExecutor)
					.receiveFromGameERC721(
						mahGadgets.address,
						player1.address,
						[token1Id],
						requestEventId
					);

				expect(await mahGadgets.ownerOf(token1Id)).to.be.equal(
					player1.address
				);
			});

			it("should not be able to finalize receive to unregistered token contract", async () => {
				var mahgMinterRole = await mahGadgets.MINTER_ROLE();
				await mahGadgets.grantRole(mahgMinterRole, mnTerminal.address);

				await mnTerminal.setTokenContracts(
					mahGadgets.address,
					await mnTerminal.UNREGISTERED_CONTRACT_TYPE()
				);

				await expect(
					mnTerminal
						.connect(receiveExecutor)
						.receiveFromGameERC721(
							mahGadgets.address,
							player1.address,
							[token1Id],
							requestEventId
						)
				).to.be.revertedWith(
					`UnregisteredTokenContract(\"${mahGadgets.address}\")`
				);
			});

			it("should not be able to finalize receive to differently registered token contract", async () => {
				var mahgMinterRole = await mahGadgets.MINTER_ROLE();
				await mahGadgets.grantRole(mahgMinterRole, mnTerminal.address);

				await expect(
					mnTerminal
						.connect(receiveExecutor)
						.receiveFromGameERC721(
							mnSupplyCrates.address,
							player1.address,
							[token1Id],
							requestEventId
						)
				).to.be.revertedWith(
					`UnregisteredTokenContract(\"${mnSupplyCrates.address}\")`
				);
			});

			it("should unrestrict if finalize receive a token", async () => {
				var mahgMinterRole = await mahGadgets.MINTER_ROLE();
				await mahGadgets.grantRole(mahgMinterRole, mnTerminal.address);
				expect(await mahGadgets.exists(token1Id)).to.be.equal(false);

				await mnTerminal
					.connect(receiveExecutor)
					.receiveFromGameERC721(
						mahGadgets.address,
						player1.address,
						[token1Id],
						requestEventId
					);

				expect(await mahGadgets.exists(token1Id)).to.be.equal(true);
				expect(await mahGadgets.ownerOf(token1Id)).to.be.equal(
					player1.address
				);

				await mnTerminal
					.connect(player1)
					.sendToGameERC721(mahGadgets.address, [token1Id]);
				expect(await mahGadgets.exists(token1Id)).to.be.equal(true);
				expect(await mahGadgets.ownerOf(token1Id)).to.be.equal(
					player1.address
				);
				expect(
					await restrictedRegistry.isRestricted(
						mahGadgets.address,
						token1Id
					)
				).to.be.equal(true);

				await mnTerminal
					.connect(receiveExecutor)
					.receiveFromGameERC721(
						mahGadgets.address,
						player1.address,
						[token1Id],
						requestEventId
					);
				expect(await mahGadgets.exists(token1Id)).to.be.equal(true);
				expect(await mahGadgets.ownerOf(token1Id)).to.be.equal(
					player1.address
				);
				expect(
					await restrictedRegistry.isRestricted(
						mahGadgets.address,
						token1Id
					)
				).to.be.equal(false);
			});
		});
	});

	//Write tests for importing
	describe("Send To Game", () => {
		describe("ERC1155", () => {
			const token1Id = 1;
			const token2Id = 2;
			const token1ExportQuantity = 10;
			const token2ExportQuantity = 20;

			beforeEach(async () => {
				await mnSupplyCrates.grantRole(
					await mnSupplyCrates.MINTER_ROLE(),
					mnTerminal.address
				);
				await mnTerminal
					.connect(receiveExecutor)
					.receiveFromGameERC1155(
						mnSupplyCrates.address,
						player1.address,
						[token1Id, token2Id],
						[token1ExportQuantity, token2ExportQuantity],
						requestEventId
					);

				expect(
					await mnSupplyCrates.balanceOf(player1.address, token1Id)
				).to.equal(token1ExportQuantity);

				expect(
					await mnSupplyCrates.balanceOf(player1.address, token2Id)
				).to.equal(token2ExportQuantity);
			});

			it("should not be able to send with insufficient token", async () => {
				//Correct error check as this is owner's account that is importing
				await expect(
					mnTerminal.sendToGameERC1155(
						mnSupplyCrates.address,
						[token1Id],
						[token1ExportQuantity]
					)
				).to.be.revertedWith(
					`InsufficientTokens(\"${owner.address}\", ${token1Id})`
				);
			});

			it("should not be able to send if terminal contract is not granted correct role from token contract", async () => {
				await expect(
					mnTerminal
						.connect(player1)
						.sendToGameERC1155(
							mnSupplyCrates.address,
							[token1Id],
							[token1ExportQuantity]
						)
				).to.be.revertedWith(
					`AccessControl: account ${mnTerminal.address.toLowerCase()} is missing role ${await mnSupplyCrates.BURNER_ROLE()}`
				);

				expect(
					await mnSupplyCrates.balanceOf(player1.address, token1Id)
				).to.equal(token1ExportQuantity);
			});

			it("should be able to send if terminal contract is granted correct role from token contract and emit correct event", async () => {
				await mnSupplyCrates.grantRole(
					await mnSupplyCrates.BURNER_ROLE(),
					mnTerminal.address
				);

				expect(
					await mnTerminal
						.connect(player1)
						.sendToGameERC1155(
							mnSupplyCrates.address,
							[token1Id],
							[token1ExportQuantity]
						)
				)
					.to.emit(mnTerminal, "SentERC1155")
					.withArgs(
						mnSupplyCrates.address,
						player1.address,
						defaultMinFee,
						[token1Id],
						[token1ExportQuantity]
					);

				expect(
					await mnSupplyCrates.balanceOf(player1.address, token1Id)
				).to.equal(0);
			});

			it("should be able to send multiple tokens", async () => {
				await mnSupplyCrates.grantRole(
					await mnSupplyCrates.BURNER_ROLE(),
					mnTerminal.address
				);

				await mnTerminal
					.connect(player1)
					.sendToGameERC1155(
						mnSupplyCrates.address,
						[token1Id, token2Id],
						[token1ExportQuantity, token2ExportQuantity]
					);

				expect(
					await mnSupplyCrates.balanceOf(player1.address, token1Id)
				).to.equal(0);

				expect(
					await mnSupplyCrates.balanceOf(player1.address, token2Id)
				).to.equal(0);
			});

			it("should not be able to over send token", async () => {
				await mnSupplyCrates.grantRole(
					await mnSupplyCrates.BURNER_ROLE(),
					mnTerminal.address
				);

				await expect(
					mnTerminal
						.connect(player1)
						.sendToGameERC1155(
							mnSupplyCrates.address,
							[token1Id],
							[token2ExportQuantity]
						)
				).to.be.revertedWith(
					`InsufficientTokens(\"${player1.address}\", ${token1Id})`
				);
			});

			it("should revert send when paused", async () => {
				await mnSupplyCrates.grantRole(
					await mnSupplyCrates.BURNER_ROLE(),
					mnTerminal.address
				);

				await mnTerminal.pause();

				await expect(
					mnTerminal
						.connect(player1)
						.sendToGameERC1155(
							mnSupplyCrates.address,
							[token1Id],
							[token1ExportQuantity]
						)
				).to.be.revertedWith("Pausable: paused");

				expect(
					await mnSupplyCrates.balanceOf(player1.address, token1Id)
				).to.equal(token1ExportQuantity);

				await mnTerminal.unpause();

				await mnSupplyCrates.pause();

				await expect(
					mnTerminal
						.connect(player1)
						.sendToGameERC1155(
							mnSupplyCrates.address,
							[token1Id],
							[token1ExportQuantity]
						)
				).to.be.revertedWith("Pausable: paused");

				expect(
					await mnSupplyCrates.balanceOf(player1.address, token1Id)
				).to.equal(token1ExportQuantity);

				await mnSupplyCrates.unpause();

				await mnTerminal
					.connect(player1)
					.sendToGameERC1155(
						mnSupplyCrates.address,
						[token1Id],
						[token1ExportQuantity]
					);

				expect(
					await mnSupplyCrates.balanceOf(player1.address, token1Id)
				).to.equal(0);
			});

			it("should not be able to send from unregistered token contract", async () => {
				await mnSupplyCrates.grantRole(
					await mnSupplyCrates.BURNER_ROLE(),
					mnTerminal.address
				);

				await mnTerminal.setTokenContracts(
					mnSupplyCrates.address,
					await mnTerminal.UNREGISTERED_CONTRACT_TYPE()
				);

				await expect(
					mnTerminal
						.connect(player1)
						.sendToGameERC1155(
							mnSupplyCrates.address,
							[token1Id],
							[token1ExportQuantity]
						)
				).to.be.revertedWith(
					`UnregisteredTokenContract(\"${mnSupplyCrates.address}\")`
				);
			});

			it("should not be able to send from a differently registered token contract", async () => {
				await mnSupplyCrates.grantRole(
					await mnSupplyCrates.BURNER_ROLE(),
					mnTerminal.address
				);

				await expect(
					mnTerminal
						.connect(player1)
						.sendToGameERC1155(
							mahGadgets.address,
							[token1Id],
							[token1ExportQuantity]
						)
				).to.be.revertedWith(
					`UnregisteredTokenContract(\"${mahGadgets.address}\")`
				);
			});
		});

		describe("ERC721", () => {
			const token1Id = 1;
			const token2Id = 2;

			beforeEach(async () => {
				await mahGadgets.grantRole(
					await mahGadgets.MINTER_ROLE(),
					mnTerminal.address
				);
				await mnTerminal
					.connect(receiveExecutor)
					.receiveFromGameERC721(
						mahGadgets.address,
						player1.address,
						[token1Id, token2Id],
						requestEventId
					);

				expect(await mahGadgets.ownerOf(token1Id)).to.equal(
					player1.address
				);

				expect(await mahGadgets.ownerOf(token2Id)).to.equal(
					player1.address
				);
			});

			it("should not be able to send with other address's token", async () => {
				await expect(
					mnTerminal.sendToGameERC721(mahGadgets.address, [token1Id])
				).to.be.revertedWith(`NotOwnerOfToken(\"${owner.address}\")`);
			});

			it("should be able to send if terminal contract is granted correct role from restricted registry and emit correct event", async () => {
				expect(
					await mnTerminal
						.connect(player1)
						.sendToGameERC721(mahGadgets.address, [token1Id])
				)
					.to.emit(mnTerminal, "SentERC721")
					.withArgs(
						mnSupplyCrates.address,
						player1.address,
						defaultMinFee,
						[token1Id]
					);

				expect(
					await restrictedRegistry.isRestricted(
						mahGadgets.address,
						token1Id
					)
				).to.be.equal(true);
			});

			it("should be able to send multiple tokens", async () => {
				await mnTerminal
					.connect(player1)
					.sendToGameERC721(mahGadgets.address, [token1Id, token2Id]);

				expect(
					await restrictedRegistry.isRestricted(
						mahGadgets.address,
						token1Id
					)
				).to.be.equal(true);

				expect(
					await restrictedRegistry.isRestricted(
						mahGadgets.address,
						token2Id
					)
				).to.be.equal(true);
			});

			it("should not be able to send if terminal contract is not granted correct role from restricted registry", async () => {
				var restrictedRole = await restrictedRegistry.RESTRICTOR_ROLE();
				await restrictedRegistry.revokeRole(
					restrictedRole,
					mnTerminal.address
				);
				await expect(
					mnTerminal
						.connect(player1)
						.sendToGameERC721(mahGadgets.address, [token1Id])
				).to.be.revertedWith(
					`AccessControl: account ${mnTerminal.address.toLowerCase()} is missing role ${restrictedRole}`
				);
			});

			it("should revert send when paused", async () => {
				await mnTerminal.pause();

				await expect(
					mnTerminal
						.connect(player1)
						.sendToGameERC721(mahGadgets.address, [token1Id])
				).to.be.revertedWith("Pausable: paused");

				await mnTerminal.unpause();

				await restrictedRegistry.pause();

				await expect(
					mnTerminal
						.connect(player1)
						.sendToGameERC721(mahGadgets.address, [token1Id])
				).to.be.revertedWith("Pausable: paused");

				await restrictedRegistry.unpause();

				await mnTerminal
					.connect(player1)
					.sendToGameERC721(mahGadgets.address, [token1Id]);

				expect(
					await restrictedRegistry.isRestricted(
						mahGadgets.address,
						token1Id
					)
				).to.be.equal(true);
			});

			it("should not be able to send to unregistered token contract", async () => {
				await mnTerminal.setTokenContracts(
					mahGadgets.address,
					await mnTerminal.UNREGISTERED_CONTRACT_TYPE()
				);

				await expect(
					mnTerminal
						.connect(player1)
						.sendToGameERC721(mahGadgets.address, [token1Id])
				).to.be.revertedWith(
					`UnregisteredTokenContract(\"${mahGadgets.address}\")`
				);
			});

			it("should not be able to send to differently registered token contract", async () => {
				await expect(
					mnTerminal
						.connect(player1)
						.sendToGameERC721(mnSupplyCrates.address, [token1Id])
				).to.be.revertedWith(
					`UnregisteredTokenContract(\"${mnSupplyCrates.address}\")`
				);
			});

			it("player should not be able to unrestrict sent token without terminal contract", async () => {
				expect(await mahGadgets.exists(token1Id)).to.be.equal(true);
				expect(
					await restrictedRegistry.isRestricted(
						mahGadgets.address,
						token1Id
					)
				).to.be.equal(false);

				await mnTerminal
					.connect(player1)
					.sendToGameERC721(mahGadgets.address, [token1Id]);

				expect(
					await restrictedRegistry.isRestricted(
						mahGadgets.address,
						token1Id
					)
				).to.be.equal(true);

				await restrictedRegistry.grantRole(
					await restrictedRegistry.RESTRICTOR_ROLE(),
					player1.address
				);

				await expect(
					restrictedRegistry
						.connect(player1)
						.unrestrict(mahGadgets.address, [token1Id])
				).to.be.revertedWith(
					`InvalidRestrictor(\"${player1.address}\")`
				);

				expect(
					await restrictedRegistry.isRestricted(
						mahGadgets.address,
						token1Id
					)
				).to.be.equal(true);
			});
		});
	});

	describe("Restrict Importing", () => {
		describe("ERC1155", () => {
			const token1Id = 1;
			const token2Id = 2;
			const token1ExportQuantity = 10;
			const token2ExportQuantity = 20;

			beforeEach(async () => {
				await mnSupplyCrates.grantRole(
					await mnSupplyCrates.MINTER_ROLE(),
					mnTerminal.address
				);
				await mnTerminal
					.connect(receiveExecutor)
					.receiveFromGameERC1155(
						mnSupplyCrates.address,
						player1.address,
						[token1Id, token2Id],
						[token1ExportQuantity, token2ExportQuantity],
						requestEventId
					);

				expect(
					await mnSupplyCrates.balanceOf(player1.address, token1Id)
				).to.equal(token1ExportQuantity);

				expect(
					await mnSupplyCrates.balanceOf(player1.address, token2Id)
				).to.equal(token2ExportQuantity);

				await mnSupplyCrates.grantRole(
					await mnSupplyCrates.BURNER_ROLE(),
					mnTerminal.address
				);
			});

			it("only admin should be able to restrict import of token", async () => {
				await expect(mnTerminal
					.connect(player1)
					.setTokenSendRestriction(
						mnSupplyCrates.address,
						token1Id,
						true
					)).to.be.reverted;
			});

			it("admin should be able to restrict and unrestrict import of token", async () => {
				await mnTerminal
					.setTokenSendRestriction(
						mnSupplyCrates.address,
						token1Id,
						true
					);

				await expect(mnTerminal
					.connect(player1)
					.sendToGameERC1155(
						mnSupplyCrates.address,
						[token1Id],
						[token1ExportQuantity]
					)
				)
					.to.be.revertedWith(`TokenSendRestricted("${mnSupplyCrates.address}", ${token1Id})`);

				await mnTerminal
					.setTokenSendRestriction(
						mnSupplyCrates.address,
						token1Id,
						false
					);

				await mnTerminal
					.connect(player1)
					.sendToGameERC1155(
						mnSupplyCrates.address,
						[token1Id],
						[token1ExportQuantity]
					);

				expect(
					await mnSupplyCrates.balanceOf(player1.address, token1Id)
				).to.equal(0);
				expect(
					await mnSupplyCrates.balanceOf(player1.address, token2Id)
				).to.equal(token2ExportQuantity);
			});

			it("able to send token2 even though token1 of same contract is restricted from sending", async () => {
				await mnTerminal
					.setTokenSendRestriction(
						mnSupplyCrates.address,
						token1Id,
						true
					);

				await expect(mnTerminal
					.connect(player1)
					.sendToGameERC1155(
						mnSupplyCrates.address,
						[token1Id],
						[token1ExportQuantity]
					)
				)
					.to.be.revertedWith(`TokenSendRestricted("${mnSupplyCrates.address}", ${token1Id})`);

				await mnTerminal
					.connect(player1)
					.sendToGameERC1155(
						mnSupplyCrates.address,
						[token2Id],
						[token2ExportQuantity]
					);

				expect(
					await mnSupplyCrates.balanceOf(player1.address, token1Id)
				).to.equal(token1ExportQuantity);
				expect(
					await mnSupplyCrates.balanceOf(player1.address, token2Id)
				).to.equal(0);
			});

			it("shouldnt be able to send if one of the bulk send is restricted", async () => {
				await mnTerminal
					.setTokenSendRestriction(
						mnSupplyCrates.address,
						token1Id,
						true
					);

				await expect(mnTerminal
					.connect(player1)
					.sendToGameERC1155(
						mnSupplyCrates.address,
						[token1Id, token2Id],
						[token1ExportQuantity, token2ExportQuantity]
					)
				)
					.to.be.revertedWith(`TokenSendRestricted("${mnSupplyCrates.address}", ${token1Id})`);
			});
		});

		describe("ERC721", () => {
			const token1Id = 1;
			const token2Id = 2;

			beforeEach(async () => {
				await mahGadgets.grantRole(
					await mahGadgets.MINTER_ROLE(),
					mnTerminal.address
				);
				await mnTerminal
					.connect(receiveExecutor)
					.receiveFromGameERC721(
						mahGadgets.address,
						player1.address,
						[token1Id, token2Id],
						requestEventId
					);

				expect(await mahGadgets.ownerOf(token1Id)).to.equal(
					player1.address
				);

				expect(await mahGadgets.ownerOf(token2Id)).to.equal(
					player1.address
				);
			});

			it("only admin should be able to restrict import of token", async () => {
				await expect(mnTerminal
					.connect(player1)
					.setTokenSendRestriction(
						mahGadgets.address,
						token1Id,
						true
					)).to.be.reverted;
			});

			it("admin should be able to restrict and unrestrict import of token", async () => {
				await mnTerminal
					.setTokenSendRestriction(
						mahGadgets.address,
						token1Id,
						true
					);

				await expect(mnTerminal
					.connect(player1)
					.sendToGameERC721(
						mahGadgets.address,
						[token1Id]
					)
				)
					.to.be.revertedWith(`TokenSendRestricted("${mahGadgets.address}", ${token1Id})`);

				await mnTerminal
					.setTokenSendRestriction(
						mahGadgets.address,
						token1Id,
						false
					);

				await mnTerminal
					.connect(player1)
					.sendToGameERC721(
						mahGadgets.address,
						[token1Id]
					);

				expect(
					await restrictedRegistry.isRestricted(
						mahGadgets.address,
						token1Id
					)
				).to.be.equal(true);

				expect(
					await restrictedRegistry.isRestricted(
						mahGadgets.address,
						token2Id
					)
				).to.be.equal(false);
			});

			it("able to send token2 even though token1 of same contract is restricted from sending", async () => {
				await mnTerminal
					.setTokenSendRestriction(
						mahGadgets.address,
						token1Id,
						true
					);

				await expect(mnTerminal
					.connect(player1)
					.sendToGameERC721(
						mahGadgets.address,
						[token1Id]
					)
				)
					.to.be.revertedWith(`TokenSendRestricted("${mahGadgets.address}", ${token1Id})`);

				await mnTerminal
					.connect(player1)
					.sendToGameERC721(
						mahGadgets.address,
						[token2Id]
					);

				expect(
					await restrictedRegistry.isRestricted(
						mahGadgets.address,
						token1Id
					)
				).to.be.equal(false);

				expect(
					await restrictedRegistry.isRestricted(
						mahGadgets.address,
						token2Id
					)
				).to.be.equal(true);
			});

			it("shouldnt be able to send if one of the bulk send is restricted", async () => {
				await mnTerminal
					.setTokenSendRestriction(
						mahGadgets.address,
						token1Id,
						true
					);

				await expect(mnTerminal
					.connect(player1)
					.sendToGameERC721(
						mahGadgets.address,
						[token1Id, token2Id]
					)
				)
					.to.be.revertedWith(`TokenSendRestricted("${mahGadgets.address}", ${token1Id})`);
			});
		});

		it("able to view if token is restricted using view function", async () => {
			const token1Id = 1;
			const token1ExportQuantity = 10;

			await mnTerminal
				.setTokenSendRestriction(
					mnSupplyCrates.address,
					token1Id,
					true
				);

			await expect(mnTerminal
				.connect(player1)
				.sendToGameERC1155(
					mnSupplyCrates.address,
					[token1Id],
					[token1ExportQuantity]
				)
			)
				.to.be.revertedWith(`TokenSendRestricted("${mnSupplyCrates.address}", ${token1Id})`);

			expect(await mnTerminal.connect(player1).isTokenSendRestricted(mnSupplyCrates.address, token1Id)).to.be.true;
		});
	});

	describe("Upgrade", () => {
		let mngUpgrade: MightyNetTerminal;

		let tokenId = 1;

		beforeEach(async () => {
			setTransparentUpgradeableProxyAdmin(
				mnTerminal.address,
				proxyUpgradeAdmin,
				originalProxyAdminAddress
			);

			mnTerminal.grantRole(receiveExecutorRole, player1.address);

			// Upgrade contract to MightyActionHeroGadgets Upgradeable V2
			let factory = await ethers.getContractFactory("MightyNetTerminal");

			const contract = await upgrades.upgradeProxy(
				mnTerminal.address,
				factory
			);

			mngUpgrade = factory.attach(contract.address);
		});

		it("should upgrade successfully", async () => {
			expect(mngUpgrade).to.not.be.undefined;
		});

		it("should carry over state", async () => {
			// Minter role should be carried over
			expect(
				await mngUpgrade.hasRole(receiveExecutorRole, player1.address)
			).to.be.equal(true);

			expect(
				await mngUpgrade.tokenContracts(mnSupplyCrates.address)
			).to.be.equal(await mngUpgrade.ERC1155_CONTRACT_TYPE());

			expect(
				await mngUpgrade.tokenContracts(mahGadgets.address)
			).to.be.equal(await mngUpgrade.ERC721_CONTRACT_TYPE());
		});
	});

	describe("Restriction", () => {
		const token1Id = 1;
		beforeEach(async () => {
			await mahGadgets.grantRole(
				await mahGadgets.MINTER_ROLE(),
				mnTerminal.address
			);

			await mnTerminal
				.connect(receiveExecutor)
				.receiveFromGameERC721(mahGadgets.address,
					player1.address,
					[token1Id],
					requestEventId);
		});

		it("should not be unable to unrestrict other address restriction", async () => {
			await mnTerminal
				.connect(player1)
				.sendToGameERC721(mahGadgets.address, [token1Id]);

			await expect(
				restrictedRegistry
					.connect(restrictor)
					.unrestrict(mahGadgets.address, [token1Id])
			).to.be.revertedWith(
				`InvalidRestrictor(\"${restrictor.address}\")`
			);
		});

		it("should be able to send and receive using different address", async () => {
			await mnTerminal
				.connect(player1)
				.sendToGameERC721(mahGadgets.address, [token1Id]);

			await mnTerminal
				.connect(receiveExecutor)
				.receiveFromGameERC721(mahGadgets.address,
					player1.address,
					[token1Id],
					requestEventId);

			expect(
				await restrictedRegistry.isRestricted(mahGadgets.address, [
					token1Id,
				])
			).to.be.equal(false);
		});

		it("should not be able to transfer a restricted token", async () => {
			await restrictedRegistry
				.connect(restrictor)
				.restrict(mahGadgets.address, [token1Id]);
			await expect(
				mahGadgets
					.connect(player1)
					.transferFrom(player1.address, player2.address, token1Id)
			).to.be.revertedWith(`TokenIsRestricted(${token1Id})`);
		});

		it("should not be able to burn a restricted token", async () => {
			await restrictedRegistry
				.connect(restrictor)
				.restrict(mahGadgets.address, [token1Id]);
			await expect(
				mahGadgets.connect(player1).burn(token1Id)
			).to.be.revertedWith(`TokenIsRestricted(${token1Id})`);
		});
	});
});
