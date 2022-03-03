// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import { IRestrictedRegistry } from "./interfaces/IRestrictedRegistry.sol";
import { ERC721Restrictable } from "./ERC721Restrictable.sol";

error InvalidToken(address tokenContract, uint256 count);
error InvalidTokenCount(uint256 count);
error InvalidRestrictor(address restrictor);
error TokenAlreadyRestricted(address tokenContract, uint256 tokenId);
error TokenNotRestricted(address tokenContract, uint256 tokenId);

contract MightyNetERC721RestrictedRegistry is
	AccessControlUpgradeable,
	PausableUpgradeable,
	ReentrancyGuardUpgradeable,
	IRestrictedRegistry
{
	// ------------------------------
	// 			V1 Variables
	// ------------------------------

	event Restricted(address tokenContact, uint256[] tokenIds);
	event Unrestricted(address tokenContract, uint256[] tokenIds);

	mapping(bytes32 => address) private _tokenRestrictions;

	bytes32 public constant RESTRICTOR_ROLE = keccak256("RESTRICTOR_ROLE");

	/*
	 * DO NOT ADD OR REMOVE VARIABLES ABOVE THIS LINE. INSTEAD, CREATE A NEW VERSION SECTION BELOW.
	 * MOVE THIS COMMENT BLOCK TO THE END OF THE LATEST VERSION SECTION PRE-DEPLOYMENT.
	 */

	/// @custom:oz-upgrades-unsafe-allow constructor
	constructor() {
		_disableInitializers();
	}

	function initialize() public initializer {
		__AccessControl_init();
		__Pausable_init();
		__ReentrancyGuard_init();
		_grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
	}

	function isRestricted(
		address tokenContract,
		uint256 tokenId
	) public view override returns (bool) {
		bytes32 tokenHash = keccak256(abi.encodePacked(tokenContract, tokenId));
		return _isRestricted(tokenHash);
	}

	function _isRestricted(bytes32 tokenHash) internal view returns (bool) {
		return _tokenRestrictions[tokenHash] != address(0);
	}

	function restrict(
		address tokenContract,
		uint256[] calldata tokenIds
	) external override onlyRole(RESTRICTOR_ROLE) nonReentrant whenNotPaused {
		uint256 tokenCount = tokenIds.length;
		if (tokenCount == 0) {
			revert InvalidTokenCount(tokenCount);
		}
		for (uint256 i = 0; i < tokenCount; ++i) {
			uint256 tokenId = tokenIds[i];
			if (!ERC721Restrictable(tokenContract).exists(tokenId)) {
				revert InvalidToken(tokenContract, tokenId);
			}
			bytes32 tokenHash = keccak256(
				abi.encodePacked(tokenContract, tokenId)
			);
			if (_isRestricted(tokenHash)) {
				revert TokenAlreadyRestricted(tokenContract, tokenId);
			}
			_tokenRestrictions[tokenHash] = msg.sender;
		}
		emit Restricted(tokenContract, tokenIds);
	}

	function unrestrict(
		address tokenContract,
		uint256[] calldata tokenIds
	) external override onlyRole(RESTRICTOR_ROLE) nonReentrant whenNotPaused {
		uint256 tokenCount = tokenIds.length;
		if (tokenCount == 0) {
			revert InvalidTokenCount(tokenCount);
		}
		for (uint256 i = 0; i < tokenCount; ++i) {
			uint256 tokenId = tokenIds[i];
			if (!ERC721Restrictable(tokenContract).exists(tokenId)) {
				revert InvalidToken(tokenContract, tokenId);
			}
			bytes32 tokenHash = keccak256(
				abi.encodePacked(tokenContract, tokenId)
			);
			if (!_isRestricted(tokenHash)) {
				revert TokenNotRestricted(tokenContract, tokenId);
			}
			if (_tokenRestrictions[tokenHash] != msg.sender) {
				revert InvalidRestrictor(msg.sender);
			}
			_tokenRestrictions[tokenHash] = address(0);
		}
		emit Unrestricted(tokenContract, tokenIds);
	}

	function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
		_pause();
	}

	function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
		_unpause();
	}

	uint256[50] private __gap;
}
