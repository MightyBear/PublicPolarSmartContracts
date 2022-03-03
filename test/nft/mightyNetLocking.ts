/*
 * Copyright (c) 2022 Mighty Bear Games
 */

import { expect } from "chai";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ethers, upgrades } from "hardhat";
import { deployBbs } from "./utils/bbsMinterTestHelper";
import {
	deployOperatorFilterRegistry,
	getBlockNumber,
	setBlockNumber,
	setProxyAdmin,
	setTransparentUpgradeableProxyAdmin,
} from "./utils/testHelper";
import {
	BigBearSyndicate,
	ERC721,
	MightyNetERC721RestrictedRegistry,
	MightyNetLocking,
	OperatorFilterRegistry,
} from "../../typechain";
import { BigNumber } from "ethers";
import { deployUpgradeable } from "./utils/deploy";
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

const day = 86400;

describe("MightyNet Locking", () => {
	const bbsBaseUri = "https://cdn.mightynet.xyz/bbs/metadata/";
	const bbsContractUri = "https://cdn.mightynet.xyz/bbs/metadata/contract";

	let owner: SignerWithAddress,
		minter: SignerWithAddress,
		alice: SignerWithAddress,
		bob: SignerWithAddress,
		charlie: SignerWithAddress,
		proxyUpgradeAdmin: SignerWithAddress;

	let originalProxyAdminAddress: string;

	let bbs: BigBearSyndicate;
	let partner: BigBearSyndicate;

	let operatorFilterRegistry: OperatorFilterRegistry;

	let mnLocking: MightyNetLocking;
	let restrictedRegistry: MightyNetERC721RestrictedRegistry;

	async function expectLockedTokens(
		ownedTokens: Number[],
		lockedTokens: Number[],
		locker: SignerWithAddress,
		lockingContract: MightyNetLocking,
		tokenContract: ERC721,
		restrictedRegistry: MightyNetERC721RestrictedRegistry
	) {
		for (let i = 0; i < ownedTokens.length; ++i) {
			expect(
				await tokenContract.ownerOf(BigNumber.from(ownedTokens[i]))
			).to.not.be.equal(lockingContract.address);
			expect(
				await tokenContract.ownerOf(BigNumber.from(ownedTokens[i]))
			).to.be.equal(locker.address);
			await expect(
				lockingContract.lockedToken(
					locker.address,
					tokenContract.address,
					BigNumber.from(ownedTokens[i])
				)
			).to.be.reverted;
			expect(
				await restrictedRegistry.isRestricted(
					tokenContract.address,
					BigNumber.from(ownedTokens[i])
				)
			).to.be.false;
		}
		for (let i = 0; i < lockedTokens.length; ++i) {
			expect(
				await tokenContract.ownerOf(BigNumber.from(lockedTokens[i]))
			).to.be.equal(locker.address);
			expect(
				await tokenContract.ownerOf(BigNumber.from(lockedTokens[i]))
			).to.not.be.equal(lockingContract.address);
			await expect(
				lockingContract.lockedToken(
					locker.address,
					tokenContract.address,
					BigNumber.from(lockedTokens[i])
				)
			).to.not.be.reverted;
			expect(
				await restrictedRegistry.isRestricted(
					tokenContract.address,
					BigNumber.from(lockedTokens[i])
				)
			).to.be.true;
		}
	}

	async function deployTestFixture() {
		const [owner, minter, alice, bob, charlie, proxyUpgradeAdmin] =
			await ethers.getSigners();

		const operatorFilterRegistry = await deployOperatorFilterRegistry();
		const restrictedRegistry = (await deployUpgradeable(
			"MightyNetERC721RestrictedRegistry",
			"initialize"
		)) as MightyNetERC721RestrictedRegistry;

		const bbs = await deployBbs(
			bbsBaseUri,
			bbsContractUri,
			operatorFilterRegistry.address,
			restrictedRegistry.address
		);

		await bbs.setMinter(minter.address);

		const partner = await deployBbs(
			bbsBaseUri,
			bbsContractUri,
			operatorFilterRegistry.address,
			restrictedRegistry.address
		);

		await partner.setMinter(minter.address);

		const mnLocking = await deployUpgradeable(
			"MightyNetLocking",
			"initialize",
			restrictedRegistry.address
		);

		await restrictedRegistry.grantRole(
			await restrictedRegistry.RESTRICTOR_ROLE(),
			mnLocking.address
		);

		// Mint 10 BBS tokens for each user
		let currentTokenId = 1;

		for (let i = 0; i < 10; ++i) {
			await bbs.connect(minter).mint(alice.address, currentTokenId++);
		}

		await bbs.connect(alice).setApprovalForAll(mnLocking.address, true);

		for (let i = 0; i < 10; ++i) {
			await bbs.connect(minter).mint(bob.address, currentTokenId++);
		}

		await bbs.connect(bob).setApprovalForAll(mnLocking.address, true);

		for (let i = 0; i < 10; ++i) {
			await bbs.connect(minter).mint(charlie.address, currentTokenId++);
		}

		await bbs.connect(charlie).setApprovalForAll(mnLocking.address, true);

		// Mint 10 Partner tokens for Alice
		for (let i = 0; i < 10; ++i) {
			await partner.connect(minter).mint(alice.address, i);
		}

		await partner.connect(alice).setApprovalForAll(mnLocking.address, true);

		originalProxyAdminAddress = (await upgrades.admin.getInstance())
			.address;

		setProxyAdmin(
			originalProxyAdminAddress,
			owner,
			mnLocking.address,
			proxyUpgradeAdmin.address
		);

		// Fixtures can return anything you consider useful for your tests
		return {
			ownerSigner: owner,
			minterSigner: minter,
			aliceSigner: alice,
			bobSigner: bob,
			charlieSigner: charlie,
			proxyUpgradeAdminSigner: proxyUpgradeAdmin,
			operatorFilterRegis: operatorFilterRegistry,
			restrictedRegis: restrictedRegistry,
			bbsContract: bbs,
			partnerContract: partner,
			mnLockingContract: mnLocking,
		};
	}

	beforeEach(async () => {
		var {
			ownerSigner,
			minterSigner,
			aliceSigner,
			bobSigner,
			charlieSigner,
			proxyUpgradeAdminSigner,
			operatorFilterRegis,
			restrictedRegis,
			bbsContract,
			partnerContract,
			mnLockingContract,
		} = await loadFixture(deployTestFixture);
		owner = ownerSigner;
		minter = minterSigner;
		alice = aliceSigner;
		bob = bobSigner;
		charlie = charlieSigner;
		proxyUpgradeAdmin = proxyUpgradeAdminSigner;
		operatorFilterRegistry = operatorFilterRegis;
		restrictedRegistry = restrictedRegis;
		bbs = bbsContract;
		partner = partnerContract;
		mnLocking = mnLockingContract;
	});

	describe("Locking", () => {
		const lockSeconds = day;

		let secondsPerBlock: number;

		beforeEach(async () => {
			secondsPerBlock = (await mnLocking.secondsPerBlock()).toNumber();

			await mnLocking.connect(owner).setTokenContract(bbs.address, 10000);
			await mnLocking.connect(owner).setTimeBoost(lockSeconds, 12000);
		});

		it("should lock token and emit Locked event", async () => {
			const endBlockNumber =
				(await getBlockNumber()) + 1 + day / secondsPerBlock;

			await expect(
				mnLocking.connect(alice).lock([1], bbs.address, lockSeconds)
			)
				.to.emit(mnLocking, "Locked")
				.withArgs(
					alice.address,
					[1],
					bbs.address,
					lockSeconds,
					120,
					endBlockNumber
				);

			await expectLockedTokens(
				[],
				[1],
				alice,
				mnLocking,
				bbs,
				restrictedRegistry
			);
		});

		it("should lock tokens and emit Locked events", async () => {
			const blockNumber = await getBlockNumber();

			let endBlockNumber = blockNumber + 1 + day / secondsPerBlock;

			await expect(
				mnLocking.connect(alice).lock([1], bbs.address, lockSeconds)
			)
				.to.emit(mnLocking, "Locked")
				.withArgs(
					alice.address,
					[1],
					bbs.address,
					lockSeconds,
					120,
					endBlockNumber
				);

			endBlockNumber = blockNumber + 2 + day / secondsPerBlock;

			await expect(
				mnLocking.connect(alice).lock([2, 3], bbs.address, lockSeconds)
			)
				.to.emit(mnLocking, "Locked")
				.withArgs(
					alice.address,
					[2, 3],
					bbs.address,
					lockSeconds,
					120,
					endBlockNumber
				);

			await expectLockedTokens(
				[],
				[1, 2, 3],
				alice,
				mnLocking,
				bbs,
				restrictedRegistry
			);
		});

		it("should revert when number of locked tokens exceeds limit", async () => {
			await mnLocking.setLockLimit(2);

			await expect(
				mnLocking
					.connect(alice)
					.lock(
						[1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
						bbs.address,
						lockSeconds
					)
			).to.be.revertedWith(`LockLimitExceeded(${2})`);
		});

		it("should not lock tokens twice", async () => {
			await mnLocking
				.connect(alice)
				.lock([1, 2, 3], bbs.address, lockSeconds);
			await expect(
				mnLocking.connect(alice).lock([1, 3], bbs.address, lockSeconds)
			).to.be.reverted;
		});

		it("should lock tokens for Alice and Bob", async () => {
			await mnLocking
				.connect(alice)
				.lock([1, 2, 3], bbs.address, lockSeconds);
			await mnLocking
				.connect(bob)
				.lock([11, 12], bbs.address, lockSeconds);
			await expectLockedTokens(
				[],
				[1, 2, 3],
				alice,
				mnLocking,
				bbs,
				restrictedRegistry
			);
			await expectLockedTokens(
				[],
				[11, 12],
				bob,
				mnLocking,
				bbs,
				restrictedRegistry
			);
		});

		it("should lock partner tokens", async () => {
			await mnLocking
				.connect(owner)
				.setTokenContract(partner.address, 5000);

			await mnLocking
				.connect(alice)
				.lock([1, 2, 3], bbs.address, lockSeconds);
			await mnLocking
				.connect(bob)
				.lock([11, 12], bbs.address, lockSeconds);
			await mnLocking
				.connect(alice)
				.lock([1, 2, 3], partner.address, lockSeconds);

			await expectLockedTokens(
				[],
				[1, 2, 3],
				alice,
				mnLocking,
				bbs,
				restrictedRegistry
			);
			await expectLockedTokens(
				[],
				[11, 12],
				bob,
				mnLocking,
				bbs,
				restrictedRegistry
			);
			await expectLockedTokens(
				[],
				[1, 2, 3],
				alice,
				mnLocking,
				partner,
				restrictedRegistry
			);
		});

		it("should only lock tokens for valid lockSeconds", async () => {
			await expect(
				mnLocking.connect(alice).lock([1], bbs.address, lockSeconds + 1)
			).to.be.reverted;
		});

		it("should only lock tokens from valid contracts", async () => {
			await expect(
				mnLocking.connect(alice).lock([1], partner.address, lockSeconds)
			).to.be.reverted;
		});

		it("should revert lock when paused", async () => {
			await mnLocking.pause();
			await expect(
				mnLocking.connect(alice).lock([1], bbs.address, lockSeconds)
			).to.be.revertedWith("Paused()");
		});

		it("should revert lock when total multiplier is 0", async () => {
			await mnLocking.connect(owner).setTokenContract(bbs.address, 0);

			const zeroBoostLockSeconds = 1000;

			await mnLocking
				.connect(owner)
				.setTimeBoost(zeroBoostLockSeconds, 0);

			await expect(
				mnLocking
					.connect(alice)
					.lock([1], bbs.address, zeroBoostLockSeconds)
			).to.be.revertedWith(`InvalidTokenContract("${bbs.address}")`);
		});

		it("should revert if locking 0 tokens", async () => {
			await expect(
				mnLocking.connect(alice).lock([], bbs.address, lockSeconds)
			).to.be.reverted;
		});
	});

	describe("Unlock", () => {
		let secondsPerBlock: number;

		beforeEach(async () => {
			secondsPerBlock = (await mnLocking.secondsPerBlock()).toNumber();

			await mnLocking.connect(owner).setTokenContract(bbs.address, 10000);

			await mnLocking.connect(owner).setTimeBoost(day, 12000);
			await mnLocking.connect(owner).setTimeBoost(day * 2, 15000);
		});

		it("should unlock ready tokens and emit events", async () => {
			await mnLocking.connect(alice).lock([1, 2], bbs.address, day);
			const firstLockedEndBlockNumber =
				(await getBlockNumber()) + day / secondsPerBlock;

			await mnLocking.connect(alice).lock([3, 4], bbs.address, day * 2);
			const secondLockedEndBlockNumber =
				firstLockedEndBlockNumber + (day * 2) / secondsPerBlock;

			await mnLocking.connect(alice).lock([5, 6], bbs.address, day);
			const thirdLockedEndBlockNumber =
				firstLockedEndBlockNumber + day / secondsPerBlock;

			await expect(
				mnLocking.connect(alice).unlock([1, 2, 3, 4, 5, 6], bbs.address)
			).to.be.revertedWith(
				`TokenNotReady(1, "${bbs.address}", ${firstLockedEndBlockNumber})`
			);

			await setBlockNumber(thirdLockedEndBlockNumber);

			await expect(mnLocking.connect(alice).unlock([1, 5], bbs.address))
				.to.emit(mnLocking, "Unlocked")
				.withArgs(alice.address, [1, 5], bbs.address);

			await expectLockedTokens(
				[1, 5],
				[2, 3, 4, 6],
				alice,
				mnLocking,
				bbs,
				restrictedRegistry
			);

			await setBlockNumber(secondLockedEndBlockNumber);

			await expect(
				mnLocking.connect(alice).unlock([6, 4, 3], bbs.address)
			)
				.to.emit(mnLocking, "Unlocked")
				.withArgs(alice.address, [6, 4, 3], bbs.address);

			await expectLockedTokens(
				[1, 3, 4, 5, 6],
				[],
				alice,
				mnLocking,
				bbs,
				restrictedRegistry
			);

			await expect(mnLocking.connect(alice).unlock([2], bbs.address))
				.to.emit(mnLocking, "Unlocked")
				.withArgs(alice.address, [2], bbs.address);

			await expectLockedTokens(
				[1, 2, 3, 4, 5, 6],
				[],
				alice,
				mnLocking,
				bbs,
				restrictedRegistry
			);
		});

		it("should only unlock owned tokens", async () => {
			await mnLocking.connect(alice).lock([1], bbs.address, day);
			await mnLocking.connect(bob).lock([11], bbs.address, day);

			const endBlockNumber =
				(await getBlockNumber()) + day / secondsPerBlock;
			await setBlockNumber(endBlockNumber);

			await expect(mnLocking.connect(alice).unlock([11], bbs.address)).to
				.be.reverted;

			await mnLocking.connect(alice).unlock([1], bbs.address);

			await expect(mnLocking.lockedToken(alice.address, bbs.address, 1))
				.to.be.reverted;
			await expect(mnLocking.lockedToken(bob.address, bbs.address, 11)).to
				.not.be.reverted;
		});

		it("should unlock partner tokens", async () => {
			await mnLocking
				.connect(owner)
				.setTokenContract(partner.address, 5000);

			await mnLocking.connect(alice).lock([1, 2], bbs.address, day);
			await mnLocking.connect(alice).lock([1, 2], partner.address, day);

			const endBlockNumber =
				(await getBlockNumber()) + day / secondsPerBlock;
			await setBlockNumber(endBlockNumber);

			await mnLocking.connect(alice).unlock([1], partner.address);

			await expectLockedTokens(
				[],
				[1, 2],
				alice,
				mnLocking,
				bbs,
				restrictedRegistry
			);
			await expectLockedTokens(
				[1],
				[2],
				alice,
				mnLocking,
				partner,
				restrictedRegistry
			);
		});

		it("should only unlock tokens from valid contracts", async () => {
			await mnLocking.connect(alice).lock([1], bbs.address, day);

			const endBlockNumber =
				(await getBlockNumber()) + day / secondsPerBlock;
			await setBlockNumber(endBlockNumber);

			await expect(mnLocking.connect(alice).unlock([1], partner.address))
				.to.be.reverted;
		});

		it("should revert unlock when paused", async () => {
			await mnLocking.connect(alice).lock([1], bbs.address, day);

			const endBlockNumber =
				(await getBlockNumber()) + day / secondsPerBlock;
			await setBlockNumber(endBlockNumber);

			await mnLocking.pause();

			await expect(mnLocking.connect(alice).unlock([1], bbs.address)).to
				.be.reverted;
		});

		it("should revert if unlocking 0 tokens", async () => {
			await mnLocking.connect(alice).lock([1], bbs.address, day);

			const endBlockNumber =
				(await getBlockNumber()) + day / secondsPerBlock;
			await setBlockNumber(endBlockNumber);

			await expect(mnLocking.connect(alice).unlock([], bbs.address)).to.be
				.reverted;
		});

		it("should revert if unlocking more tokens than are locked", async () => {
			await mnLocking.connect(alice).lock([1], bbs.address, day);

			const endBlockNumber =
				(await getBlockNumber()) + day / secondsPerBlock;
			await setBlockNumber(endBlockNumber);

			await expect(mnLocking.connect(alice).unlock([1, 2], bbs.address))
				.to.be.reverted;
		});
	});

	describe("Administration", () => {
		it("should set token contract", async () => {
			await mnLocking.connect(owner).setTokenContract(bbs.address, 10000);

			const tokenContracts = await mnLocking.tokenContracts();

			const tokenContract = tokenContracts[0];

			expect(tokenContract.contractAddress).to.equal(bbs.address);
			expect(tokenContract.multiplier).to.equal(10000);
		});

		it("should only allow admin to set token contract", async () => {
			await expect(
				mnLocking.connect(alice).setTokenContract(bbs.address, 10000)
			).to.be.reverted;
			await expect(
				mnLocking.connect(owner).setTokenContract(bbs.address, 10000)
			).to.not.be.reverted;
		});

		it("should set time boost", async () => {
			await mnLocking.connect(owner).setTimeBoost(day, 10000);

			const timeBoosts = await mnLocking.timeBoosts();

			const timeBoost = timeBoosts[0];

			expect(timeBoost.lockSeconds).to.equal(day);
			expect(timeBoost.multiplier).to.equal(10000);
		});

		it("should only allow admin to set time boost", async () => {
			await expect(mnLocking.connect(alice).setTimeBoost(day, 10000)).to
				.be.reverted;
			await expect(mnLocking.connect(owner).setTimeBoost(day, 10000)).to
				.not.be.reverted;
		});

		it("should only allow admin to pause and unpause", async () => {
			await expect(mnLocking.connect(alice).pause()).to.be.reverted;
			await expect(mnLocking.connect(alice).unpause()).to.be.reverted;
			await expect(mnLocking.connect(owner).pause()).to.not.be.reverted;
			await expect(mnLocking.connect(owner).unpause()).to.not.be.reverted;
		});

		it("should set seconds per block", async () => {
			await mnLocking.connect(owner).setSecondsPerBlock(10);

			expect(await mnLocking.secondsPerBlock()).to.equal(10);
		});

		it("should only allow admin to set seconds per block", async () => {
			await expect(mnLocking.connect(alice).setSecondsPerBlock(10)).to.be
				.reverted;
			await expect(mnLocking.connect(owner).setSecondsPerBlock(10)).to.not
				.be.reverted;
		});

		it("should set lock limit", async () => {
			await mnLocking.connect(owner).setLockLimit(10);

			expect(await mnLocking.lockLimit()).to.equal(10);
		});

		it("should only allow admin to set lock limit", async () => {
			await expect(mnLocking.connect(alice).setLockLimit(10)).to.be
				.reverted;
			await expect(mnLocking.connect(owner).setLockLimit(10)).to.not.be
				.reverted;
		});
	});

	describe("Initialization", () => {
		it("should not be able to call initialize twice", async () => {
			await expect(
				mnLocking.connect(owner).initialize(restrictedRegistry.address)
			).to.be.reverted;
		});
	});

	describe("Upgrade", () => {
		let secondsPerBlock: number;

		beforeEach(async () => {
			setTransparentUpgradeableProxyAdmin(
				mnLocking.address,
				proxyUpgradeAdmin,
				originalProxyAdminAddress
			);

			secondsPerBlock = (await mnLocking.secondsPerBlock()).toNumber();
		});

		it("should carry over state after upgrading", async () => {
			await mnLocking.connect(owner).setTokenContract(bbs.address, 10000);
			await mnLocking.connect(owner).setTimeBoost(day, 10000);

			await mnLocking.connect(alice).lock([1, 2, 3], bbs.address, day);
			await mnLocking.connect(bob).lock([11, 12], bbs.address, day);

			const endBlockNumber =
				(await getBlockNumber()) + day / secondsPerBlock;
			await setBlockNumber(endBlockNumber);

			const factory = await ethers.getContractFactory("MightyNetLocking");

			const contract = await upgrades.upgradeProxy(
				mnLocking.address,
				factory
			);

			const mnLockingUpgrade = factory.attach(contract.address);
			expect(mnLockingUpgrade).to.not.be.undefined;

			const tokenContracts = await mnLockingUpgrade.tokenContracts();
			expect(tokenContracts.length).to.equal(1);

			const bbsTokenContract = tokenContracts[0];

			expect(bbsTokenContract).to.not.be.undefined;
			expect(bbsTokenContract.contractAddress).to.equal(bbs.address);
			expect(bbsTokenContract.multiplier).to.equal(10000);

			const timeBoosts = await mnLockingUpgrade.timeBoosts();
			expect(timeBoosts.length).to.equal(1);

			const dayTimeBoost = timeBoosts[0];

			expect(dayTimeBoost).to.not.be.undefined;
			expect(dayTimeBoost.lockSeconds).to.equal(day);
			expect(dayTimeBoost.multiplier).to.equal(10000);

			await expectLockedTokens(
				[],
				[1, 2, 3],
				alice,
				mnLockingUpgrade,
				bbs,
				restrictedRegistry
			);
			await expectLockedTokens(
				[],
				[11, 12],
				bob,
				mnLockingUpgrade,
				bbs,
				restrictedRegistry
			);
		});
	});
});
