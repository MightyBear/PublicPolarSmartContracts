// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721BurnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721RoyaltyUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "./ERC721Restrictable.sol";

contract TestERC721Restrictable is
	ERC721BurnableUpgradeable,
	ERC721RoyaltyUpgradeable,
	OwnableUpgradeable,
	AccessControlUpgradeable,
	ERC721Restrictable
{
	/// @custom:oz-upgrades-unsafe-allow constructor
	constructor() {
		_disableInitializers();
	}

	function initialize(
		IRestrictedRegistry restrictedRegistry_
	) public initializer {
		__ERC721_init("TestERC721Restrictable", "TTR");
		__ERC721Burnable_init();
		__ERC721Royalty_init();
		__Ownable_init();
		__AccessControl_init();
		__ERC721Restrictable_init(restrictedRegistry_);
		_setDefaultRoyalty(msg.sender, 750);
		_grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
	}

	function mint(address to, uint256 tokenId) external {
		_mint(to, tokenId);
	}

	function _burn(
		uint256 tokenId
	) internal virtual override(ERC721Upgradeable, ERC721RoyaltyUpgradeable) {
		super._burn(tokenId);
	}

	function supportsInterface(
		bytes4 interfaceId
	)
		public
		view
		virtual
		override(
			ERC721RoyaltyUpgradeable,
			ERC721Upgradeable,
			AccessControlUpgradeable
		)
		returns (bool)
	{
		return super.supportsInterface(interfaceId);
	}

	function _beforeTokenTransfer(
		address from,
		address to,
		uint256 tokenId,
		uint256 batchSize
	)
		internal
		virtual
		override(ERC721Upgradeable)
		onlyAllowUnrestricted(tokenId)
	{
		super._beforeTokenTransfer(from, to, tokenId, batchSize);
	}

	function setRestrictedRegistry(
		IRestrictedRegistry restrictedRegistry_
	) external onlyRole(DEFAULT_ADMIN_ROLE) {
		_setRestrictedRegistry(restrictedRegistry_);
	}

	function exists(uint256 tokenId) external view override returns (bool) {
		return _exists(tokenId);
	}

	uint256[50] private __gap;
}
