// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import { IRestrictedRegistry } from "../../restrictable/interfaces/IRestrictedRegistry.sol";

interface IMightyNetRestrictable {
	function restrictedRegistry() external view returns (IRestrictedRegistry);
}
