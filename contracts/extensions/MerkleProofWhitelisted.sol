// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

// Inspired by https://medium.com/@ItsCuzzo/using-merkle-trees-for-nft-whitelists-523b58ada3f9
abstract contract MerkleProofWhitelisted {
	bytes32 public rootHash;

	event RootHashUpdated(bytes32 rootHash);

	function _setRootHash(bytes32 _rootHash) internal virtual {
		rootHash = _rootHash;

		emit RootHashUpdated(rootHash);
	}

	modifier onlyWhitelisted(bytes32[] calldata proof) {
		require(
			isWhitelisted(msg.sender, proof),
			"MerkleProofWhitelist: Not whitelisted"
		);
		_;
	}

	function isWhitelisted(address user, bytes32[] calldata proof)
		public
		view
		returns (bool)
	{
		bytes32 leaf = keccak256(abi.encodePacked(user));

		return MerkleProof.verify(proof, rootHash, leaf);
	}
}
