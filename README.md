# MightyNet Smart Contracts

Contains the smart contracts for the **MightyNet** ecosystem by **Mighty Bear Games**. Built with [OpenZeppelin](https://docs.openzeppelin.com/).

# Contracts

## _Genesis Pass (1337)_

> ### **IMightyNetGenesisPass**
>
> _contracts/1337/interfaces/IMightyNetGenesisPass.sol_
>
> The interface that is implemented by the `MightyNetGenesisPass` contract that defines the `mint` function's signature.

> ### **MightyNetGenesisPass**
>
> _contracts/1337/MightyNetGenesisPassV2.sol_
>
> The main `ERC721` contract. This is an upgradeable contract implemented with [OpenZeppelin Upgrades](https://docs.openzeppelin.com/upgrades-plugins/1.x/). This contract contains the `mint` function but is restricted to only be called by the `MightyNetGenesisPassMinter` contract.
>
> The contract was upgraded to implement operator filtering with [Operator Filter Registry](https://github.com/ProjectOpenSea/operator-filter-registry).
>
> V1 of the contract can be found in _contracts/1337/old-versions/MightyNetGenesisPassV1.sol_.

> ### **MightyNetGenesisPassMinter**
>
> _contracts/1337/MightyNetGenesisPassMinter.sol_
>
> The contract that handles the minting by calling the `MightyNetGenesisPass` contract. Largely inspired by [ForgottenRunesWarriorsMinter](https://etherscan.io/address/0xB4d9AcB0a6735058908E943e966867A266619fBD#code). This is also an upgradeable contract.
>
> Has three phases:
>
> -   **Partners phase**
>     -   Free mint - for team, partners, and addresses curated by the team.
> -   **Allow list phase**
>     -   Allow list mint - for addresses in the allow list.
> -   **Public sale phase**
>     -   Public mint - open to all addresses. An address can only mint 1 pass.

---

## _Big Bear Syndicate_

> ### **IBigBearSyndicate**
>
> _contracts/bbs/interfaces/IBigBearSyndicate.sol_
>
> The interface that is implemented by the `BigBearSyndicate` contract that defines the `mint` function's signature.

> ### **BigBearSyndicate**
>
> _contracts/bbs/BigBearSyndicate.sol_
>
> The main `ERC721` contract. This is an upgradeable contract implemented with [OpenZeppelin Upgrades](https://docs.openzeppelin.com/upgrades-plugins/1.x/). This contract contains the `mint` function but is restricted to only be called by the `BigBearSyndicateMinter` contract.
>
> Implements operator filtering with [Operator Filter Registry](https://github.com/ProjectOpenSea/operator-filter-registry).

> ### **BigBearSyndicateMinter**
>
> _contracts/bbs/BigBearSyndicateMinter.sol_
>
> The contract that handles the minting by calling the `BigBearSyndicate` contract. Largely inspired by [ForgottenRunesWarriorsMinter](https://etherscan.io/address/0xB4d9AcB0a6735058908E943e966867A266619fBD#code). This is also an upgradeable contract.
>
> Has three phases:
>
> -   **MightyNet Genesis Pass holders phase**
>     -   Free mint - for **MightyNet** Genesis Pass holders and partners. Holders can mint 2 per pass.
> -   **Allow list phase**
>     -   Allow list mint - for addresses in the allow list. Addresses in this list can mint up to 2 bears by default but some address(team) can mint up to 5 and **MightyNet** Genesis Pass holders 1.
> -   **Public sale phase**
>     -   Public mint - open to all addresses. There is no limit to how many bears can be minted by an address in this phase.

---

## _Locking & Restriction_

> ### **MightyNetLocking**
>
> _contracts/locking/MightyNetLocking.sol_
>
> The contract that handles [locking](#locking) and [unlocking](#unlocking) of NFTs. This is also an upgradeable contract. This contract only handles locking and locking [power](#power) calculations. Awarding of points will be done by an off-chain service.

> ### **IRestrictedRegistry**
>
> _contracts/restrictable/interfaces/IRestrictedRegistry.sol_
>
> The interface that is implemented by the `ERC721Restrictable` contract that defines the `isRestricted`, `restrict` and `unrestrict` function's signature.

> ### **ERC721Restrictable**
>
> _contracts/restrictable/ERC721Restrictable.sol_
>
> This contract is meant to be inherited by future restrictable token contracts in our **MightyNet** ecosystem, with the restriction being controlled by `MightyNetERC721RestrictedRegistry`.

> ### **MightyNetERC721RestrictedRegistry**
>
> _contracts/restrictable/MightyNetERC721RestrictedRegistry.sol_
>
> This is an upgradable contract that handles the restriction of all restrictable `ERC721` NFTs in our **MightyNet** ecosystem.
>
> This contract only allows other service/contract with correctly assigned role to [restrict](#restrict) or [unrestrict](#unrestrict) NFT and query if a NFT is current restricted, logic handling of a restricted NFT should be managed by other service/contract.

---

## _MightyNet Terminal_

> ### **MightyNetTerminal**
>
> _contracts/mightyNetTerminal/MightyNetTerminal.sol_
>
> The contract where our backend services will interact with to [send](#send-to-game) or [receive](#receive-from-game) items from our games.

> ### **IMightyNetERC721Assets**
>
> _contracts/extensions/interfaces/IMightyNetERC721Assets.sol_
>
> The interface that is implemented by the `MightyNetERC721Upgradable` contract that defines the `mint` and `exist` function's signature.
>
> It is also used to identify if an `ERC721` contract is part of our **MightyNet** ecosystem.

> ### **IMightyNetERC1155Assets**
>
> _contracts/extensions/interfaces/IMightyNetERC1155Assets.sol_
>
> The interface that is implemented by the `MightyNetERC1155Upgradable` contract that defines the `mintBatch` and `burnBatch` function's signature.
>
> It is also used to identify if an `ERC1155` contract is part of our **MightyNet** ecosystem.

---

## _MightyNet Upgradable ERCs_

> ### **MightyNetERC721Upgradeable**
>
> _contracts/extensions/MightyNetERC721Upgradeable.sol_
>
> This is an `ERC721` upgradeable contract modified for **MightyNet** usage, it is the basis for our contracts that uses `ERC721` standard.

> ### **MightyNetERC1155Upgradeable**
>
> _contracts/extensions/MightyNetERC1155Upgradeable.sol_
>
> This is an `ERC1155` upgradeable contract modified for **MightyNet** usage, it is the basis for our contracts that uses `ERC1155` standard.

---

## _Mighty Action Heroes_

> ### **MightyActionHeroesGadget**
>
> _contracts/gadgets/MightyActionHeroesGadget.sol_
>
> The contract that contains all gadgets in **Mighty Action Heroes**, it inherits from `MightyNetERC721Upgradeable` with no added functionality.

> ### **MightyActionHeroesBlueprints**
>
> _contracts/blueprints/MightyActionHeroesBlueprints.sol_
>
> The contract that contains all blueprints in **Mighty Action Heroes**, it inherits from `MightyNetERC1155Upgradeable` with no added functionality.

> ### **MightyActionHeroesPARTS**
>
> _contracts/PARTS/MightyActionHeroesPARTS.sol_
>
> The contract that contains all P.A.R.T.S in **Mighty Action Heroes**, it inherits from `MightyNetERC1155Upgradeable` with no added functionality.

> ### **MightyActionHeroesSupplyCrates**
>
> _contracts/supply-crates/MightyActionHeroesSupplyCrates.sol_
>
> The contract that contains all supply crates in **Mighty Action Heroes**, it inherits from `MightyNetERC1155Upgradeable` with no added functionality.

---

## _MightyNet Shop_

> ### **MightyNetShop**
>
> _contracts/shop/MightyNetShop.sol_
>
> The contract where user can interact with to purchase paid supply crates.

---

## _Utilitites_

> ### **Whitelists**
>
> _contracts/utils/Whitelists.sol_
>
> A library used that encapsulates the storage and operations on a root hash of the Merkle tree used for whitelisting.

---

## _Terminology_

> ### **Power**
>
> Each locker gains and loses power every time they lock and unlock NFTs, respectively. The contract has a constant **_BASE_POWER_** that is then multiplied by the multiplier set for lockable NFT contracts and then by the duration multiplier they wish to lock their NFT for. The duration multipliers, or what we refer to as **Time Boost**, are set by admins on the contract. Users can only select from the set durations of **Time Boosts** admins have set in the contract. They cannot select any arbitrary duration.
>
> The multipliers both on the NFT contracts and **Time Boosts** are set in the denomination of **10000**. This allows for up to 2 decimal places in percentage notation. The denomination is set in a constant **_MULTIPLIER_DENOMINATOR_**.
>
> The NFT contract multiplier and **Time Boost** multiplier are computed multiplicatively and then applied on the **_BASE_POWER_**. The formula for the amount of power gained or lost is as follows:
>
>       Total Multiplier = (NFT Contract Multiplier * Time Boost Multipler) / Multiplier Denominator
>
>       Power = Base Power * Total Multiplier / Multiplier Denominator
>
> So, for an NFT contract with a multiplier of 10000(100%) and set to a **Time Boost** with a multiplier of 12000(120%), the power is **120**:
>
>       12000 = (10000 * 12000) / 10000
>
>       120 = 100 * 12000 / 10000
>
> A user can and will most likely lock more than one NFT. The locking power of the player is just the sum of the power of all their locked NFT.
>
> Change to multipliers on NFT contracts and **Time Boosts** are will not retroactively update the power granted by already locked tokens. The power is only calculated at the point of locking.
>
> Any change in power of any user results to a change to the **_totalLockPower_** which is what the off-chain service uses to calculate a user's locking power share.

> ### **Locking**
>
> Locking is done by calling the contract's `lock(uint256[] calldata tokenIds, address contractAddress, uint256 lockSeconds)` function.
>
> Users can only lock NFTs that belong to an NFT contract set by admins with multipliers greater than 0. This is tracked by the `TokenContract[] public tokenContracts` array property in the contract. On top of that, users also have to lock for a duration that matches any of the **Time Boosts** duration which are also set by admins of the contract.
>
> Locked NFTs are restricted on the [`MightyNetERC721RestrictedRegistry`](#mightyNetERC721RestrictedRegistry) contract and cannot be transferred until the duration they locked for is over.

> ### **Unlocking**
>
> Unlocking is done by calling the contract's `unlock(uint256[] calldata tokenIds, address contractAddress)` function.
>
> Users can only unlock NFTs if the duration they locked it for has passed. Unlocking will take away the power granted by the unlocked NFTs from the owner.

> ### **Restrict**
>
> Traditional Locking requires user transfer their NFTs to a contract, but we dont want custodial ownership of the NFT asset therefore we came up with a different method of "locking" our NFTs.
>
> The restriction of our NFTs are handled under the [`MightyNetERC721RestrictedRegistry`](#mightyNetERC721RestrictedRegistry) contract. Here is how this works:
>
> -   All our token contract should reference the same `MightyNetERC721RestrictedRegistry` contract.
>     -   Essentially there only need to be one `MightyNetERC721RestrictedRegistry` contract
> -   Inside the `MightyNetERC721RestrictedRegistry` contract we have a mapping of `tokenHash` to `address`.
>
>     > `mapping(bytes32 => address)`
>
>     -   The `tokenHash` is created from the token contract address and the token id.
>     -   The `address` is the address where the token restriction is calling from.
>
> -   When a contract wants to lock a token they should first check if a token is already locked from the shared restricted registry.
>     -   You should not be able to restrict the same token twice.
> -   Once a token is restricted, if the contract has implemented proper check before transferring the contract should be able to prevent a restricted token from being transferred.
>     -   this check is done by default for all the contracts inheritted from [MightyNetERC721Upgradeable](#mightyNetERC721Upgradeable)

> ### **Unrestrict**
>
> Unrestricting is just an act of removing a previously restricted token from the `MightyNetERC721RestrictedRegistry` contract by setting the mapping of restricted token's `tokenHash` to a null address
>
> One key thing to note is that only the person/contract who restricted the token can unrestrict the restricted token

> ### **Send to game**
>
> Sending is importing an NFT asset so that it can be used in the game. When the NFT asset is imported, players can interact with these assets within our backend services and without needing to keep signing on the chain to prove ownership. NFT assets that are imported become non-tradeable.
>
> When sending an `ERC721` token to the game, the token will be restricted until the player receives it.
>
> When sending `ERC1155` tokens to the game, that amount of tokens will be burnt.

> ### **Receive from game**
>
> Receiving is exporting an item from the game so that it can be traded as a NFT asset.
>
> When receiving an `ERC721` token from the game, the token will be unrestricted.
>
> When receive `ERC1155` tokens from the game, that amount of tokens will be minted.

---

# Smart Contract Security and Trust Assumptions

> ## Deployment:
>
> All deployments and upgrades of contracts are done through a developer wallet controlled by the development team at Mighty Bear Games. Once the contracts are deployed, ownership of the proxy contract will be transferred back to a wallet owned by a founder at Mighty Bear. This establishes a clear separation of responsibilities between wallets, minimises the risk of a security breach having a significant impact on the deployed Smart Contracts and creates a secure and efficient system for managing and updating smart contracts.

> ## Restricted Registry:
>
> The effectiveness of a centralised RestrictedRegistry heavily depends on the appropriate assignment of roles and the integrity of the contracts assigned these roles. If a contract assigned the **`RESTRICTOR`** role is compromised, it could lead to potential harm. This also assumes that the admins of all contracts are highly trusted.
>
> Utilising a centralised role-based restricted registry enables us to conveniently retrieve information about token restrictions from a single, reliable source. This approach simplifies access for game services.

---

# Tests

The tests are written and ran with [Mocha](https://mochajs.org/) and [Chai](https://www.chaijs.com/).

## MightyNetGenesisPass

\_test/nft/mightyNetGenesisPass.ts

The tests for the **MightyNetGenesisPass** contract.

## MightyNetGenesisPassMinter

\_test/nft/mightyNetGPMinter.ts

The tests for the **MightyNetGenesisPassMinter** contract.

## BigBearSyndicate

\_test/nft/bigBearSyndicate.ts

The tests for the **BigBearSyndicate** contract.

## BigBearSyndicateMinter

\_test/nft/bbsMinter.ts

The tests for the **BigBearSyndicateMinter** contract.

## MightyNetLocking

\_test/nft/mightyNetLocking.ts

The tests for the **MightyNetLocking** contract.

## MightyNetTerminal

\_test/nft/mightyNetTerminal.ts

The tests for the **MightyNetTerminal** contract.

## MightyActionHeroesGadget

\_test/nft/mightyActionHeroesGadget.ts

The tests for the **MightyActionHeroesGadget** contract.

## MightyActionHeroesSupplyCrates

\_test/nft/MightyActionHeroesSupplyCrates.ts

The tests for the **MightyActionHeroesSupplyCrates** contract.
