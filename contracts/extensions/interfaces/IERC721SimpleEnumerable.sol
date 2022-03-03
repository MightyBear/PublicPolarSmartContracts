// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

interface IERC721SimpleEnumerable {
	function ownedTokens(address user) external view returns (uint256[] memory);
}
