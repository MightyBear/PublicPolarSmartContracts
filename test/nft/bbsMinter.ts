/*
 * Copyright (c) 2022 Mighty Bear Games
 */

import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { BigNumber } from "ethers";
import { keccak256, RLP } from "ethers/lib/utils";
import { ethers, upgrades } from "hardhat";
import {
	BigBearSyndicate,
	BigBearSyndicateMinter,
	OperatorFilterRegistry,
} from "../../typechain";
import {
	deployBbs,
	BigBearSyndicateMinterTestHelper,
	deployBbsMinter,
} from "./utils/bbsMinterTestHelper";
import { deployUpgradeable } from "./utils/deploy";
import {
	buildMerkleTree,
	deployOperatorFilterRegistry,
	setProxyAdmin,
	setTransparentUpgradeableProxyAdmin,
} from "./utils/testHelper";
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("Big Bear Syndicate Minter", () => {
	const bbsBaseUri = "https://mighty.net/api/bbs/";
	const bbsContractUri = "https://mighty.net/api/bbs";

	let bbs: BigBearSyndicate;

	let bbsMinter: BigBearSyndicateMinter;

	let operatorFilterRegistry: OperatorFilterRegistry;

	let owner: SignerWithAddress,
		player1: SignerWithAddress,
		player2: SignerWithAddress,
		vault: SignerWithAddress,
		proxyUpgradeAdmin: SignerWithAddress;

	let originalProxyAdminAddress: string;

	const defaultStartTime = BigNumber.from(
		"0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
	);

	let bbsMinterTestHelper: BigBearSyndicateMinterTestHelper;

	async function deployTestFixture() {
		const [owner, player1, player2, vault, proxyUpgradeAdmin] =
			await ethers.getSigners();

		const operatorFilterRegistry = await deployOperatorFilterRegistry();

		const restrictedRegistry = await deployUpgradeable(
			"MightyNetERC721RestrictedRegistry",
			"initialize"
		);

		// Deploy BigBearSyndicate contract
		const bbs = await deployBbs(
			bbsBaseUri,
			bbsContractUri,
			operatorFilterRegistry.address,
			restrictedRegistry.address
		);

		const bbsMinter = await deployBbsMinter(bbs.address);

		await bbs.setMinter(bbsMinter.address);

		bbsMinterTestHelper = new BigBearSyndicateMinterTestHelper(bbsMinter);

		originalProxyAdminAddress = (await upgrades.admin.getInstance())
			.address;

		setProxyAdmin(
			originalProxyAdminAddress,
			owner,
			bbsMinter.address,
			proxyUpgradeAdmin.address
		);

		// Fixtures can return anything you consider useful for your tests
		return {
			ownerSigner: owner,
			player1Signer: player1,
			player2Signer: player2,
			vaultSigner: vault,
			proxyUpgradeAdminSigner: proxyUpgradeAdmin,
			operatorFilterRegis: operatorFilterRegistry,
			bbsContract: bbs,
			bbsMinterContract: bbsMinter,
		};
	}

	beforeEach(async () => {
		var {
			ownerSigner,
			player1Signer,
			player2Signer,
			vaultSigner,
			proxyUpgradeAdminSigner,
			operatorFilterRegis,
			bbsContract,
			bbsMinterContract,
		} = await loadFixture(deployTestFixture);
		owner = ownerSigner;
		player1 = player1Signer;
		player2 = player2Signer;
		vault = vaultSigner;
		proxyUpgradeAdmin = proxyUpgradeAdminSigner;
		operatorFilterRegistry = operatorFilterRegis;
		bbs = bbsContract;
		bbsMinter = bbsMinterContract;
	});

	describe("Deployment", () => {
		it("should have correct BigBearSyndicate address", async () => {
			expect(await bbsMinter.bbs()).to.be.equal(bbs.address);
		});

		it("should have correct vault address", async () => {
			expect(await bbsMinter.vault()).to.be.equal(owner.address);
		});

		it("should have default allow list start time", async () => {
			expect(await bbsMinter.allowListStartTime()).to.be.equal(
				defaultStartTime
			);
		});

		it("should have default public start time", async () => {
			expect(await bbsMinter.publicStartTime()).to.be.equal(
				defaultStartTime
			);
		});
	});

	describe("Administration", () => {
		it("should pause and unpause contract", async () => {
			await bbs.pause();

			expect(await bbs.paused()).to.be.true;

			await bbs.unpause();

			expect(await bbs.paused()).to.be.false;
		});

		it("only owner should be able to pause and unpause", async () => {
			await expect(bbs.connect(player1).pause()).to.be.reverted;

			await bbs.pause();

			await expect(bbs.connect(player1).unpause()).to.be.reverted;
		});

		it("should set allow list start time", async () => {
			const startTime = BigNumber.from(Date.now());

			await bbsMinter.setAllowListStartTime(startTime);

			expect(await bbsMinter.allowListStartTime()).to.be.equal(startTime);
		});

		it("only admin should be able to set allow list start time", async () => {
			const startTime = BigNumber.from(Date.now());

			await expect(
				bbsMinter.connect(player1).setAllowListStartTime(startTime)
			).to.be.reverted;
		});

		it("should set public start time", async () => {
			const startTime = BigNumber.from(Date.now());

			await bbsMinter.setPublicStartTime(startTime);

			expect(await bbsMinter.publicStartTime()).to.be.equal(startTime);
		});

		it("only admin should be able to set public start time", async () => {
			const startTime = BigNumber.from(Date.now());

			await expect(
				bbsMinter.connect(player1).setPublicStartTime(startTime)
			).to.be.reverted;
		});

		it("should set vault address", async () => {
			await bbsMinter.setVaultAddress(vault.address);

			expect(await bbsMinter.vault()).to.be.equal(vault.address);
		});

		it("only admin should be able to set vault address", async () => {
			await expect(
				bbsMinter.connect(player1).setVaultAddress(vault.address)
			).to.be.reverted;
		});

		it("should set allow list mint allowance", async () => {
			const limit = 3;

			await bbsMinter.setAllowListMints(limit);

			expect(await bbsMinter.allowListMints()).to.be.equal(limit);
		});

		it("only admin should be able to set allow list mint allowance", async () => {
			await expect(bbsMinter.connect(player1).setAllowListMints(3)).to.be
				.reverted;
		});

		it("should set per transaction mint limit", async () => {
			const limit = 25;

			await bbsMinter.setMintLimit(limit);

			expect(await bbsMinter.mintLimit()).to.be.equal(limit);
		});

		it("only admin should be able to set per transaction mint limit", async () => {
			await expect(bbsMinter.connect(player1).setMintLimit(25)).to.be
				.reverted;
		});
	});

	describe("Minting", async () => {
		describe("Free", () => {
			it("should mint BigBearSyndicate with address with free mint", async () => {
				await bbsMinterTestHelper.readyFreeMint(player1.address, 2);

				await bbsMinter.connect(player1).freeMint(2);
			});

			it("should return false if free mint already claimed", async () => {
				await bbsMinterTestHelper.readyFreeMint(player1.address, 2);

				await bbsMinter.connect(player1).freeMint(2);

				expect(
					await bbsMinter.addressToFreeMintClaim(player1.address)
				).to.equal(0);
			});

			it("should revert mint when free mint already claimed", async () => {
				await bbsMinterTestHelper.readyFreeMint(player1.address, 2);

				await bbsMinter.connect(player1).freeMint(2);

				await expect(
					bbsMinter.connect(player1).freeMint(1)
				).to.be.revertedWith(
					`MintAllowanceExceeded("${player1.address}", 0)`
				);
			});

			it("only addresses with free mint should be able to mint", async () => {
				await bbsMinter.setSupplyLimit(1);

				await bbsMinterTestHelper.startFreeMintPhase();

				await expect(
					bbsMinter.connect(player1).freeMint(1)
				).to.be.revertedWith(
					`MintAllowanceExceeded("${player1.address}", 0)`
				);
			});

			it("should revert when free mint phase has not started", async () => {
				await bbsMinterTestHelper.readyFreeMint(
					player1.address,
					2,
					false
				);
				await expect(
					bbsMinter.connect(player1).freeMint(2)
				).to.be.revertedWith(`PhaseNotStarted(${defaultStartTime})`);
			});

			it("should revert when free mint phase is over", async () => {
				await bbsMinterTestHelper.readyFreeMint(
					player1.address,
					2,
					true
				);

				await bbsMinterTestHelper.startAllowListPhase();

				const allowListStartTime = await bbsMinter.allowListStartTime();

				await expect(
					bbsMinter.connect(player1).freeMint(2)
				).to.be.revertedWith(
					`PhaseOver(${allowListStartTime.toString()})`
				);
			});

			it("should revert when no more available supply", async () => {
				await bbsMinterTestHelper.readyFreeMint(
					player1.address,
					2,
					true,
					0
				);

				await expect(
					bbsMinter.connect(player1).freeMint(1)
				).to.be.revertedWith("NotEnoughSupply");
			});

			it("should revert when paused", async () => {
				await bbsMinterTestHelper.readyFreeMint(player1.address, 2);

				await bbsMinter.pause();

				await expect(
					bbsMinter.connect(player1).freeMint(2)
				).to.be.revertedWith("Pausable: paused");
			});
		});

		describe("Paid", () => {
			it("should mint BigBearSyndicate for address with paid mints limit", async () => {
				const mints = 3;

				const hexProof = await bbsMinterTestHelper.readyPaidMints(
					player1.address,
					mints
				);

				const price = (await bbsMinter.price()).mul(mints);
				bbsMinter.connect(player1).allowListMint(mints, hexProof, {
					value: price,
				});
			});

			it("should mint BigBearSyndicate for address with allowlist mint limit", async () => {
				const mints = 1;

				const hexProof = await bbsMinterTestHelper.readyAllowListMint(
					player1.address
				);

				const price = (await bbsMinter.price()).mul(mints);
				bbsMinter.connect(player1).allowListMint(mints, hexProof, {
					value: price,
				});
			});

			it("should revert mint if address paid mints allowance will be exceeded", async () => {
				const mints = 3;
				const limit = 2;

				const hexProof = await bbsMinterTestHelper.readyPaidMints(
					player1.address,
					limit
				);

				const price = (await bbsMinter.price()).mul(mints);

				await expect(
					bbsMinter.connect(player1).allowListMint(mints, hexProof, {
						value: price,
					})
				).to.be.revertedWith(
					`MintAllowanceExceeded("${player1.address}", ${limit})`
				);
			});

			it("should revert mint if address is does not have paid mints limit", async () => {
				const mints = 3;
				const hexProof = await bbsMinterTestHelper.readyAllowListMint(
					player1.address
				);

				const price = (await bbsMinter.price()).mul(mints);

				await expect(
					bbsMinter.connect(player1).allowListMint(mints, hexProof, {
						value: price,
					})
				).to.be.revertedWith(
					`MintAllowanceExceeded("${player1.address}", 2)`
				);
			});

			it("should credit contract balance after mint", async () => {
				const mints = 3;

				const hexProof = await bbsMinterTestHelper.readyPaidMints(
					player1.address,
					mints
				);

				const price = await bbsMinter.price();

				await bbsMinter.connect(player1).allowListMint(1, hexProof, {
					value: price,
				});

				// Contract balance should be price
				expect(
					await ethers.provider.getBalance(bbsMinter.address)
				).to.equal(price);

				// Mint 1 more BigBearSyndicate
				await bbsMinter.connect(player1).allowListMint(1, hexProof, {
					value: price,
				});

				// Contract balance should now be price * 2
				expect(
					await ethers.provider.getBalance(bbsMinter.address)
				).to.equal(price.mul(2));
			});

			it("should mint equal to number of BigBearSyndicates requested", async () => {
				const mints = 2;

				const hexProof = await bbsMinterTestHelper.readyPaidMints(
					player1.address,
					mints
				);

				const price = (await bbsMinter.price()).mul(mints);

				await bbsMinter
					.connect(player1)
					.allowListMint(mints, hexProof, {
						value: price,
					});

				// Minted BigBearSyndicates should have IDs 1 and 2
				const mintedBears = [1, 2];

				// Check that BigBearSyndicates were minted and owned by player 1
				for (let id of mintedBears) {
					expect(await bbs.ownerOf(id)).to.be.equal(player1.address);
				}
			});

			it("should revert when allow list phase has not started", async () => {
				const mints = 1;

				const hexProof = await bbsMinterTestHelper.readyAllowListMint(
					player1.address,
					false
				);

				const price = await bbsMinter.price();

				await expect(
					bbsMinter.connect(player1).allowListMint(1, hexProof, {
						value: price,
					})
				).to.be.revertedWith(`PhaseNotStarted(${defaultStartTime})`);
			});

			it("should revert when allow list phase is over", async () => {
				const mints = 1;

				const hexProof = await bbsMinterTestHelper.readyAllowListMint(
					player1.address
				);

				await bbsMinterTestHelper.startPublicPhase();

				const publicStartTime = await bbsMinter.publicStartTime();

				const price = await bbsMinter.price();

				await expect(
					bbsMinter.connect(player1).allowListMint(1, hexProof, {
						value: price,
					})
				).to.be.revertedWith(
					`PhaseOver(${publicStartTime.toString()})`
				);
			});

			it("should revert when sent value is incorrect", async () => {
				const mints = 2;

				const hexProof = await bbsMinterTestHelper.readyPaidMints(
					player1.address,
					mints
				);

				const price = await bbsMinter.price();

				// Send price for 1 BigBearSyndicate as incorrect value but try to mint 2
				await expect(
					bbsMinter.connect(player1).allowListMint(mints, hexProof, {
						value: price,
					})
				).to.be.revertedWith(`IncorrectEtherValue(${price.mul(2)})`);
			});

			it("should revert when no more available supply", async () => {
				const mints = 2;

				const hexProof = await bbsMinterTestHelper.readyPaidMints(
					player1.address,
					mints,
					true,
					1
				);

				const price = (await bbsMinter.price()).mul(mints);

				// Try to mint 2 BigBearSyndicates but only 1 is available
				await expect(
					bbsMinter.connect(player1).allowListMint(mints, hexProof, {
						value: price,
					})
				).to.be.revertedWith("NotEnoughSupply");
			});

			it("should revert when paused", async () => {
				const mints = 1;

				const hexProof = await bbsMinterTestHelper.readyAllowListMint(
					player1.address,
					false
				);

				const price = await bbsMinter.price();

				await bbsMinter.pause();

				await expect(
					bbsMinter.connect(player1).allowListMint(mints, hexProof, {
						value: price,
					})
				).to.be.revertedWith("Pausable: paused");
			});

			it("should revert mint if transaction mint limit exceeded", async () => {
				const mintLimit = (await bbsMinter.mintLimit()).toNumber();

				const mints = mintLimit + 1;

				const hexProof = await bbsMinterTestHelper.readyAllowListMint(
					player1.address
				);

				const price = (await bbsMinter.price()).mul(mints);

				await expect(
					bbsMinter.connect(player1).allowListMint(mints, hexProof, {
						value: price,
					})
				).to.be.revertedWith(`MintLimitExceeded(${mintLimit})`);
			});
		});

		describe("Allow list", () => {
			it("should not be in allow list phase when in free mint phase", async () => {
				await bbsMinterTestHelper.startFreeMintPhase();

				expect(await bbsMinter.isInAllowListPhase()).to.be.false;
			});

			it("should be in allow list phase when start time has past", async () => {
				await bbsMinterTestHelper.startAllowListPhase();

				expect(await bbsMinter.isInAllowListPhase()).to.be.true;
			});

			it("should not be in allow list phase when public sale has started", async () => {
				await bbsMinterTestHelper.startAllowListPhase();
				await bbsMinterTestHelper.startPublicPhase();

				expect(await bbsMinter.isInAllowListPhase()).to.be.false;
			});

			it("addresses with free mint but not in the allow list should not be able to mint", async () => {
				const mints = 2;
				await bbsMinterTestHelper.readyFreeMint(player1.address, mints);
				await bbsMinterTestHelper.startAllowListPhase();

				const price = (await bbsMinter.price()).mul(mints);

				await expect(
					bbsMinter
						.connect(player1)
						.allowListMint(mints, nullHexProof, {
							value: price,
						})
				).to.be.revertedWith(`NotWhitelisted("${player1.address}")`);
			});
		});

		describe("Public", () => {
			it("should mint BigBearSyndicate", async () => {
				await bbsMinterTestHelper.startPublicPhase();

				const price = await bbsMinter.price();

				await bbsMinter.connect(player1).publicMint(1, {
					value: price,
				});
			});

			it("should be in public phase when start time has past", async () => {
				await bbsMinterTestHelper.startPublicPhase();

				expect(await bbsMinter.isInPublicPhase()).to.be.true;
			});

			it("should credit contract balance after mint", async () => {
				await bbsMinterTestHelper.startPublicPhase();

				const price = await bbsMinter.price();

				await bbsMinter.connect(player1).publicMint(1, {
					value: price,
				});

				// Contract balance should be price
				expect(
					await ethers.provider.getBalance(bbsMinter.address)
				).to.equal(price);

				// Mint 2 more BigBearSyndicates
				const count = 2;

				const value = price.mul(count);

				await bbsMinter.connect(player1).publicMint(2, {
					value: value,
				});

				// Contract balance should now be price * count + price
				expect(
					await ethers.provider.getBalance(bbsMinter.address)
				).to.equal(value.add(price));
			});

			it("should mint equal to number of BigBearSyndicates requested", async () => {
				const count = 2;

				await bbsMinterTestHelper.startPublicPhase();

				const price = await bbsMinter.price();

				await bbsMinter.connect(player1).publicMint(count, {
					value: price.mul(count),
				});

				// Minted BigBearSyndicates should have IDs 1 and 2
				const mintedBears = [1, 2];

				// Check that BigBearSyndicates were minted and owned by player 1
				for (let id of mintedBears) {
					expect(await bbs.ownerOf(id)).to.be.equal(player1.address);
				}
			});

			it("should revert when public phase has not started", async () => {
				const price = await bbsMinter.price();

				await expect(
					bbsMinter.connect(player1).publicMint(1, {
						value: price,
					})
				).to.be.revertedWith(`PhaseNotStarted(${defaultStartTime})`);
			});

			it("should revert when sent value is incorrect", async () => {
				await bbsMinterTestHelper.startPublicPhase();

				const price = await bbsMinter.price();

				// Send price - 0.01 ETH as incorrect value
				await expect(
					bbsMinter.connect(player1).publicMint(1, {
						value: price.sub(ethers.utils.parseEther("0.01")),
					})
				).to.be.revertedWith(`IncorrectEtherValue(${price})`);

				// Send price for 1 BigBearSyndicate as incorrect value but try to mint 2
				await expect(
					bbsMinter.connect(player1).publicMint(2, {
						value: price,
					})
				).to.be.revertedWith(`IncorrectEtherValue(${price.mul(2)})`);
			});

			it("should revert when no more available supply", async () => {
				await bbsMinter.setSupplyLimit(1);

				await bbsMinterTestHelper.startPublicPhase();

				const price = await bbsMinter.price();

				// Try to mint 2 BigBearSyndicates but only 1 is available
				await expect(
					bbsMinter.connect(player1).publicMint(2, {
						value: price,
					})
				).to.be.revertedWith("NotEnoughSupply");
			});

			it("should revert when paused", async () => {
				await bbsMinter.setSupplyLimit(1);

				await bbsMinterTestHelper.startPublicPhase();

				const price = await bbsMinter.price();

				await bbsMinter.pause();

				await expect(
					bbsMinter.connect(player1).publicMint(1, {
						value: price,
					})
				).to.be.revertedWith("Pausable: paused");
			});

			it("should revert mint if transaction mint limit exceeded", async () => {
				const mintLimit = (await bbsMinter.mintLimit()).toNumber();

				await bbsMinterTestHelper.startPublicPhase();

				const price = await bbsMinter.price();

				await expect(
					bbsMinter.connect(player1).publicMint(mintLimit + 1, {
						value: price,
					})
				).to.be.revertedWith(`MintLimitExceeded(${mintLimit})`);
			});
		});
	});

	describe("Whitelisting", () => {
		describe("Free mint", () => {
			it("should add free mint", async () => {
				const mints = 2;
				await bbsMinter.setFreeMintClaims(player1.address, mints);

				expect(
					await bbsMinter.addressToFreeMintClaim(player1.address)
				).to.equal(mints);
			});

			it("only admin should be able to add free mint", async () => {
				await expect(
					bbsMinter
						.connect(player1)
						.setFreeMintClaims(player1.address, 2)
				).to.be.reverted;
			});

			it("should return 0 if address does not have free mint", async () => {
				expect(
					await bbsMinter.addressToFreeMintClaim(player1.address)
				).to.equal(0);
			});
		});

		describe("Paid", () => {
			it("should set paid mints for address", async () => {
				const mints = 1;

				await bbsMinter.setPaidMints(player1.address, mints);

				expect(
					await bbsMinter.addressToPaidMints(player1.address)
				).to.equal(mints);
			});

			it("should return paids mints if allowlisted address has paid mints", async () => {
				const mints = 3;

				await bbsMinter.setPaidMints(player1.address, mints);

				expect(
					await bbsMinter.allowListMintsRemaining(player1.address)
				).to.equal(mints);
			});

			it("only admins should be able to set paid mints for address", async () => {
				await expect(
					bbsMinter.connect(player1).setPaidMints(player1.address, 1)
				).to.be.reverted;
			});

			it("should return 0 if address does not have paid mints", async () => {
				expect(
					await bbsMinter.addressToPaidMints(player1.address)
				).to.be.equal(0);
			});

			it("should return allowListMints if allowlisted address does not have paid mints", async () => {
				const allowListMints_ = await bbsMinter.allowListMints();
				await bbsMinterTestHelper.readyAllowListMint(
					player1.address,
					false
				);
				expect(
					await bbsMinter.allowListMintsRemaining(player1.address)
				).to.be.equal(allowListMints_);
			});
		});

		describe("Allow list", () => {
			it("should set allow list Merkle tree root hash", async () => {
				const merkleTree = await buildMerkleTree(
					player1.address,
					player2.address
				);

				// Set contract Merkle root hash
				const root = merkleTree.getRoot();

				const hexRoot = ethers.utils.hexlify(root);

				await bbsMinter.setAllowListMerkleRoot(root);

				expect(await bbsMinter.allowListMerkleRoot()).to.equal(hexRoot);
			});

			it("only admin should be able to set allow list Merkle tree root hash", async () => {
				const merkleTree = await buildMerkleTree(
					player1.address,
					player2.address
				);

				// Set contract Merkle root hash
				const root = merkleTree.getRoot();

				await expect(
					bbsMinter.connect(player1).setAllowListMerkleRoot(root)
				).to.be.reverted;
			});

			it("should return true if in allow list whitelist", async () => {
				const hexProof = await bbsMinterTestHelper.readyAllowListMint(
					player1.address
				);

				expect(
					await bbsMinter.isAllowListWhitelisted(
						player1.address,
						hexProof
					)
				).to.be.true;
			});

			it("should return false if not in allow list whitelist", async () => {
				const hexProof = await bbsMinterTestHelper.readyAllowListMint(
					player1.address
				);

				expect(
					await bbsMinter.isAllowListWhitelisted(
						player2.address,
						hexProof
					)
				).to.be.false;
			});
		});
	});

	describe("Withdrawal", () => {
		beforeEach(async () => {
			await bbsMinter.setVaultAddress(vault.address);
		});

		it("only admin should be able to withdraw balance", async () => {
			const amount = ethers.utils.parseEther("1.0");

			await expect(bbsMinter.connect(player1).withdraw(amount)).to.be
				.reverted;
		});

		it("should withdraw all of balance to vault address", async () => {
			const balance = await vault.getBalance();

			await bbsMinterTestHelper.startPublicPhase();

			const price = await bbsMinter.price();

			await bbsMinter.connect(player1).publicMint(1, {
				value: price,
			});

			// Credit balance
			await bbsMinter.withdrawAll();

			expect(await vault.getBalance()).to.equal(balance.add(price));
		});

		it("should withdraw a portion of balance to vault address", async () => {
			const balance = await vault.getBalance();

			await bbsMinterTestHelper.startPublicPhase();

			const price = await bbsMinter.price();

			await bbsMinter.connect(player1).publicMint(2, {
				value: price.mul(2),
			});

			// Credit price * 1 balance
			await bbsMinter.withdraw(price);

			// Vault balance should have been credited price * 1
			expect(await vault.getBalance()).to.equal(balance.add(price));
			// Minter contract balance should only be price * 1
			expect(
				await ethers.provider.getBalance(bbsMinter.address)
			).to.equal(price);
		});

		it("should revert when withdrawing more than balance", async () => {
			const amount = ethers.utils.parseEther("1.0");

			await expect(bbsMinter.withdraw(amount)).to.be.revertedWith(
				`InsufficientBalance(0, ${amount})`
			);
		});

		it("should revert when withdrawing all with zero balance", async () => {
			await expect(bbsMinter.withdrawAll()).to.be.revertedWith(
				`InsufficientBalance(0, 1)`
			);
		});
	});

	describe("Exploits", () => {
		it("should prevent mint-and-transfer to bypass free mint allowance", async () => {
			const mints = 2;
			await bbsMinterTestHelper.readyFreeMint(player1.address, mints);

			await bbsMinter.connect(player1).freeMint(mints);

			await bbs
				.connect(player1)
				["safeTransferFrom(address,address,uint256)"](
					player1.address,
					player2.address,
					1
				);

			// Free mint should still be claimed for player 1
			await expect(
				bbsMinter.connect(player1).freeMint(1)
			).to.be.revertedWith(
				`MintAllowanceExceeded("${player1.address}", 0)`
			);
		});

		it("should prevent mint-and-transfer to bypass allow list mint allowance", async () => {
			const hexProof = await bbsMinterTestHelper.readyAllowListMint(
				player1.address
			);

			const price = await bbsMinter.price();

			const mintLimit = (await bbsMinter.allowListMints()).toNumber();

			// Mint and transfer BigBearSyndicates until limit is reached
			for (let i = 0; i < mintLimit; i++) {
				const tokenId = i + 1;

				await bbsMinter.connect(player1).allowListMint(1, hexProof, {
					value: price,
				});

				await bbs
					.connect(player1)
					["safeTransferFrom(address,address,uint256)"](
						player1.address,
						player2.address,
						tokenId
					);
			}

			// mint allowance should still apply for player 1
			await expect(
				bbsMinter.connect(player1).allowListMint(1, hexProof, {
					value: price,
				})
			).to.be.revertedWith(
				`MintAllowanceExceeded("${player1.address}", ${mintLimit})`
			);
		});
	});

	const nullHexProof = [keccak256(ethers.constants.AddressZero)];

	describe("Upgrade", () => {
		let bbsMinterUpgrade: BigBearSyndicateMinter;

		let playerFreeMintClaimed: BigNumber;
		let playerPaidMints: BigNumber;
		let playerAllowListMints: BigNumber;
		let playerAllowListMintsRemaining: BigNumber;

		let supplyLimit: BigNumber;
		let currentTokenId: BigNumber;

		let allowListMerkleRoot: string;

		let allowListStartTime: BigNumber;
		let publicStartTime: BigNumber;

		let allowListMints: BigNumber;

		let mintLimit: BigNumber;

		let vault: string;

		let price: BigNumber;

		beforeEach(async () => {
			setTransparentUpgradeableProxyAdmin(
				bbsMinter.address,
				proxyUpgradeAdmin,
				originalProxyAdminAddress
			);

			// Mint bears for each phase to add to state
			await bbsMinterTestHelper.readyFreeMint(player1.address, 2);
			await bbsMinter.connect(player1).freeMint(2);

			playerFreeMintClaimed = await bbsMinter.addressToFreeMintClaim(
				player1.address
			);

			await bbsMinter.setPrice(ethers.utils.parseEther("1.0"));
			price = await bbsMinter.price();

			const hexProof = await bbsMinterTestHelper.readyPaidMints(
				player1.address,
				3
			);
			await bbsMinter.connect(player1).allowListMint(3, hexProof, {
				value: price.mul(3),
			});

			playerPaidMints = await bbsMinter.addressToPaidMints(
				player1.address
			);

			playerAllowListMints = await bbsMinter.addressToAllowListMints(
				player1.address
			);

			playerAllowListMintsRemaining =
				await bbsMinter.allowListMintsRemaining(player1.address);

			// Modify properties to alter state
			await bbsMinter.setSupplyLimit(20000);
			supplyLimit = await bbsMinter.supplyLimit();
			currentTokenId = await bbsMinter.currentTokenId();

			allowListStartTime = await bbsMinter.allowListStartTime();
			publicStartTime = await bbsMinter.publicStartTime();

			allowListMerkleRoot = await bbsMinter.allowListMerkleRoot();

			await bbsMinter.setAllowListMints(5);
			allowListMints = await bbsMinter.allowListMints();

			await bbsMinter.setMintLimit(30);
			mintLimit = await bbsMinter.mintLimit();

			await bbsMinter.setVaultAddress(player1.address);
			vault = await bbsMinter.vault();

			// Upgrade contract
			let factory = await ethers.getContractFactory(
				"BigBearSyndicateMinter"
			);

			const contract = await upgrades.upgradeProxy(
				bbsMinter.address,
				factory
			);

			bbsMinterUpgrade = factory.attach(contract.address);

			bbs.setMinter(bbsMinterUpgrade.address);
		});

		it("should upgrade successfully", async () => {
			expect(bbsMinterUpgrade).to.not.be.undefined;
		});

		it("should carry over state", async () => {
			// BigBearSyndicate contract address should be carried over
			expect(await bbsMinterUpgrade.bbs()).to.be.equal(bbs.address);

			// Free, paid, and allow list mints should be carried over
			expect(
				await bbsMinterUpgrade.addressToFreeMintClaim(player1.address)
			).to.be.equal(playerFreeMintClaimed);
			expect(
				await bbsMinterUpgrade.addressToPaidMints(player1.address)
			).to.be.equal(playerPaidMints);
			expect(
				await bbsMinterUpgrade.addressToAllowListMints(player1.address)
			).to.be.equal(playerAllowListMints);
			expect(
				await bbsMinterUpgrade.allowListMintsRemaining(player1.address)
			).to.be.equal(playerAllowListMintsRemaining);

			// Supply limit, current token id, allow list start time, public start time, allow list merkle root, allow list mints, mint limit, and vault should be carried over
			expect(await bbsMinterUpgrade.supplyLimit()).to.be.equal(
				supplyLimit
			);
			expect(await bbsMinterUpgrade.currentTokenId()).to.be.equal(
				currentTokenId
			);
			expect(await bbsMinterUpgrade.allowListStartTime()).to.be.equal(
				allowListStartTime
			);
			expect(await bbsMinterUpgrade.publicStartTime()).to.be.equal(
				publicStartTime
			);
			expect(await bbsMinterUpgrade.allowListMerkleRoot()).to.be.equal(
				allowListMerkleRoot
			);
			expect(await bbsMinterUpgrade.allowListMints()).to.be.equal(
				allowListMints
			);
			expect(await bbsMinterUpgrade.mintLimit()).to.be.equal(mintLimit);
			expect(await bbsMinterUpgrade.vault()).to.be.equal(vault);
			expect(await bbsMinterUpgrade.price()).to.be.equal(price);
		});

		it("should set allow list start time", async () => {
			const startTime = BigNumber.from(Date.now());

			await bbsMinter.setAllowListStartTime(startTime);

			expect(await bbsMinter.allowListStartTime()).to.be.equal(startTime);
		});

		it("should set public start time", async () => {
			const startTime = BigNumber.from(Date.now());

			await bbsMinter.setPublicStartTime(startTime);

			expect(await bbsMinter.publicStartTime()).to.be.equal(startTime);
		});

		it("should set per transaction mint limit", async () => {
			const limit = 25;

			await bbsMinter.setMintLimit(limit);

			expect(await bbsMinter.mintLimit()).to.be.equal(limit);
		});
	});
});
