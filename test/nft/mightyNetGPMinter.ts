/*
 * Copyright (c) 2022 Mighty Bear Games
 */

import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { BigNumber } from "ethers";
import { keccak256 } from "ethers/lib/utils";
import { ethers, upgrades } from "hardhat";
import {
	MightyNetGenesisPass,
	MightyNetGenesisPassMinter,
	OperatorFilterRegistry,
} from "../../typechain";
import { deployUpgradeable } from "./utils/deploy";
import {
	deployMightyNetGP,
	deployMightyNetGPMinter,
	MightyNetGenesisPassMinterTestHelper,
} from "./utils/mightyNetGPMinterTestHelper";
import {
	buildMerkleTree,
	deployOperatorFilterRegistry,
	setProxyAdmin,
	setTransparentUpgradeableProxyAdmin,
} from "./utils/testHelper";
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("MightyNet Genesis Pass Minter", () => {
	const mightyNetGPBaseUri = "https://mightynet.xyz/metadata/1337/";
	const mightyNetGPContractUri = "https://mightynet.xyz/metadata/1337";

	let mightyNetGP: MightyNetGenesisPass;

	let operatorFilterRegistry: OperatorFilterRegistry;

	let mightyNetGPMinter: MightyNetGenesisPassMinter;

	let owner: SignerWithAddress,
		minter: SignerWithAddress,
		player1: SignerWithAddress,
		player2: SignerWithAddress,
		vault: SignerWithAddress,
		proxyUpgradeAdmin: SignerWithAddress;

	let originalProxyAdminAddress: string;

	const defaultStartTime = BigNumber.from(
		"0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
	);

	let mightyNetGPMinterTestHelper: MightyNetGenesisPassMinterTestHelper;

	async function deployTestFixture() {
		const [owner, minter, player1, player2, vault, proxyUpgradeAdmin] =
			await ethers.getSigners();

		const operatorFilterRegistry = await deployOperatorFilterRegistry();
		const restrictedRegistry = await deployUpgradeable(
			"MightyNetERC721RestrictedRegistry",
			"initialize"
		);

		// Deploy MightyNetGenesisPass contract
		const mightyNetGP = await deployMightyNetGP(
			mightyNetGPBaseUri,
			mightyNetGPContractUri,
			operatorFilterRegistry.address,
			restrictedRegistry.address
		);

		const mightyNetGPMinter = await deployMightyNetGPMinter(
			mightyNetGP.address
		);

		await mightyNetGP.setMinter(mightyNetGPMinter.address);

		const mightyNetGPMinterTestHelper =
			new MightyNetGenesisPassMinterTestHelper(mightyNetGPMinter);

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
			vaultSigner: vault,
			proxyUpgradeAdminSigner: proxyUpgradeAdmin,
			operatorFilterRegis: operatorFilterRegistry,
			mightyNetGPContract: mightyNetGP,
			mightyNetGPMinterContract: mightyNetGPMinter,
			mightyNetGPMinterTestHelperFixture: mightyNetGPMinterTestHelper,
		};
	}

	beforeEach(async () => {
		var {
			ownerSigner,
			minterSigner,
			player1Signer,
			player2Signer,
			vaultSigner,
			proxyUpgradeAdminSigner,
			operatorFilterRegis,
			mightyNetGPContract,
			mightyNetGPMinterContract,
			mightyNetGPMinterTestHelperFixture,
		} = await loadFixture(deployTestFixture);
		owner = ownerSigner;
		minter = minterSigner;
		player1 = player1Signer;
		player2 = player2Signer;
		vault = vaultSigner;
		proxyUpgradeAdmin = proxyUpgradeAdminSigner;
		operatorFilterRegistry = operatorFilterRegis;
		mightyNetGP = mightyNetGPContract;
		mightyNetGPMinter = mightyNetGPMinterContract;
		mightyNetGPMinterTestHelper = mightyNetGPMinterTestHelperFixture;
	});

	describe("Deployment", () => {
		it("should have correct MightyNetGenesisPass address", async () => {
			expect(await mightyNetGPMinter.mightyNetGP()).to.be.equal(
				mightyNetGP.address
			);
		});

		it("should have default guaranteed mint start time", async () => {
			expect(await mightyNetGPMinter.guaranteedStartTime()).to.be.equal(
				defaultStartTime
			);
		});

		it("should have default allow list start time", async () => {
			expect(await mightyNetGPMinter.allowListStartTime()).to.be.equal(
				defaultStartTime
			);
		});

		it("should have default public start time", async () => {
			expect(await mightyNetGPMinter.publicStartTime()).to.be.equal(
				defaultStartTime
			);
		});
	});

	describe("Administration", () => {
		it("should pause and unpause contract", async () => {
			await mightyNetGP.pause();

			expect(await mightyNetGP.paused()).to.be.true;

			await mightyNetGP.unpause();

			expect(await mightyNetGP.paused()).to.be.false;
		});

		it("only owner should be able to pause and unpause", async () => {
			await expect(mightyNetGP.connect(player1).pause()).to.be.reverted;

			await mightyNetGP.pause();

			await expect(mightyNetGP.connect(player1).unpause()).to.be.reverted;
		});

		it("should set MightyNetGenesisPass address", async () => {
			const address = ethers.Wallet.createRandom().address;

			await mightyNetGPMinter.setMightyNetGenesisPassAddress(address);

			expect(await mightyNetGPMinter.mightyNetGP()).to.be.equal(address);
		});

		it("only owner should be able to set MightyNetGenesisPass address", async () => {
			const address = ethers.Wallet.createRandom().address;

			await expect(
				mightyNetGPMinter
					.connect(player1)
					.setMightyNetGenesisPassAddress(address)
			).to.be.reverted;
		});

		it("should set guaranteed mint start time", async () => {
			const startTime = BigNumber.from(Date.now());

			await mightyNetGPMinter.setGuaranteedStartTime(startTime);

			expect(await mightyNetGPMinter.guaranteedStartTime()).to.be.equal(
				startTime
			);
		});

		it("only admin should be able to set guaranteed mint start time", async () => {
			const startTime = BigNumber.from(Date.now());

			await expect(
				mightyNetGPMinter
					.connect(player1)
					.setGuaranteedStartTime(startTime)
			).to.be.reverted;
		});

		it("should set allow list start time", async () => {
			const startTime = BigNumber.from(Date.now());

			await mightyNetGPMinter.setAllowListStartTime(startTime);

			expect(await mightyNetGPMinter.allowListStartTime()).to.be.equal(
				startTime
			);
		});

		it("only admin should be able to set allow list start time", async () => {
			const startTime = BigNumber.from(Date.now());

			await expect(
				mightyNetGPMinter
					.connect(player1)
					.setAllowListStartTime(startTime)
			).to.be.reverted;
		});

		it("should set public start time", async () => {
			const startTime = BigNumber.from(Date.now());

			await mightyNetGPMinter.setPublicStartTime(startTime);

			expect(await mightyNetGPMinter.publicStartTime()).to.be.equal(
				startTime
			);
		});

		it("only admin should be able to set public start time", async () => {
			const startTime = BigNumber.from(Date.now());

			await expect(
				mightyNetGPMinter.connect(player1).setPublicStartTime(startTime)
			).to.be.reverted;
		});
	});

	describe("Minting", async () => {
		describe("Guaranteed", () => {
			it("should mint MightyNetGenesisPass for address with guaranteed mints", async () => {
				const mints = 1;

				await mightyNetGPMinterTestHelper.readyGuaranteedMint(
					player1.address,
					mints
				);

				await mightyNetGPMinter.connect(player1).guaranteedMint(mints);
			});

			it("should revert mint if address guaranteed mints allowance will be exceeded", async () => {
				const mints = 1;

				await mightyNetGPMinterTestHelper.readyGuaranteedMint(
					player1.address,
					mints
				);

				await expect(
					mightyNetGPMinter.connect(player1).guaranteedMint(2)
				).to.be.revertedWith(
					`MintAllowanceExceeded("${player1.address}", ${mints})`
				);
			});

			it("should revert mint if address does not have guaranteed mints", async () => {
				await mightyNetGPMinterTestHelper.startGuaranteedPhase();

				await expect(
					mightyNetGPMinter.connect(player1).guaranteedMint(1)
				).to.be.revertedWith(
					`MintAllowanceExceeded("${player1.address}", 0)`
				);
			});

			it("should mint equal to number of MightNetGenesisPasses requested", async () => {
				const mints = 2;

				await mightyNetGPMinterTestHelper.readyGuaranteedMint(
					player1.address,
					mints
				);

				await mightyNetGPMinter.connect(player1).guaranteedMint(mints);

				// Minted MightNetGenesisPasses should have IDs 1 and 2
				const mintedPasses = [1, 2];

				// Check that MightNetGenesisPasses were minted and owned by player 1
				for (let id of mintedPasses) {
					expect(await mightyNetGP.ownerOf(id)).to.be.equal(
						player1.address
					);
				}
			});

			it("should revert when guaranteed phase has not started", async () => {
				const mints = 1;

				await mightyNetGPMinterTestHelper.readyGuaranteedMint(
					player1.address,
					mints,
					undefined,
					false
				);

				await expect(
					mightyNetGPMinter.connect(player1).guaranteedMint(1)
				).to.be.revertedWith(`PhaseNotStarted(${defaultStartTime})`);
			});

			it("should revert when guaranteed phase is over", async () => {
				const mints = 1;

				await mightyNetGPMinterTestHelper.readyGuaranteedMint(
					player1.address,
					mints
				);

				await mightyNetGPMinterTestHelper.startAllowListPhase();

				const allowListStartTime =
					await mightyNetGPMinter.allowListStartTime();

				await expect(
					mightyNetGPMinter.connect(player1).guaranteedMint(1)
				).to.be.revertedWith(
					`PhaseOver(${allowListStartTime.toString()})`
				);
			});

			it("should revert when no more available supply", async () => {
				const mints = 2;

				await mightyNetGPMinterTestHelper.readyGuaranteedMint(
					player1.address,
					mints,
					1
				);

				// Try to mint 2 MightyNetGenesisPasses but only 1 is available
				await expect(
					mightyNetGPMinter.connect(player1).guaranteedMint(2)
				).to.be.revertedWith("NotEnoughSupply");
			});

			it("should revert when paused", async () => {
				const mints = 1;

				await mightyNetGPMinterTestHelper.readyGuaranteedMint(
					player1.address,
					mints
				);
				await mightyNetGPMinter.pause();

				await expect(
					mightyNetGPMinter.connect(player1).guaranteedMint(1)
				).to.be.revertedWith("Pausable: paused");
			});

			it("should revert mint if transaction mint limit exceeded", async () => {
				const mintLimit = (
					await mightyNetGPMinter.mintLimit()
				).toNumber();

				const mints = mintLimit + 1;

				await mightyNetGPMinterTestHelper.readyGuaranteedMint(
					player1.address,
					mints
				);

				await expect(
					mightyNetGPMinter.connect(player1).guaranteedMint(mints)
				).to.be.revertedWith(`MintLimitExceeded(${mintLimit})`);
			});
		});

		describe("Allow list", () => {
			it("should mint MightyNetGenesisPass with address on allow list", async () => {
				const hexProof =
					await mightyNetGPMinterTestHelper.readyAllowListMint(
						player1.address
					);

				await mightyNetGPMinter
					.connect(player1)
					.allowListMint(hexProof);
			});

			it("should be in allow list phase when start time has past", async () => {
				await mightyNetGPMinterTestHelper.startAllowListPhase();

				expect(await mightyNetGPMinter.isInAllowListPhase()).to.be.true;
			});

			it("should not be in allow list phase when public sale has started", async () => {
				await mightyNetGPMinterTestHelper.startAllowListPhase();
				await mightyNetGPMinterTestHelper.startPublicPhase();

				expect(await mightyNetGPMinter.isInAllowListPhase()).to.be
					.false;
			});

			it("only addresses in the allow list should be able to mint", async () => {
				await mightyNetGPMinterTestHelper.startAllowListPhase();

				await expect(
					mightyNetGPMinter
						.connect(player1)
						.allowListMint(nullHexProof)
				).to.be.revertedWith(`NotWhitelisted("${player1.address}")`);
			});

			it("addresses with guaranteed mint but not in the allow list should not be able to mint", async () => {
				await mightyNetGPMinterTestHelper.readyGuaranteedMint(
					player1.address,
					1
				);

				await mightyNetGPMinterTestHelper.startAllowListPhase();

				await expect(
					mightyNetGPMinter
						.connect(player1)
						.allowListMint(nullHexProof)
				).to.be.revertedWith(`NotWhitelisted("${player1.address}")`);
			});

			it("should revert when allow list phase has not started", async () => {
				const hexProof =
					await mightyNetGPMinterTestHelper.readyAllowListMint(
						player1.address,
						1,
						false
					);

				await expect(
					mightyNetGPMinter.connect(player1).allowListMint(hexProof)
				).to.be.revertedWith(`PhaseNotStarted(${defaultStartTime})`);
			});

			it("should revert when allow list phase is over", async () => {
				const hexProof =
					await mightyNetGPMinterTestHelper.readyAllowListMint(
						player1.address
					);

				await mightyNetGPMinterTestHelper.startPublicPhase();

				const publicStartTime =
					await mightyNetGPMinter.publicStartTime();

				await expect(
					mightyNetGPMinter.connect(player1).allowListMint(hexProof)
				).to.be.revertedWith(
					`PhaseOver(${publicStartTime.toString()})`
				);
			});

			it("should revert when mint already claimed", async () => {
				const hexProof =
					await mightyNetGPMinterTestHelper.readyAllowListMint(
						player1.address
					);

				// Mint once
				await mightyNetGPMinter
					.connect(player1)
					.allowListMint(hexProof);

				// Try to mint again
				await expect(
					mightyNetGPMinter.connect(player1).allowListMint(hexProof)
				).to.be.revertedWith(
					`MintAllowanceExceeded("${player1.address}", 0)`
				);
			});

			it("should revert when no more available supply", async () => {
				const hexProof =
					await mightyNetGPMinterTestHelper.readyAllowListMint(
						player1.address,
						0
					);

				await expect(
					mightyNetGPMinter.connect(player1).allowListMint(hexProof)
				).to.be.revertedWith("NotEnoughSupply");
			});

			it("should revert when paused", async () => {
				const hexProof =
					await mightyNetGPMinterTestHelper.readyAllowListMint(
						player1.address
					);

				await mightyNetGPMinter.pause();

				await expect(
					mightyNetGPMinter.connect(player1).allowListMint(hexProof)
				).to.be.revertedWith("Pausable: paused");
			});

			it("address that minted in guaranteed phase should not be able to mint in allow list phase", async () => {
				await mightyNetGPMinterTestHelper.readyGuaranteedMint(
					player1.address,
					1
				);

				await mightyNetGPMinter.connect(player1).guaranteedMint(1);

				const hexProof =
					await mightyNetGPMinterTestHelper.readyAllowListMint(
						player1.address
					);

				await expect(
					mightyNetGPMinter.connect(player1).allowListMint(hexProof)
				).to.be.revertedWith(
					`MintAllowanceExceeded("${player1.address}", 0)`
				);
			});
		});

		describe("Public", () => {
			it("should mint MightyNetGenesisPass", async () => {
				await mightyNetGPMinterTestHelper.startPublicPhase();

				await mightyNetGPMinter.connect(player1).publicMint();
			});

			it("should be in public phase when start time has past", async () => {
				await mightyNetGPMinterTestHelper.startPublicPhase();

				expect(await mightyNetGPMinter.isInPublicPhase()).to.be.true;
			});

			it("should revert when public phase has not started", async () => {
				await expect(
					mightyNetGPMinter.connect(player1).publicMint()
				).to.be.revertedWith(`PhaseNotStarted(${defaultStartTime})`);
			});

			it("should revert when no more available supply", async () => {
				await mightyNetGPMinter.setSupplyLimit(0);

				await mightyNetGPMinterTestHelper.startPublicPhase();

				await expect(
					mightyNetGPMinter.connect(player1).publicMint()
				).to.be.revertedWith("NotEnoughSupply");
			});

			it("should revert when paused", async () => {
				await mightyNetGPMinter.setSupplyLimit(1);

				await mightyNetGPMinterTestHelper.startPublicPhase();

				await mightyNetGPMinter.pause();

				await expect(
					mightyNetGPMinter.connect(player1).publicMint()
				).to.be.revertedWith("Pausable: paused");
			});

			it("address that minted in guaranteed phase should not be able to mint in public phase", async () => {
				await mightyNetGPMinterTestHelper.readyGuaranteedMint(
					player1.address,
					1
				);

				await mightyNetGPMinter.connect(player1).guaranteedMint(1);

				await mightyNetGPMinterTestHelper.startPublicPhase();

				await expect(
					mightyNetGPMinter.connect(player1).publicMint()
				).to.be.revertedWith(
					`MintAllowanceExceeded("${player1.address}", 0)`
				);
			});

			it("address that minted in allow list phase should not be able to mint in public phase", async () => {
				const hexProof =
					await mightyNetGPMinterTestHelper.readyAllowListMint(
						player1.address
					);

				await mightyNetGPMinter
					.connect(player1)
					.allowListMint(hexProof);

				await mightyNetGPMinterTestHelper.startPublicPhase();

				await expect(
					mightyNetGPMinter.connect(player1).publicMint()
				).to.be.revertedWith(
					`MintAllowanceExceeded("${player1.address}", 0)`
				);
			});
		});
	});

	describe("Whitelisting", () => {
		describe("Guaranteed", () => {
			it("should set guaranteed mints for address", async () => {
				const mints = 1;

				await mightyNetGPMinter.setGuaranteedMints(
					player1.address,
					mints
				);

				expect(
					await mightyNetGPMinter.addressToGuaranteedMints(
						player1.address
					)
				).to.equal(mints);
			});

			it("only admins should be able to set guaranteed mints for address", async () => {
				await expect(
					mightyNetGPMinter
						.connect(player1)
						.setGuaranteedMints(player1.address, 1)
				).to.be.reverted;
			});

			it("should return 0 if address does not have guaranteed mints", async () => {
				expect(
					await mightyNetGPMinter.addressToGuaranteedMints(
						player1.address
					)
				).to.be.equal(0);
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

				await mightyNetGPMinter.setAllowListMerkleRoot(root);

				expect(await mightyNetGPMinter.allowListMerkleRoot()).to.equal(
					hexRoot
				);
			});

			it("only admin should be able to set allow list Merkle tree root hash", async () => {
				const merkleTree = await buildMerkleTree(
					player1.address,
					player2.address
				);

				// Set contract Merkle root hash
				const root = merkleTree.getRoot();

				await expect(
					mightyNetGPMinter
						.connect(player1)
						.setAllowListMerkleRoot(root)
				).to.be.reverted;
			});

			it("should return true if in allow list whitelist", async () => {
				const hexProof =
					await mightyNetGPMinterTestHelper.readyAllowListMint(
						player1.address
					);

				expect(
					await mightyNetGPMinter.isAllowListWhitelisted(
						player1.address,
						hexProof
					)
				).to.be.true;
			});

			it("should return false if not in allow list whitelist", async () => {
				const hexProof =
					await mightyNetGPMinterTestHelper.readyAllowListMint(
						player1.address
					);

				expect(
					await mightyNetGPMinter.isAllowListWhitelisted(
						player2.address,
						hexProof
					)
				).to.be.false;
			});
		});
	});

	describe("Exploits", () => {
		it("should prevent mint-and-transfer to bypass guaranteed mint allowance", async () => {
			await mightyNetGPMinterTestHelper.readyGuaranteedMint(
				player1.address,
				1
			);

			// Mint and transfer MightyNetGenesisPasss
			const tokenId = 1;

			const mints = 1;

			await mightyNetGPMinter.connect(player1).guaranteedMint(mints);

			await mightyNetGP
				.connect(player1)
				["safeTransferFrom(address,address,uint256)"](
					player1.address,
					player2.address,
					tokenId
				);

			// mint limit should still apply for player 1
			await expect(
				mightyNetGPMinter.connect(player1).guaranteedMint(mints)
			).to.be.revertedWith(
				`MintAllowanceExceeded("${player1.address}", 0)`
			);
		});

		it("should prevent mint-and-transfer to bypass allow list mint allowance", async () => {
			const hexProof =
				await mightyNetGPMinterTestHelper.readyAllowListMint(
					player1.address
				);

			// Mint and transfer MightyNetGenesisPasss
			const tokenId = 1;

			await mightyNetGPMinter.connect(player1).allowListMint(hexProof);

			await mightyNetGP
				.connect(player1)
				["safeTransferFrom(address,address,uint256)"](
					player1.address,
					player2.address,
					tokenId
				);

			// mint limit should still apply for player 1
			await expect(
				mightyNetGPMinter.connect(player1).allowListMint(hexProof)
			).to.be.revertedWith(
				`MintAllowanceExceeded("${player1.address}", 0)`
			);
		});

		it("should prevent mint-and-transfer to bypass public mint allowance", async () => {
			await mightyNetGPMinterTestHelper.startPublicPhase();

			await mightyNetGPMinter.connect(player1).publicMint();

			await mightyNetGP
				.connect(player1)
				["safeTransferFrom(address,address,uint256)"](
					player1.address,
					player2.address,
					1
				);

			await expect(
				mightyNetGPMinter.connect(player1).publicMint()
			).to.be.revertedWith(
				`MintAllowanceExceeded("${player1.address}", 0)`
			);
		});
	});

	const nullHexProof = [keccak256(ethers.constants.AddressZero)];

	describe("Upgrade", () => {
		let mightyNetGPMinterUpgrade: MightyNetGenesisPassMinter;

		let playerFreeMintClaimed: boolean;

		let supplyLimit: BigNumber;
		let currentTokenId: BigNumber;

		let guaranteedMerkleRoot: string;
		let allowListMerkleRoot: string;

		let guaranteedStartTime: BigNumber;
		let allowListStartTime: BigNumber;
		let publicStartTime: BigNumber;

		let mintLimit: BigNumber;

		beforeEach(async () => {
			setTransparentUpgradeableProxyAdmin(
				mightyNetGPMinter.address,
				proxyUpgradeAdmin,
				originalProxyAdminAddress
			);

			// Mint passes for each phase to add to state
			await mightyNetGPMinterTestHelper.readyGuaranteedMint(
				player1.address,
				1
			);

			await mightyNetGPMinter.connect(player1).guaranteedMint(1);

			playerFreeMintClaimed = await mightyNetGPMinter.addressToClaimed(
				player1.address
			);

			// Modify properties to alter state
			await mightyNetGPMinter.setSupplyLimit(2000);
			supplyLimit = await mightyNetGPMinter.supplyLimit();
			currentTokenId = await mightyNetGPMinter.currentTokenId();

			guaranteedStartTime = await mightyNetGPMinter.guaranteedStartTime();
			allowListStartTime = await mightyNetGPMinter.allowListStartTime();
			publicStartTime = await mightyNetGPMinter.publicStartTime();

			allowListMerkleRoot = await mightyNetGPMinter.allowListMerkleRoot();

			await mightyNetGPMinter.setMintLimit(30);
			mintLimit = await mightyNetGPMinter.mintLimit();

			// Upgrade contract
			let factory = await ethers.getContractFactory(
				"MightyNetGenesisPassMinter"
			);

			const contract = await upgrades.upgradeProxy(
				mightyNetGPMinter.address,
				factory
			);

			mightyNetGPMinterUpgrade = factory.attach(contract.address);

			mightyNetGP.setMinter(mightyNetGPMinterUpgrade.address);
		});

		it("should upgrade successfully", async () => {
			expect(mightyNetGPMinterUpgrade).to.not.be.undefined;
		});

		it("should carry over state", async () => {
			// MightyNetGenesisPass contract address should be carried over
			expect(await mightyNetGPMinterUpgrade.mightyNetGP()).to.be.equal(
				mightyNetGP.address
			);

			// Player mint claim should be carried over
			expect(
				await mightyNetGPMinterUpgrade.addressToClaimed(player1.address)
			).to.be.equal(playerFreeMintClaimed);

			//  Supply limit, current token ID, start times, mint limit, and merkle roots should be carried over
			expect(await mightyNetGPMinterUpgrade.supplyLimit()).to.be.equal(
				supplyLimit
			);
			expect(await mightyNetGPMinterUpgrade.currentTokenId()).to.be.equal(
				currentTokenId
			);
			expect(
				await mightyNetGPMinterUpgrade.guaranteedStartTime()
			).to.be.equal(guaranteedStartTime);
			expect(
				await mightyNetGPMinterUpgrade.allowListStartTime()
			).to.be.equal(allowListStartTime);
			expect(
				await mightyNetGPMinterUpgrade.publicStartTime()
			).to.be.equal(publicStartTime);
			expect(
				await mightyNetGPMinterUpgrade.allowListMerkleRoot()
			).to.be.equal(allowListMerkleRoot);
			expect(await mightyNetGPMinterUpgrade.mintLimit()).to.be.equal(
				mintLimit
			);
		});

		it("should set guaranteed mints for address", async () => {
			const mints = 1;

			await mightyNetGPMinter.setGuaranteedMints(player2.address, mints);

			expect(
				await mightyNetGPMinter.addressToGuaranteedMints(
					player2.address
				)
			).to.equal(mints);
		});
	});
});
