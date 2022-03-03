// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721Upgradeable.sol";

interface IMightyNetERC721Assets is IERC721Upgradeable {
	// ------------------------------
	// 			 Minting (Receive)
	// ------------------------------

	function mint(address to, uint256 tokenId) external;

	// ------------------------------
	// 			 Query
	// ------------------------------

	function exists(uint256 tokenId) external view returns (bool);
}
