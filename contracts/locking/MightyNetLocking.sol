// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721ReceiverUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165Checker.sol";
import { IRestrictedRegistry } from "../restrictable/interfaces/IRestrictedRegistry.sol";

error InvalidTimeBoost(uint256 lockSeconds);
error InvalidTokenContract(address contractAddress);
error InvalidToken(uint256 tokenId, address contractAddress);
error InvalidLockCount(uint256 lockCount);
error InvalidUnlockCount(uint256 unlockCount);
error InvalidSecondsPerBlock(uint256 secondsPerBlock);
error Paused();
error Reentry();
error TokenAlreadyLocked(uint256 tokenId, address contractAddress);
error TokenNotLocked(uint256 tokenId, address contractAddress);
error TokenNotReady(
	uint256 tokenId,
	address contractAddress,
	uint256 readyBlock
);
error LockLimitExceeded(uint256 lockLimit);

contract MightyNetLocking is
	IERC721ReceiverUpgradeable,
	AccessControlUpgradeable
{
	// ------------------------------
	// 			V1 Variables
	// ------------------------------

	event Locked(
		address indexed lockerAddress,
		uint256[] tokenIds,
		address indexed contractAddress,
		uint256 lockSeconds,
		uint256 powerPerToken,
		uint256 endBlockNumber
	);

	event Unlocked(
		address indexed lockerAddress,
		uint256[] tokenIds,
		address indexed contractAddress
	);

	uint256 public constant BASE_POWER = 100;
	uint256 public constant MULTIPLIER_DENOMINATOR = 10000;

	struct Locker {
		mapping(address => mapping(uint256 => uint256)) endBlockNumbers;
	}

	struct TimeBoost {
		uint256 lockSeconds;
		uint256 multiplier;
	}

	struct TokenContract {
		address contractAddress;
		uint256 multiplier;
	}

	// Locking
	uint256 public secondsPerBlock;
	uint256 public lockLimit;

	TimeBoost[] private _timeBoosts;
	TokenContract[] private _tokenContracts;

	mapping(address => Locker) private _addressToLocker;

	mapping(uint256 => mapping(address => uint256)) _lockingPowers;

	// Administration
	bool private _paused;

	// Re-entry protection
	uint256 private constant NOTENTERED = 1;
	uint256 private constant ENTERED = 2;
	uint256 private _reentryStatus;

	IRestrictedRegistry public restrictedRegistry;

	/*
	 * DO NOT ADD OR REMOVE VARIABLES ABOVE THIS LINE. INSTEAD, CREATE A NEW VERSION SECTION BELOW.
	 * MOVE THIS COMMENT BLOCK TO THE END OF THE LATEST VERSION SECTION PRE-DEPLOYMENT.
	 */

	/// @custom:oz-upgrades-unsafe-allow constructor
	constructor() {
		_disableInitializers();
	}

	function initialize(
		IRestrictedRegistry restrictedRegistry_
	) public initializer {
		__AccessControl_init();

		_reentryStatus = NOTENTERED;
		_paused = false;

		// Set defaults
		_grantRole(DEFAULT_ADMIN_ROLE, msg.sender);

		secondsPerBlock = 12;
		lockLimit = 20;

		setRestrictedRegistry(restrictedRegistry_);
	}

	// ------------------------------
	// 			 Locking
	// ------------------------------

	function lock(
		uint256[] calldata tokenIds,
		address contractAddress,
		uint256 lockSeconds
	) external withinLockLimit(tokenIds.length) nonReentrant whenNotPaused {
		if (tokenIds.length == 0) {
			revert InvalidLockCount(tokenIds.length);
		}

		uint256 tokenPower = _lockingPowers[lockSeconds][contractAddress];

		if (tokenPower == 0) {
			revert InvalidTokenContract(contractAddress);
		}

		address lockerAddress = msg.sender;

		Locker storage locker = _addressToLocker[lockerAddress];

		uint256 tokenCount = tokenIds.length;

		uint256 endBlockNumber = block.number + (lockSeconds / secondsPerBlock);

		// Add the tokens to the locker
		for (uint256 i = 0; i < tokenCount; ++i) {
			locker.endBlockNumbers[contractAddress][
				tokenIds[i]
			] = endBlockNumber;
		}

		restrictedRegistry.restrict(contractAddress, tokenIds);

		emit Locked(
			lockerAddress,
			tokenIds,
			contractAddress,
			lockSeconds,
			tokenPower,
			endBlockNumber
		);
	}

	function unlock(
		uint256[] calldata tokenIds,
		address contractAddress
	) external withinLockLimit(tokenIds.length) nonReentrant whenNotPaused {
		if (tokenIds.length == 0) {
			revert InvalidUnlockCount(tokenIds.length);
		}
		address lockerAddress = msg.sender;

		Locker storage locker = _addressToLocker[lockerAddress];

		uint256 tokenCount = tokenIds.length;

		for (uint256 i = 0; i < tokenCount; ++i) {
			uint256 endBlockNumber = locker.endBlockNumbers[contractAddress][
				tokenIds[i]
			];

			if (endBlockNumber == 0) {
				revert TokenNotLocked(tokenIds[i], contractAddress);
			}

			if (block.number < endBlockNumber) {
				revert TokenNotReady(
					tokenIds[i],
					contractAddress,
					endBlockNumber
				);
			}

			// Remove the token from the locker
			delete locker.endBlockNumbers[contractAddress][tokenIds[i]];
		}

		restrictedRegistry.unrestrict(contractAddress, tokenIds);

		emit Unlocked(lockerAddress, tokenIds, contractAddress);
	}

	function _tokenContract(
		address contractAddress
	) private view returns (TokenContract storage) {
		for (uint256 i = 0; i < _tokenContracts.length; ++i) {
			TokenContract storage tc = _tokenContracts[i];

			if (tc.contractAddress == contractAddress) {
				return tc;
			}
		}

		revert InvalidTokenContract(contractAddress);
	}

	function _timeBoost(
		uint256 lockSeconds
	) private view returns (TimeBoost storage) {
		for (uint256 i = 0; i < _timeBoosts.length; ++i) {
			TimeBoost storage tb = _timeBoosts[i];

			if (tb.lockSeconds == lockSeconds) {
				return tb;
			}
		}

		revert InvalidTimeBoost(lockSeconds);
	}

	function lockedToken(
		address lockerAddress,
		address contractAddress,
		uint256 tokenId
	) external view returns (uint256) {
		Locker storage locker = _addressToLocker[lockerAddress];

		uint256 endBlockNumber = locker.endBlockNumbers[contractAddress][
			tokenId
		];

		if (endBlockNumber == 0) {
			revert InvalidToken(tokenId, contractAddress);
		}

		return endBlockNumber;
	}

	function setSecondsPerBlock(
		uint256 secondsPerBlock_
	) external onlyRole(DEFAULT_ADMIN_ROLE) {
		if (secondsPerBlock == 0) {
			revert InvalidSecondsPerBlock(secondsPerBlock_);
		}

		secondsPerBlock = secondsPerBlock_;
	}

	function _updateLockingPowers() private {
		for (uint256 i = 0; i < _timeBoosts.length; ++i) {
			TimeBoost storage tb = _timeBoosts[i];

			for (uint256 j = 0; j < _tokenContracts.length; ++j) {
				TokenContract storage tc = _tokenContracts[j];

				_lockingPowers[tb.lockSeconds][tc.contractAddress] =
					(BASE_POWER * tc.multiplier * tb.multiplier) /
					MULTIPLIER_DENOMINATOR ** 2;
			}
		}
	}

	function setTokenContract(
		address contractAddress,
		uint96 multiplier
	) external onlyRole(DEFAULT_ADMIN_ROLE) isValidContract(contractAddress) {
		for (uint256 i = 0; i < _tokenContracts.length; ++i) {
			TokenContract storage tc = _tokenContracts[i];

			if (tc.contractAddress == contractAddress) {
				tc.multiplier = multiplier;

				_updateLockingPowers();

				return;
			}
		}

		_tokenContracts.push(TokenContract(contractAddress, multiplier));

		_updateLockingPowers();
	}

	function tokenContracts() external view returns (TokenContract[] memory) {
		return _tokenContracts;
	}

	function setTimeBoost(
		uint256 lockSeconds,
		uint96 boost
	) external onlyRole(DEFAULT_ADMIN_ROLE) {
		for (uint256 i = 0; i < _timeBoosts.length; ++i) {
			if (_timeBoosts[i].lockSeconds == lockSeconds) {
				_timeBoosts[i].multiplier = boost;

				_updateLockingPowers();

				return;
			}
		}

		_timeBoosts.push(TimeBoost(lockSeconds, boost));

		_updateLockingPowers();
	}

	function timeBoosts() external view returns (TimeBoost[] memory) {
		return _timeBoosts;
	}

	function setLockLimit(
		uint256 lockLimit_
	) external onlyRole(DEFAULT_ADMIN_ROLE) {
		lockLimit = lockLimit_;
	}

	// ------------------------------
	// 			Transfers
	// ------------------------------

	function onERC721Received(
		address,
		address,
		uint256,
		bytes calldata
	) external pure override returns (bytes4) {
		return IERC721ReceiverUpgradeable.onERC721Received.selector;
	}

	// ------------------------------
	// 			   Admin
	// ------------------------------

	function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
		_paused = true;
	}

	function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
		_paused = false;
	}

	// ------------------------------
	// 			  Modifiers
	// ------------------------------
	// A lot of these modifiers are copied from OpenZeppelin's utility contracts

	modifier isValidContract(address contractAddress) {
		if (
			!(contractAddress.code.length > 0) ||
			!ERC165Checker.supportsERC165(contractAddress)
		) {
			revert InvalidTokenContract(contractAddress);
		}
		_;
	}

	modifier whenNotPaused() {
		if (_paused) {
			revert Paused();
		}
		_;
	}

	modifier nonReentrant() {
		if (_reentryStatus == ENTERED) {
			revert Reentry();
		}
		_reentryStatus = ENTERED;
		_;
		_reentryStatus = NOTENTERED;
	}

	modifier withinLockLimit(uint256 numTokens) {
		if (numTokens > lockLimit) {
			revert LockLimitExceeded(lockLimit);
		}
		_;
	}

	// ------------------------------
	// 			  Restrict
	// ------------------------------
	function setRestrictedRegistry(
		IRestrictedRegistry restrictedRegistry_
	) public onlyRole(DEFAULT_ADMIN_ROLE) {
		restrictedRegistry = restrictedRegistry_;
	}

	uint256[50] private __gap;
}
