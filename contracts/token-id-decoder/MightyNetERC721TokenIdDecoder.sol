/*
 * Copyright (c) 2023 Mighty Bear Games
 */
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

contract MightyNetERC721TokenIdDecoder is Initializable {
	uint256 private constant VERSION_BITS_MASK = (1 << 5) - 1;
	uint256 private constant RARITY_BITS_MASK = ((1 << 4) - 1) << 5;
	uint256 private constant GENERATION_BITS_MASK = ((1 << 8) - 1) << 9;
	uint256 private constant TYPE_BITS_MASK = ((1 << 8) - 1) << 17;
	uint256 private constant ITEM_ID_BITS_MASK = ((1 << 12) - 1) << 25;
	uint256 private constant UNIQUE_TOKEN_BITS_MASK =
		~(VERSION_BITS_MASK +
			RARITY_BITS_MASK +
			GENERATION_BITS_MASK +
			TYPE_BITS_MASK +
			ITEM_ID_BITS_MASK);

	// ------------------------------
	// 			V1 Variables
	// ------------------------------

	/*
	 * DO NOT ADD OR REMOVE VARIABLES ABOVE THIS LINE. INSTEAD, CREATE A NEW VERSION SECTION BELOW.
	 * MOVE THIS COMMENT BLOCK TO THE END OF THE LATEST VERSION SECTION PRE-DEPLOYMENT.
	 */

	/// @custom:oz-upgrades-unsafe-allow constructor
	constructor() {
		_disableInitializers();
	}

	function initialize() public initializer {}

	function getVersion(uint256 tokenId) external pure returns (uint256) {
		return tokenId & VERSION_BITS_MASK;
	}

	function getRarity(uint256 tokenId) external pure returns (uint256) {
		return (tokenId & RARITY_BITS_MASK) >> 5;
	}

	function getGeneration(uint256 tokenId) external pure returns (uint256) {
		return (tokenId & GENERATION_BITS_MASK) >> 9;
	}

	function getType(uint256 tokenId) external pure returns (uint256) {
		return (tokenId & TYPE_BITS_MASK) >> 17;
	}

	function getItemId(uint256 tokenId) external pure returns (uint256) {
		return (tokenId & ITEM_ID_BITS_MASK) >> 25;
	}

	function getUniqueTokenId(uint256 tokenId) external pure returns (uint256) {
		return (tokenId & UNIQUE_TOKEN_BITS_MASK) >> 37;
	}
}
