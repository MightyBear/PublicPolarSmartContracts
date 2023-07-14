/*
 * Copyright (c) 2023 Mighty Bear Games
 */

import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { BytesLike } from "ethers";
import { ethers, upgrades } from "hardhat";
import {
	MightyNetShop,
} from "../../typechain";
import {
	setProxyAdmin,
	setTransparentUpgradeableProxyAdmin,
} from "./utils/testHelper";
import { deployUpgradeable } from "./utils/deploy";
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("MightyNet Shop", () => {
	let mnShop: MightyNetShop;

	let owner: SignerWithAddress,
		player1: SignerWithAddress,
		player2: SignerWithAddress,
		vault: SignerWithAddress,
		proxyUpgradeAdmin: SignerWithAddress;

	let originalProxyAdminAddress: string;

	let adminRole: BytesLike;

	async function deployTestFixture() {
		const [
			owner,
			player1,
			player2,
			vault,
			proxyUpgradeAdmin,
		] = await ethers.getSigners();

		const mnShop = (await deployUpgradeable(
			"MightyNetShop",
			"initialize",
			vault.address
		)) as MightyNetShop;

		await mnShop.deployed();

		adminRole = await mnShop.DEFAULT_ADMIN_ROLE();

		originalProxyAdminAddress = (await upgrades.admin.getInstance())
			.address;

		setProxyAdmin(
			originalProxyAdminAddress,
			owner,
			mnShop.address,
			proxyUpgradeAdmin.address
		);

		// Fixtures can return anything you consider useful for your tests
		return {
			ownerSigner: owner,
			player1Signer: player1,
			player2Signer: player2,
			vaultSigner: vault,
			proxyUpgradeAdminSigner: proxyUpgradeAdmin,
			mightyNetShop: mnShop
		};
	}

	beforeEach(async () => {
		var {
			ownerSigner,
			player1Signer,
			player2Signer,
			vaultSigner,
			proxyUpgradeAdminSigner,
			mightyNetShop
		} = await loadFixture(deployTestFixture);
		owner = ownerSigner;
		player1 = player1Signer;
		player2 = player2Signer;
		vault = vaultSigner;
		proxyUpgradeAdmin = proxyUpgradeAdminSigner;
		mnShop = mightyNetShop;
	});

	describe("Deployment", () => {

		it("should be unpaused", async () => {
			expect(await mnShop.paused()).to.be.false;
		});

		it("next shop item id amount should be 0", async () => {
			expect(await mnShop.nextShopItemId()).to.be.equal(0);
		});

		it("vault should be vault address by default (which we used to initialise)", async () => {
			expect(await mnShop.vault()).to.be.equal(
				vault.address
			);
		});

		it("initialize function negative check", async () => {
			await expect(mnShop.initialize(vault.address)).to.be.revertedWith(
				"Initializable: contract is already initialized"
			);
		});
	});

	describe("Administration", () => {
		it("should pause and unpause contract", async () => {
			await mnShop.pause();

			expect(await mnShop.paused()).to.be.true;

			await mnShop.unpause();

			expect(await mnShop.paused()).to.be.false;
		});

		it("only admins should be able to pause and unpause", async () => {
			await expect(mnShop.connect(player1).pause()).to.be.reverted;

			await mnShop.pause();

			await expect(mnShop.connect(player1).unpause()).to.be.reverted;
		});

		it("should grant admin role", async () => {
			await mnShop.grantRole(adminRole, player1.address);

			expect(await mnShop.hasRole(adminRole, player1.address)).to.be
				.true;
		});

		it("only admins should be able to grant roles", async () => {
			await expect(
				mnShop
					.connect(player1)
					.grantRole(adminRole, player1.address)
			).to.be.reverted;
		});

		it("should be able to change vault address", async () => {
			await mnShop.setVaultAddress(player1.address);

			expect(await mnShop.vault()).to.be.equal(player1.address);
		});

		it("only admin should be able to change vault address", async () => {
			await expect(
				mnShop.connect(player1).setVaultAddress(player1.address)
			).to.be.reverted;
		});
	});

	describe("Shop Admin", () => {

		let staticItemId = "staticItemId";
		let itemSupply = 200;
		let itemPrice = 50;

		let staticItem1Id = "staticItem1Id";
		let item1Supply = 1000;
		let item1Price = 30000;

		beforeEach(async () => {
			await mnShop.addShopItem(staticItemId, itemSupply, itemPrice, true)
		});

		it("should be able to add shop item", async () => {
			await expect(
				mnShop.addShopItem(staticItem1Id, item1Supply, item1Price, true)
			)
				.to.emit(mnShop, "ShopItemAdded")
				.withArgs(
					1,
					[staticItem1Id, item1Supply, item1Price, true],
				);

			var shopItem = await mnShop.shopItems(1);
			expect(shopItem.staticItemId).to.be.equal(staticItem1Id);
			expect(shopItem.supply).to.be.equal(item1Supply);
			expect(shopItem.price).to.be.equal(item1Price);
			expect(shopItem.isEnabled).to.be.true;
		});

		it("only admins should be able to add shop item", async () => {
			await expect(
				mnShop
					.connect(player1)
					.addShopItem(staticItem1Id, item1Supply, item1Price, true)
			).to.be.revertedWith(
				`AccessControl: account ${player1.address.toLowerCase()} is missing role ${adminRole}`
			);
		});

		it("should be able to set static item ID", async () => {
			let newStaticItemId = "newStaticItemId";

			await expect(
				mnShop.setShopItemStaticItemId(0, newStaticItemId)
			)
				.to.emit(mnShop, "ShopItemUpdate")
				.withArgs(
					0,
					[newStaticItemId, itemSupply, itemPrice, true],
				);

			let shopItem = await mnShop.shopItems(0);
			expect(shopItem.staticItemId).to.be.equal(newStaticItemId);
		});

		it("only admins should be able to set static item ID", async () => {
			let newStaticItemId = "newStaticItemId";
			await expect(
				mnShop
					.connect(player1)
					.setShopItemStaticItemId(0, newStaticItemId)
			).to.be.revertedWith(
				`AccessControl: account ${player1.address.toLowerCase()} is missing role ${adminRole}`
			);
		});

		it("should be able to add supply", async () => {
			let deltaSupply = 200;

			await expect(
				mnShop.addShopItemSupply(0, deltaSupply)
			)
				.to.emit(mnShop, "ShopItemUpdate")
				.withArgs(
					0,
					[staticItemId, deltaSupply + itemSupply, itemPrice, true],
				);

			let shopItem = await mnShop.shopItems(0);
			expect(shopItem.supply).to.be.equal(deltaSupply + itemSupply);
		});

		it("only admins should be able to add supply", async () => {
			let deltaSupply = 200;
			await expect(
				mnShop
					.connect(player1)
					.addShopItemSupply(0, deltaSupply)
			).to.be.revertedWith(
				`AccessControl: account ${player1.address.toLowerCase()} is missing role ${adminRole}`
			);
		});

		it("should be able to set price", async () => {
			let newShopItemPrice = 5000;

			await expect(
				mnShop.setShopItemPrice(0, newShopItemPrice)
			)
				.to.emit(mnShop, "ShopItemUpdate")
				.withArgs(
					0,
					[staticItemId, itemSupply, newShopItemPrice, true],
				);

			let shopItem = await mnShop.shopItems(0);
			expect(shopItem.price).to.be.equal(newShopItemPrice);
		});

		it("only admins should be able to set price", async () => {
			let newShopItemPrice = 5000;
			await expect(
				mnShop
					.connect(player1)
					.setShopItemPrice(0, newShopItemPrice)
			).to.be.revertedWith(
				`AccessControl: account ${player1.address.toLowerCase()} is missing role ${adminRole}`
			);
		});

		it("should be able to set is enable", async () => {

			await expect(
				mnShop.setShopItemEnable(0, false)
			)
				.to.emit(mnShop, "ShopItemUpdate")
				.withArgs(
					0,
					[staticItemId, itemSupply, itemPrice, false],
				);
			let shopItem = await mnShop.shopItems(0);
			expect(shopItem.isEnabled).to.be.false;
		});

		it("only admins should be able to set is enable", async () => {
			await expect(
				mnShop
					.connect(player1)
					.setShopItemEnable(0, false)
			).to.be.revertedWith(
				`AccessControl: account ${player1.address.toLowerCase()} is missing role ${adminRole}`
			);
		});


		it("should be able to delete shop item", async () => {
			await expect(
				mnShop.deteleShopItem(0)
			)
				.to.emit(mnShop, "ShopItemDeleted")
				.withArgs(
					0
				);

			let shopItem = await mnShop.shopItems(0);
			expect(shopItem.staticItemId).to.be.equal("");
			expect(shopItem.supply).to.be.equal(0);
			expect(shopItem.price).to.be.equal(0);
			expect(shopItem.isEnabled).to.be.false;
		});

		it("only admin should be able to delete shop item", async () => {
			await expect(
				mnShop
					.connect(player1)
					.deteleShopItem(0)
			).to.be.revertedWith(
				`AccessControl: account ${player1.address.toLowerCase()} is missing role ${adminRole}`
			);
		});

		it("invalid id check", async () => {
			let invalidId = 100;
			await expect(
				mnShop
					.setShopItemStaticItemId(invalidId, "")
			).to.be.revertedWith(
				`InvalidShopItemId(${invalidId})`
			);
			await expect(
				mnShop
					.addShopItemSupply(invalidId, 0)
			).to.be.revertedWith(
				`InvalidShopItemId(${invalidId})`
			);
			await expect(
				mnShop
					.setShopItemPrice(invalidId, 0)
			).to.be.revertedWith(
				`InvalidShopItemId(${invalidId})`
			);
			await expect(
				mnShop
					.setShopItemEnable(invalidId, false)
			).to.be.revertedWith(
				`InvalidShopItemId(${invalidId})`
			);
			await expect(
				mnShop
					.deteleShopItem(invalidId)
			).to.be.revertedWith(
				`InvalidShopItemId(${invalidId})`
			);
		});
	});

	describe("Purchasing", () => {
		var itemId = 0;
		let staticItemId = "staticItemId";
		let itemSupply = 200;
		let itemPrice = 50;

		beforeEach(async () => {
			await mnShop.addShopItem(staticItemId, itemSupply, itemPrice, true)
		});

		it("should be able to purchase without role and emit correct event", async () => {
			var shopItem = await mnShop.shopItems(0);
			var supplyToPurchase = 3;

			await expect(
				mnShop
					.connect(player1)
					.purchaseItem(
						0,
						supplyToPurchase,
						{
							value: itemPrice * supplyToPurchase,
						}
					)
			)
				.to.emit(mnShop, "ItemBought")
				.withArgs(
					0,
					shopItem.staticItemId,
					supplyToPurchase,
					player1.address
				);

			// Contract balance should be price
			expect(
				await ethers.provider.getBalance(mnShop.address)
			).to.equal(itemPrice * supplyToPurchase);

			shopItem = await mnShop.shopItems(0);
			expect(
				shopItem.supply
			).to.equal(itemSupply - supplyToPurchase);
		});

		it("should not be able to purchase 0 item", async () => {
			var supplyToPurchase = 0;

			await expect(
				mnShop
					.connect(player1)
					.purchaseItem(
						itemId,
						supplyToPurchase,
						{
							value: itemPrice * supplyToPurchase,
						}
					)
			)
				.to.be.revertedWith(`InvalidSupply()`);
		});

		it("should not be able to purchase more than supply", async () => {
			var supplyToPurchase = itemSupply + 1;

			await expect(
				mnShop
					.connect(player1)
					.purchaseItem(
						itemId,
						supplyToPurchase,
						{
							value: itemPrice * supplyToPurchase,
						}
					)
			)
				.to.be.revertedWith(`NotEnoughSupply(${itemId})`);
		});

		it("should not be able to purchase if item id does not exist", async () => {
			var supplyToPurchase = 1;
			var wrongId = 21;

			await expect(
				mnShop
					.connect(player1)
					.purchaseItem(
						wrongId,
						supplyToPurchase,
						{
							value: itemPrice * supplyToPurchase + 1,
						}
					)
			)
				.to.be.revertedWith(`InvalidShopItemId(${wrongId})`);
		});

		it("should not be able to purchase if item static id is empty", async () => {
			var supplyToPurchase = 1;
			mnShop.setShopItemStaticItemId(itemId, "");

			await expect(
				mnShop
					.connect(player1)
					.purchaseItem(
						itemId,
						supplyToPurchase,
						{
							value: itemPrice * supplyToPurchase + 1,
						}
					)
			)
				.to.be.revertedWith(`InvalidShopItemId(${itemId})`);
		});

		it("should not be able to purchase if price is 0", async () => {
			var supplyToPurchase = 1;
			mnShop.setShopItemPrice(itemId, 0);

			await expect(
				mnShop
					.connect(player1)
					.purchaseItem(
						itemId,
						supplyToPurchase,
						{
							value: itemPrice * supplyToPurchase + 1,
						}
					)
			)
				.to.be.revertedWith(`InvalidShopItemId(${itemId})`);
		});

		it("should not be able to purchase if item is disabled", async () => {
			var supplyToPurchase = 1;
			mnShop.setShopItemEnable(itemId, false);

			await expect(
				mnShop
					.connect(player1)
					.purchaseItem(
						itemId,
						supplyToPurchase,
						{
							value: itemPrice * supplyToPurchase + 1,
						}
					)
			)
				.to.be.revertedWith(`InvalidShopItemId(${itemId})`);
		});

		it("should not be able to purchase if eth value is wrong", async () => {
			var supplyToPurchase = 10;

			await expect(
				mnShop
					.connect(player1)
					.purchaseItem(
						itemId,
						supplyToPurchase,
						{
							value: itemPrice * supplyToPurchase + 1,
						}
					)
			)
				.to.be.revertedWith(`IncorrectEtherValue(${itemPrice * supplyToPurchase})`);
		});
	});

	describe("Withdraw", () => {
		let staticItemId = "staticItemId";
		let itemSupply = 200;
		let itemPrice = 50;

		beforeEach(async () => {
			await mnShop.addShopItem(staticItemId, itemSupply, itemPrice, true)
		});

		it("only admin should be able to withdraw balance", async () => {
			const amount = ethers.utils.parseEther("1.0");

			await expect(mnShop.connect(player1).withdraw(amount)).to.be
				.reverted;
		});

		it("should withdraw all of balance to vault address", async () => {
			const balance = await vault.getBalance();
			var supplyToPurchase = 3;
			var price = itemPrice * supplyToPurchase

			await mnShop.connect(player1).purchaseItem(0, supplyToPurchase, {
				value: price,
			});

			// Credit balance
			await mnShop.withdrawAll();

			expect(await vault.getBalance()).to.equal(balance.add(price));
		});

		it("should withdraw a portion of balance to vault address", async () => {
			const balance = await vault.getBalance();
			const percentageToWithdraw = 0.3;
			const remainingPercentage = 1 - percentageToWithdraw;

			await mnShop.connect(player1).purchaseItem(0, 1, {
				value: itemPrice,
			});

			await mnShop.withdraw(itemPrice * percentageToWithdraw);

			expect(await vault.getBalance()).to.equal(balance.add(itemPrice * percentageToWithdraw));

			expect(
				await ethers.provider.getBalance(mnShop.address)
			).to.equal(itemPrice * remainingPercentage);
		});

		it("should revert when withdrawing more than balance", async () => {
			const amount = ethers.utils.parseEther("1.0");

			await expect(mnShop.withdraw(amount)).to.be.revertedWith(
				`InsufficientBalance(0, ${amount})`
			);
		});

		it("should revert when withdrawing all with zero balance", async () => {
			await expect(mnShop.withdrawAll()).to.be.revertedWith(
				`InsufficientBalance(0, 1)`
			);
		});
	});

	describe("Upgrade", () => {
		let mngUpgrade: MightyNetShop;

		let staticItemId = "staticItemId";
		let itemSupply = 1000;
		let itemPrice = 30000;

		beforeEach(async () => {
			setTransparentUpgradeableProxyAdmin(
				mnShop.address,
				proxyUpgradeAdmin,
				originalProxyAdminAddress
			);

			await mnShop.addShopItem(staticItemId, itemSupply, itemPrice, true)

			// Upgrade contract to MightyActionHeroGadgets Upgradeable V2
			let factory = await ethers.getContractFactory("MightyNetShop");

			const contract = await upgrades.upgradeProxy(
				mnShop.address,
				factory
			);

			mngUpgrade = factory.attach(contract.address);
		});

		it("should upgrade successfully", async () => {
			expect(mngUpgrade).to.not.be.undefined;
		});

		it("should carry over state", async () => {
			var shopItem = await mnShop.shopItems(0);
			expect(shopItem.staticItemId).to.be.equal(staticItemId);
			expect(shopItem.supply).to.be.equal(itemSupply);
			expect(shopItem.price).to.be.equal(itemPrice);
			expect(shopItem.isEnabled).to.be.true;
		});
	});
});
