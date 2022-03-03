// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

abstract contract ERC721PolygonChildMintable is ERC721, AccessControl {
	bytes32 public constant POS_DEPOSITOR_ROLE = keccak256("DEPOSITOR_ROLE");

	uint256 public constant POS_BATCH_LIMIT = 20;

	mapping(uint256 => bool) public withdrawnTokens;

	event WithdrawnBatch(address indexed user, uint256[] tokenIds);

	constructor(address childChainManager) {
		_grantRole(POS_DEPOSITOR_ROLE, childChainManager);
	}

	// ------------------------------
	// 		    PoS bridging
	// ------------------------------

	// Copied from https://github.com/maticnetwork/pos-portal/blob/d061ec4f672115bc9be1f5d51e7e508250f55207/contracts/child/ChildToken/ChildMintableERC721.sol#L170
	// Changes:
	// - Changed revert message header to ERC721PolygonChildMintable
	function _ensureUnwithdrawn(uint256 tokenId) internal virtual {
		require(
			!withdrawnTokens[tokenId],
			"ERC721PolygonChildMintable: TOKEN_EXISTS_ON_ROOT_CHAIN"
		);
	}

	// Copied from https://github.com/maticnetwork/pos-portal/blob/d061ec4f672115bc9be1f5d51e7e508250f55207/contracts/child/ChildToken/ChildMintableERC721.sol#L57-L79
	// Changes:
	// - Removed override keyword because it is not needed
	// - Renamed DEPOSITOR_ROLE to POS_DEPOSITOR_ROLE
	function deposit(address user, bytes calldata depositData)
		external
		onlyRole(POS_DEPOSITOR_ROLE)
	{
		if (depositData.length == 32) {
			// deposit single
			uint256 tokenId = abi.decode(depositData, (uint256));
			withdrawnTokens[tokenId] = false;
			_mint(user, tokenId);
		} else {
			// deposit batch
			uint256[] memory tokenIds = abi.decode(depositData, (uint256[]));
			uint256 length = tokenIds.length;
			for (uint256 i; i < length; i++) {
				withdrawnTokens[tokenIds[i]] = false;
				_mint(user, tokenIds[i]);
			}
		}
	}

	// Copied from https://github.com/maticnetwork/pos-portal/blob/d061ec4f672115bc9be1f5d51e7e508250f55207/contracts/child/ChildToken/ChildMintableERC721.sol#L88-L92
	// Changes:
	// - Changed revert message header to ERC721PolygonChildMintable
	function withdraw(uint256 tokenId) external {
		require(
			msg.sender == ownerOf(tokenId),
			"ERC721PolygonChildMintable: INVALID_TOKEN_OWNER"
		);
		withdrawnTokens[tokenId] = true;
		_burn(tokenId);
	}

	// Copied from https://github.com/maticnetwork/pos-portal/blob/d061ec4f672115bc9be1f5d51e7e508250f55207/contracts/child/ChildToken/ChildMintableERC721.sol#L99-L114
	// Changes:
	// - Changed revert messages header to ERC721PolygonChildMintable
	function withdrawBatch(uint256[] calldata tokenIds) external {
		uint256 length = tokenIds.length;
		require(
			length <= POS_BATCH_LIMIT,
			"ERC721PolygonChildMintable: EXCEEDS_BATCH_LIMIT"
		);

		// Iteratively burn ERC721 tokens, for performing
		// batch withdraw
		for (uint256 i; i < length; i++) {
			uint256 tokenId = tokenIds[i];

			require(
				msg.sender == ownerOf(tokenId),
				string(
					abi.encodePacked(
						"ERC721PolygonChildMintable: INVALID_TOKEN_OWNER ",
						tokenId
					)
				)
			);
			withdrawnTokens[tokenId] = true;
			_burn(tokenId);
		}

		// At last emit this event, which will be used
		// in MintableERC721 predicate contract on L1
		// while verifying burn proof
		emit WithdrawnBatch(msg.sender, tokenIds);
	}

	// ------------------------------
	// 		   Miscellaneous
	// ------------------------------

	// Overried supportsInterface to satisfy override rules
	function supportsInterface(bytes4 interfaceId)
		public
		view
		virtual
		override(ERC721, AccessControl)
		returns (bool)
	{
		return super.supportsInterface(interfaceId);
	}
}
