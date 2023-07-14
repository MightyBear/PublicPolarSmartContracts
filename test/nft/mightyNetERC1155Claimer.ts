/*
 * Copyright (c) 2022 Mighty Bear Games
 */

import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { BigNumber } from "ethers";
import { BytesLike, keccak256 } from "ethers/lib/utils";
import { ethers, upgrades } from "hardhat";
import MerkleTree from "merkletreejs/dist/MerkleTree";
import {
	MightyActionHeroesSupplyCrates,
	MightyNetERC1155Claimer,
} from "../../typechain";
import {
	BigBearSyndicateMinterTestHelper
} from "./utils/bbsMinterTestHelper";
import { deployUpgradeable } from "./utils/deploy";
import {
	buildMerkleTree,
	deployOperatorFilterRegistry,
	setProxyAdmin,
	setTransparentUpgradeableProxyAdmin,
} from "./utils/testHelper";
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("Mighty Net ERC1155 Claimer", () => {
	const baseUri =
		"https://mightynet.xyz/metadata/";
	const contractUri =
		"https://mightynet.xyz/metadata/";

	let mnERC1155Claimer: MightyNetERC1155Claimer;
	let mahSupplyCrates: MightyActionHeroesSupplyCrates;

	let owner: SignerWithAddress,
		player1: SignerWithAddress,
		player2: SignerWithAddress,
		player3: SignerWithAddress,
		proxyUpgradeAdmin: SignerWithAddress;

	let originalProxyAdminAddress: string;
	let minterRole: BytesLike;

	async function deployTestFixture() {
		const [owner, player1, player2, player3, proxyUpgradeAdmin] =
			await ethers.getSigners();

		const operatorFilterRegistry = await deployOperatorFilterRegistry();

		const mightyActionHeroesSupplyCrates =
			(await deployUpgradeable(
				"MightyActionHeroesSupplyCrates",
				"initialize",
				baseUri,
				contractUri,
				operatorFilterRegistry.address
			)) as MightyActionHeroesSupplyCrates;

		await mightyActionHeroesSupplyCrates.deployed();

		minterRole =
			await mightyActionHeroesSupplyCrates.MINTER_ROLE();

		const mnerc1155Claimer = (await deployUpgradeable(
			"MightyNetERC1155Claimer",
			"initialize",
			mightyActionHeroesSupplyCrates.address
		)) as MightyNetERC1155Claimer;

		await mnerc1155Claimer.deployed();

		originalProxyAdminAddress = (await upgrades.admin.getInstance())
			.address;

		setProxyAdmin(
			originalProxyAdminAddress,
			owner,
			mnerc1155Claimer.address,
			proxyUpgradeAdmin.address
		);

		// Fixtures can return anything you consider useful for your tests
		return {
			ownerSigner: owner,
			player1Signer: player1,
			player2Signer: player2,
			player3Signer: player3,
			proxyUpgradeAdminSigner: proxyUpgradeAdmin,
			mightyNetERC1155ClaimerContract: mnerc1155Claimer,
			mahscContract: mightyActionHeroesSupplyCrates
		};
	}

	beforeEach(async () => {
		var {
			ownerSigner,
			player1Signer,
			player2Signer,
			player3Signer,
			proxyUpgradeAdminSigner,
			mightyNetERC1155ClaimerContract,
			mahscContract
		} = await loadFixture(deployTestFixture);
		owner = ownerSigner;
		player1 = player1Signer;
		player2 = player2Signer;
		player3 = player3Signer;
		proxyUpgradeAdmin = proxyUpgradeAdminSigner;
		mnERC1155Claimer = mightyNetERC1155ClaimerContract;
		mahSupplyCrates = mahscContract;
	});

	describe("Deployment", () => {
		it("should have correct MightyNetERC1155Upgradeable address", async () => {
			expect(await mnERC1155Claimer.mnERC1155()).to.be.equal(mahSupplyCrates.address);
		});

		it("should have correct token id", async () => {
			expect(await mnERC1155Claimer.tokenId()).to.be.equal(0);
		});

		it("should be unpaused", async () => {
			expect(await mnERC1155Claimer.paused()).to
				.be.false;
		});

		it("interacted contract should be unpaused", async () => {
			expect(await mahSupplyCrates.paused()).to
				.be.false;
		});
	});

	describe("Administration", () => {

		let merkleTree: MerkleTree,
			merkleTree2: MerkleTree;

		let root: Buffer,
			root2: Buffer;

		let hexRoot: string,
			hexRoot2: string;
		beforeEach(async () => {
			merkleTree = await buildMerkleTree(
				player1.address,
				player2.address
			);
			root = merkleTree.getRoot();
			hexRoot = ethers.utils.hexlify(root);

			merkleTree2 = await buildMerkleTree(
				player1.address,
				player2.address,
				player3.address
			);
			root2 = merkleTree2.getRoot();
			hexRoot2 = ethers.utils.hexlify(root2);
		});

		it("should pause and unpause contract", async () => {
			await mnERC1155Claimer.pause();

			expect(await mnERC1155Claimer.paused()).to.be.true;

			await mnERC1155Claimer.unpause();

			expect(await mnERC1155Claimer.paused()).to.be.false;
		});

		it("only admin should be able to pause and unpause", async () => {
			await expect(mnERC1155Claimer.connect(player1).pause()).to.be.reverted;

			await mnERC1155Claimer.pause();

			await expect(mnERC1155Claimer.connect(player1).unpause()).to.be.reverted;
		});

		it("should set interacted contract address", async () => {
			await mnERC1155Claimer.setMightyNetERC1155Address(ethers.constants.AddressZero);

			expect(await mnERC1155Claimer.mnERC1155()).to.be.equal(ethers.constants.AddressZero);
		});

		it("only admin should set interacted contract address", async () => {
			await expect(mnERC1155Claimer.connect(player1).setMightyNetERC1155Address(ethers.constants.AddressZero)).to.be.reverted;

			expect(await mnERC1155Claimer.mnERC1155()).to.be.equal(mahSupplyCrates.address);
		});

		it("should push merkle root", async () => {
			await mnERC1155Claimer.pushToClaimWhitelist(root);

			expect(await mnERC1155Claimer.claimWhitelistSize()).to.be.equal(1);
			expect(await mnERC1155Claimer.claimWhitelistMerkleRoot(0)).to.be.equal(hexRoot);
		});


		it("only admin should push merkle root", async () => {
			await expect(
				mnERC1155Claimer.connect(player1).pushToClaimWhitelist(root)
			).to.be.reverted;

			expect(await mnERC1155Claimer.claimWhitelistSize()).to.be.equal(0);
		});

		it("should pop merkle root", async () => {
			await mnERC1155Claimer.pushToClaimWhitelist(root);

			expect(await mnERC1155Claimer.claimWhitelistSize()).to.be.equal(1);
			expect(await mnERC1155Claimer.claimWhitelistMerkleRoot(0)).to.be.equal(hexRoot);

			await mnERC1155Claimer.popFromClaimWhitelist();
			expect(await mnERC1155Claimer.claimWhitelistSize()).to.be.equal(0);
		});

		it("only admin should pop merkle root", async () => {
			await mnERC1155Claimer.pushToClaimWhitelist(root);

			expect(await mnERC1155Claimer.claimWhitelistSize()).to.be.equal(1);
			expect(await mnERC1155Claimer.claimWhitelistMerkleRoot(0)).to.be.equal(hexRoot);

			await expect(
				mnERC1155Claimer.connect(player1).popFromClaimWhitelist()
			).to.be.reverted;
			expect(await mnERC1155Claimer.claimWhitelistSize()).to.be.equal(1);
		});

		it("should set merkle root", async () => {
			await mnERC1155Claimer.pushToClaimWhitelist(root);

			expect(await mnERC1155Claimer.claimWhitelistSize()).to.be.equal(1);
			expect(await mnERC1155Claimer.claimWhitelistMerkleRoot(0)).to.be.equal(hexRoot);



			await mnERC1155Claimer.setClaimWhitelistMerkleRoot(root2, 0);
			expect(await mnERC1155Claimer.claimWhitelistSize()).to.be.equal(1);
			expect(await mnERC1155Claimer.claimWhitelistMerkleRoot(0)).to.be.equal(hexRoot2);
		});

		it("only admin should set merkle root", async () => {
			await mnERC1155Claimer.pushToClaimWhitelist(root);

			expect(await mnERC1155Claimer.claimWhitelistSize()).to.be.equal(1);
			expect(await mnERC1155Claimer.claimWhitelistMerkleRoot(0)).to.be.equal(hexRoot);

			const merkleTreeNew = await buildMerkleTree(
				player1.address,
				player2.address,
				player3.address
			);

			const rootNew = merkleTreeNew.getRoot();

			await expect(
				mnERC1155Claimer.connect(player1).setClaimWhitelistMerkleRoot(rootNew, 0)
			).to.be.reverted;
			expect(await mnERC1155Claimer.claimWhitelistSize()).to.be.equal(1);
			expect(await mnERC1155Claimer.claimWhitelistMerkleRoot(0)).to.be.equal(hexRoot);
		});
	});

	describe("Query", async () => {
		let merkleTree: MerkleTree,
			merkleTree2: MerkleTree;

		let root: Buffer,
			root2: Buffer;

		let hexRoot: string,
			hexRoot2: string;

		beforeEach(async () => {
			merkleTree = await buildMerkleTree(
				player1.address,
				player2.address
			);
			root = merkleTree.getRoot();
			hexRoot = ethers.utils.hexlify(root);
			await mnERC1155Claimer.pushToClaimWhitelist(root);

			merkleTree2 = await buildMerkleTree(
				player3.address
			);
			root2 = merkleTree2.getRoot();
			hexRoot2 = ethers.utils.hexlify(root2);
			await mnERC1155Claimer.pushToClaimWhitelist(root2);
		});

		it("everyone should be able to check claim list size", async () => {
			expect(await mnERC1155Claimer.claimWhitelistSize()).to.be.equal(2);
			expect(await mnERC1155Claimer.connect(player1).claimWhitelistSize()).to.be.equal(2);
		});

		it("everyone should be able to check claim list merkle root", async () => {
			expect(await mnERC1155Claimer.claimWhitelistMerkleRoot(0)).to.be.equal(hexRoot);
			expect(await mnERC1155Claimer.connect(player1).claimWhitelistMerkleRoot(0)).to.be.equal(hexRoot);

			expect(await mnERC1155Claimer.claimWhitelistMerkleRoot(1)).to.be.equal(hexRoot2);
			expect(await mnERC1155Claimer.connect(player1).claimWhitelistMerkleRoot(1)).to.be.equal(hexRoot2);
		});

		it("everyone should be able to check claim amount", async () => {
			const hexProof = merkleTree.getHexProof(keccak256(player1.address));

			expect(await mnERC1155Claimer.amountClaimable(player1.address, hexProof)).to.be.equal(1);
			expect(await mnERC1155Claimer.connect(player1).amountClaimable(player1.address, hexProof)).to.be.equal(1);

			const hexProof2 = merkleTree.getHexProof(keccak256(player2.address));

			expect(await mnERC1155Claimer.amountClaimable(player2.address, hexProof2)).to.be.equal(1);
			expect(await mnERC1155Claimer.connect(player1).amountClaimable(player2.address, hexProof2)).to.be.equal(1);

			const hexProof3 = merkleTree2.getHexProof(keccak256(player3.address));

			expect(await mnERC1155Claimer.amountClaimable(player3.address, hexProof3)).to.be.equal(2);
			expect(await mnERC1155Claimer.connect(player1).amountClaimable(player3.address, hexProof3)).to.be.equal(2);

			//Shouldnt matter if you get hexproof from a different tree
			const hexProof4 = merkleTree.getHexProof(keccak256(player3.address));

			expect(await mnERC1155Claimer.amountClaimable(player3.address, hexProof4)).to.be.equal(2);
			expect(await mnERC1155Claimer.connect(player1).amountClaimable(player3.address, hexProof4)).to.be.equal(2);

			const hexProof5 = merkleTree.getHexProof(keccak256(owner.address));

			expect(await mnERC1155Claimer.amountClaimable(owner.address, hexProof5)).to.be.equal(0);
			expect(await mnERC1155Claimer.connect(player1).amountClaimable(owner.address, hexProof5)).to.be.equal(0);

			//If wrong proof is provided we will show that you have nothing to claim
			expect(await mnERC1155Claimer.amountClaimable(player3.address, hexProof)).to.be.equal(0);
			expect(await mnERC1155Claimer.connect(player1).amountClaimable(player3.address, hexProof)).to.be.equal(0);
		});
	})

	describe("Claiming", async () => {

		let merkleTree: MerkleTree,
			merkleTree2: MerkleTree,
			merkleTree3: MerkleTree;

		let root: Buffer,
			root2: Buffer,
			root3: Buffer;

		const tokenId = 100;

		beforeEach(async () => {
			merkleTree = await buildMerkleTree(
				player1.address
			);
			root = merkleTree.getRoot();
			await mnERC1155Claimer.pushToClaimWhitelist(root);

			merkleTree2 = await buildMerkleTree(
				player2.address
			);
			root2 = merkleTree2.getRoot();
			await mnERC1155Claimer.pushToClaimWhitelist(root2);

			merkleTree3 = await buildMerkleTree(
				player3.address
			);
			root3 = merkleTree3.getRoot();
			await mnERC1155Claimer.pushToClaimWhitelist(root3);

			mnERC1155Claimer.setTokenId(tokenId);
		});

		it("should not be able to claim if minter role is not granted", async () => {
			const hexProof = merkleTree.getHexProof(keccak256(player1.address));
			await expect(
				mnERC1155Claimer.connect(player1).claim(hexProof)
			).to.be.reverted;
		});

		it("should be able to claim if minter role is granted", async () => {
			await mahSupplyCrates.grantRole(minterRole, mnERC1155Claimer.address);

			const hexProof = merkleTree.getHexProof(keccak256(player1.address));
			await mnERC1155Claimer.connect(player1).claim(hexProof);
			expect(await mahSupplyCrates.balanceOf(player1.address, tokenId)).to.be.equal(1);

			const hexProof2 = merkleTree2.getHexProof(keccak256(player2.address));
			await mnERC1155Claimer.connect(player2).claim(hexProof2);
			expect(await mahSupplyCrates.balanceOf(player2.address, tokenId)).to.be.equal(2);

			const hexProof3 = merkleTree3.getHexProof(keccak256(player3.address));
			await mnERC1155Claimer.connect(player3).claim(hexProof3);
			expect(await mahSupplyCrates.balanceOf(player3.address, tokenId)).to.be.equal(3);

			expect(await mnERC1155Claimer.amountClaimable(player1.address, hexProof)).to.be.equal(0);
			expect(await mnERC1155Claimer.amountClaimable(player2.address, hexProof2)).to.be.equal(0);
			expect(await mnERC1155Claimer.amountClaimable(player3.address, hexProof3)).to.be.equal(0);
		});

		it("if user tries to claim twice then revert with error", async () => {
			await mahSupplyCrates.grantRole(minterRole, mnERC1155Claimer.address);

			const hexProof = merkleTree.getHexProof(keccak256(player1.address));
			await mnERC1155Claimer.connect(player1).claim(hexProof);
			expect(await mahSupplyCrates.balanceOf(player1.address, tokenId)).to.be.equal(1);

			await expect(
				mnERC1155Claimer.connect(player1).claim(hexProof)
			).to.be.revertedWith(
				`UserAlreadyClaimed(\"${player1.address}\")`
			);
		});
	});

	const nullHexProof = [keccak256(ethers.constants.AddressZero)];

	describe("Upgrade", () => {
		let mnERC1155ClaimerUpgraded: MightyNetERC1155Claimer;

		let merkleTree: MerkleTree,
			merkleTree2: MerkleTree;

		let root: Buffer,
			root2: Buffer;

		let hexRoot: string,
			hexRoot2: string;

		const tokenId = 100;

		beforeEach(async () => {
			merkleTree = await buildMerkleTree(
				player1.address,
				player2.address
			);
			root = merkleTree.getRoot();
			hexRoot = ethers.utils.hexlify(root);
			await mnERC1155Claimer.pushToClaimWhitelist(root);

			merkleTree2 = await buildMerkleTree(
				player3.address
			);
			root2 = merkleTree2.getRoot();
			hexRoot2 = ethers.utils.hexlify(root2);
			await mnERC1155Claimer.pushToClaimWhitelist(root2);

			mnERC1155Claimer.setTokenId(tokenId);

			setTransparentUpgradeableProxyAdmin(
				mnERC1155Claimer.address,
				proxyUpgradeAdmin,
				originalProxyAdminAddress
			);

			// Upgrade contract
			let factory = await ethers.getContractFactory(
				"MightyNetERC1155Claimer"
			);

			const contract = await upgrades.upgradeProxy(
				mnERC1155Claimer.address,
				factory
			);

			mnERC1155ClaimerUpgraded = factory.attach(contract.address);
		});

		it("should upgrade successfully", async () => {
			expect(mnERC1155ClaimerUpgraded).to.not.be.undefined;
		});

		it("should carry over state", async () => {
			expect(await mnERC1155ClaimerUpgraded.claimWhitelistSize()).to.be.equal(2);

			expect(await mnERC1155ClaimerUpgraded.claimWhitelistMerkleRoot(0)).to.be.equal(hexRoot);
			expect(await mnERC1155ClaimerUpgraded.claimWhitelistMerkleRoot(1)).to.be.equal(hexRoot2);

			const hexProof = merkleTree.getHexProof(keccak256(player1.address));
			expect(await mnERC1155ClaimerUpgraded.amountClaimable(player1.address, hexProof)).to.be.equal(1);

			const hexProof2 = merkleTree.getHexProof(keccak256(player2.address));
			expect(await mnERC1155ClaimerUpgraded.amountClaimable(player2.address, hexProof2)).to.be.equal(1);

			const hexProof3 = merkleTree.getHexProof(keccak256(player3.address));
			expect(await mnERC1155ClaimerUpgraded.amountClaimable(player3.address, hexProof3)).to.be.equal(2);

			expect(await mnERC1155ClaimerUpgraded.mnERC1155()).to.be.equal(mahSupplyCrates.address);
			expect(await mnERC1155ClaimerUpgraded.tokenId()).to.be.equal(tokenId);
		});
	});
});
