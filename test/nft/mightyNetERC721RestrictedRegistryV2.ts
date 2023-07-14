/*
 * Copyright (c) 2023 Mighty Bear Games
 */

import { expect } from "chai";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ethers, upgrades } from "hardhat";
import {
	MightyNetERC721RestrictedRegistry,
	TestERC721Restrictable,
} from "../../typechain";
import { deployUpgradeable } from "./utils/deploy";
import { BigNumber } from "ethers";
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("MightyNetERC721RestrictedRegistryV2", () => {
	let owner: SignerWithAddress,
		restrictor: SignerWithAddress,
		restrictor2: SignerWithAddress,
		alice: SignerWithAddress,
		bob: SignerWithAddress;

	let tokenContract: TestERC721Restrictable,
		tokenContract2: TestERC721Restrictable,
		restrictedRegistry: MightyNetERC721RestrictedRegistry;

	async function expectRestrictedTokens(
		restrictedTokens: Number[],
		unrestrictedTokens: Number[],
		tokenContract: TestERC721Restrictable,
		restrictedRegistry: MightyNetERC721RestrictedRegistry
	) {
		for (let i = 0; i < restrictedTokens.length; ++i) {
			expect(
				await restrictedRegistry.isRestricted(
					tokenContract.address,
					BigNumber.from(restrictedTokens[i])
				)
			).to.be.false;
		}
		for (let i = 0; i < unrestrictedTokens.length; ++i) {
			expect(
				await restrictedRegistry.isRestricted(
					tokenContract.address,
					BigNumber.from(unrestrictedTokens[i])
				)
			).to.be.true;
		}
	}

	async function deployTestFixture() {
		const [owner, restrictor, restrictor2, alice, bob] =
			await ethers.getSigners();

		const restrictedRegistry = (await deployUpgradeable(
			"MightyNetERC721RestrictedRegistryV2",
			"initialize"
		)) as MightyNetERC721RestrictedRegistry;
		await restrictedRegistry.grantRole(
			await restrictedRegistry.RESTRICTOR_ROLE(),
			restrictor.address
		);
		await restrictedRegistry.grantRole(
			await restrictedRegistry.RESTRICTOR_ROLE(),
			restrictor2.address
		);
		const tokenContract = (await deployUpgradeable(
			"TestERC721Restrictable",
			"initialize",
			restrictedRegistry.address
		)) as TestERC721Restrictable;
		await tokenContract.mint(alice.address, 1);
		await tokenContract.mint(alice.address, 2);
		await tokenContract.mint(alice.address, 3);
		await tokenContract.connect(alice).setApprovalForAll(bob.address, true);
		const tokenContract2 = (await deployUpgradeable(
			"TestERC721Restrictable",
			"initialize",
			restrictedRegistry.address
		)) as TestERC721Restrictable;
		await tokenContract2.mint(alice.address, 1);
		await tokenContract2.mint(alice.address, 2);
		await tokenContract2.mint(alice.address, 3);
		await tokenContract2
			.connect(alice)
			.setApprovalForAll(bob.address, true);

		// Fixtures can return anything you consider useful for your tests
		return {
			ownerSigner: owner,
			restrictorSigner: restrictor,
			restrictor2Signer: restrictor2,
			aliceSigner: alice,
			bobSigner: bob,
			restrictedRegis: restrictedRegistry,
			contract1: tokenContract,
			contract2: tokenContract2,
		};
	}

	beforeEach(async () => {
		var {
			ownerSigner,
			restrictorSigner,
			restrictor2Signer,
			aliceSigner,
			bobSigner,
			restrictedRegis,
			contract1,
			contract2,
		} = await loadFixture(deployTestFixture);
		owner = ownerSigner;
		restrictor = restrictorSigner;
		restrictor2 = restrictor2Signer;
		alice = aliceSigner;
		bob = bobSigner;
		restrictedRegistry = restrictedRegis;
		tokenContract = contract1;
		tokenContract2 = contract2;
	});

	describe("Admin", () => {
		it("should only allow owner to pause", async () => {
			await expect(
				restrictedRegistry.connect(alice).pause()
			).to.be.revertedWith(
				`AccessControl: account ${alice.address.toLowerCase()} is missing role ${await restrictedRegistry.DEFAULT_ADMIN_ROLE()}`
			);
			await expect(restrictedRegistry.connect(owner).pause()).to.not.be
				.reverted;
		});

		it("should only allow owner to unpause", async () => {
			await restrictedRegistry.connect(owner).pause();
			await expect(
				restrictedRegistry.connect(alice).unpause()
			).to.be.revertedWith(
				`AccessControl: account ${alice.address.toLowerCase()} is missing role ${await restrictedRegistry.DEFAULT_ADMIN_ROLE()}`
			);
			await expect(restrictedRegistry.connect(owner).unpause()).to.not.be
				.reverted;
		});
	});

	describe("Restricting", () => {
		it("should not be able to unrestrict other restrictor's restricted tokens", async () => {
			await restrictedRegistry
				.connect(restrictor)
				.restrict(tokenContract.address, [1]);

			await expect(
				restrictedRegistry
					.connect(restrictor2)
					.unrestrict(tokenContract.address, [1])
			).to.be.revertedWith(
				`InvalidRestrictor(\"${restrictor2.address}\")`
			);
		});

		it("should only allow restrictor to restrict token", async () => {
			await expect(
				restrictedRegistry
					.connect(alice)
					.restrict(tokenContract.address, [1, 2])
			).to.be.revertedWith(
				`AccessControl: account ${alice.address.toLowerCase()} is missing role ${await restrictedRegistry.RESTRICTOR_ROLE()}`
			);
		});

		it("should have valid token count when restricting", async () => {
			await expect(
				restrictedRegistry
					.connect(restrictor)
					.restrict(tokenContract.address, [])
			).to.be.revertedWith("InvalidTokenCount(0)");
		});

		it("should not restrict when paused", async () => {
			await restrictedRegistry.connect(owner).pause();
			await expect(
				restrictedRegistry
					.connect(restrictor)
					.restrict(tokenContract.address, [1, 2])
			).to.be.revertedWith("Pausable: paused");
		});

		it("should not restrict invalid tokens", async () => {
			await expect(
				restrictedRegistry
					.connect(restrictor)
					.restrict(tokenContract.address, [4])
			).to.be.revertedWith(`InvalidToken("${tokenContract.address}", 4)`);
		});

		it("should restrict token and emit Restricted event", async () => {
			await expect(
				restrictedRegistry
					.connect(restrictor)
					.restrict(tokenContract.address, [1, 2])
			)
				.to.emit(restrictedRegistry, "Restricted")
				.withArgs(tokenContract.address, [1, 2]);
			expectRestrictedTokens([1, 2], [3], tokenContract.address);
		});

		it("should not restrict tokens if any tokens are already restricted", async () => {
			await restrictedRegistry
				.connect(restrictor)
				.restrict(tokenContract.address, [2, 3]);
			await expect(
				restrictedRegistry
					.connect(restrictor)
					.restrict(tokenContract.address, [1, 2, 3])
			).to.be.revertedWith(
				`TokenAlreadyRestricted("${tokenContract.address}", 2)`
			);
			expectRestrictedTokens([2, 3], [1], tokenContract.address);
		});

		it("should not be able to transfer a restricted token", async () => {
			await restrictedRegistry
				.connect(restrictor)
				.restrict(tokenContract.address, [1]);
			await expect(
				tokenContract
					.connect(alice)
					.transferFrom(alice.address, bob.address, 1)
			).to.be.revertedWith("TokenIsRestricted(1)");
		});

		it("should not be able to burn a restricted token", async () => {
			await restrictedRegistry
				.connect(restrictor)
				.restrict(tokenContract.address, [1]);
			await expect(
				tokenContract.connect(alice).burn(1)
			).to.be.revertedWith("TokenIsRestricted(1)");
		});

		it("should carry over restrict state after upgrading", async () => {
			await restrictedRegistry
				.connect(restrictor)
				.restrict(tokenContract.address, [1, 2]);
			await restrictedRegistry
				.connect(restrictor)
				.restrict(tokenContract2.address, [1, 2]);

			const factory = await ethers.getContractFactory(
				"MightyNetERC721RestrictedRegistryV2"
			);
			const proxy = await upgrades.upgradeProxy(
				restrictedRegistry.address,
				factory
			);
			const restrictedRegistryUpgrade = factory.attach(proxy.address);

			expect(restrictedRegistryUpgrade).to.not.be.undefined;
			expectRestrictedTokens([1, 2], [3], tokenContract.address);
			expectRestrictedTokens([1, 2], [3], tokenContract2.address);
		});

		it("should restrict tokens from different contracts", async () => {
			await restrictedRegistry
				.connect(restrictor)
				.restrict(tokenContract.address, [1, 2]);
			expectRestrictedTokens([1, 2], [3], tokenContract.address);
			expectRestrictedTokens([], [1, 2, 3], tokenContract2.address);
			await expect(
				restrictedRegistry
					.connect(restrictor)
					.restrict(tokenContract2.address, [1, 2])
			).to.not.be.reverted;
			expectRestrictedTokens([1, 2], [3], tokenContract.address);
			expectRestrictedTokens([1, 2], [3], tokenContract2.address);
		});

		it("should not restrict if tokenContract's restricted registry is not the same", async () => {
			tokenContract.connect(owner).setRestrictedRegistry(ethers.constants.AddressZero);
			await expect(restrictedRegistry
				.connect(restrictor)
				.restrict(tokenContract.address, [1, 2])
			).to.be.revertedWith(`ContractNotUsingThisRestrictedRegistry("${tokenContract.address}")`);
		});
	});

	describe("Unrestricting", () => {
		beforeEach(async () => {
			await restrictedRegistry
				.connect(restrictor)
				.restrict(tokenContract.address, [1, 2]);
			await restrictedRegistry
				.connect(restrictor)
				.restrict(tokenContract2.address, [1, 3]);
		});

		it("should only allow restrictor to unrestrict token", async () => {
			await expect(
				restrictedRegistry
					.connect(alice)
					.unrestrict(tokenContract.address, [1, 2])
			).to.be.revertedWith(
				`AccessControl: account ${alice.address.toLowerCase()} is missing role ${await restrictedRegistry.RESTRICTOR_ROLE()}`
			);
		});

		it("should have valid token count when unrestricting", async () => {
			await expect(
				restrictedRegistry
					.connect(restrictor)
					.unrestrict(tokenContract.address, [])
			).to.be.revertedWith("InvalidTokenCount(0)");
		});

		it("should not allow other restrictor to unrestrict token", async () => {
			await expect(
				restrictedRegistry
					.connect(restrictor2)
					.unrestrict(tokenContract.address, [1, 2])
			).to.be.revertedWith(`InvalidRestrictor("${restrictor2.address}")`);
		});

		it("should not unrestrict when paused", async () => {
			await restrictedRegistry.connect(owner).pause();
			await expect(
				restrictedRegistry
					.connect(restrictor)
					.unrestrict(tokenContract.address, [1, 2])
			).to.be.revertedWith("Pausable: paused");
			await restrictedRegistry.connect(owner).unpause();
		});

		it("should not unrestrict invalid tokens", async () => {
			await expect(
				restrictedRegistry
					.connect(restrictor)
					.unrestrict(tokenContract.address, [4])
			).to.be.revertedWith(`InvalidToken("${tokenContract.address}", 4)`);
		});

		it("should unrestrict token and emit Unrestricted event", async () => {
			await expect(
				restrictedRegistry
					.connect(restrictor)
					.unrestrict(tokenContract.address, [1, 2])
			)
				.to.emit(restrictedRegistry, "Unrestricted")
				.withArgs(tokenContract.address, [1, 2]);
			expectRestrictedTokens([1, 2], [3], tokenContract.address);
		});

		it("should not unrestrict tokens that are already unrestricted", async () => {
			await restrictedRegistry
				.connect(restrictor)
				.unrestrict(tokenContract.address, [1, 2]);
			await expect(
				restrictedRegistry
					.connect(restrictor)
					.unrestrict(tokenContract.address, [1, 2])
			).to.be.revertedWith(
				`TokenNotRestricted("${tokenContract.address}", 1)`
			);
		});

		it("should be able to transfer an unrestricted token", async () => {
			await restrictedRegistry
				.connect(restrictor)
				.unrestrict(tokenContract.address, [1]);
			await expect(
				tokenContract
					.connect(alice)
					.transferFrom(alice.address, bob.address, 1)
			).to.not.be.reverted;
		});

		it("should be able to burn an unrestricted token", async () => {
			await restrictedRegistry
				.connect(restrictor)
				.unrestrict(tokenContract.address, [1]);
			await expect(tokenContract.connect(alice).burn(1)).to.not.be
				.reverted;
		});

		it("should unrestrict tokens from different contracts", async () => {
			expectRestrictedTokens([1, 2], [3], tokenContract.address);
			expectRestrictedTokens([1, 3], [2], tokenContract2.address);
			await expect(
				restrictedRegistry
					.connect(restrictor)
					.unrestrict(tokenContract.address, [1])
			).to.not.be.reverted;
			await expect(
				restrictedRegistry
					.connect(restrictor)
					.unrestrict(tokenContract2.address, [1])
			).to.not.be.reverted;
			expectRestrictedTokens([2], [1, 3], tokenContract.address);
			expectRestrictedTokens([3], [1, 2], tokenContract2.address);
		});
	});
});
