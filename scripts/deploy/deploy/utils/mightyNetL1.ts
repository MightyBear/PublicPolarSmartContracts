import fse from "fs-extra";

console.warn(
	"WARNING: This script is meant for deploying the whole MightyNet L1 contract suite to a testnet. It is not meant for production use."
);
console.info("Contracts will be deployed with development metadata URLs.");

import { deploy, deployProxy } from "../../utils";
import { ethers } from "hardhat";
import {
	BigBearSyndicate,
	BigBearSyndicateMinter,
	MightyNetGenesisPass,
	MightyNetGenesisPassMinter,
} from "../../../../typechain";

async function main() {
	console.info("Cleaning up artifacts directory");
	let artifactsDir = process.cwd() + "/dist/contracts";

	if (fse.existsSync(artifactsDir)) {
		// Delete the artifacts directory
		fse.removeSync(artifactsDir);
	}

	console.info("Deploying MightyNet L1 contracts");
	await deployContracts();
}

async function deployContracts() {
	// Deploy OperatorFilterRegistry
	const operatorFilterRegistryAddress = await deploy(
		"OperatorFilterRegistry"
	);

	// Deploy MightyNetERC721RestrictedRegistry
	const restrictedRegistryAddress = await deployProxy(
		"MightyNetERC721RestrictedRegistry",
		"initialize"
	);

	// Deploy BigBearSyndicate and BigBearSyndicateMinter
	const { bbsAddress, bbsMinterAddress } = await deployBbs(
		operatorFilterRegistryAddress,
		restrictedRegistryAddress
	);

	// Deploy MightyNetGenesisPass and MightyNetGenesisPassMinter
	const { mightyNetGenesisPassAddress, mightyNetGenesisPassMinterAddress } =
		await deployMNGenesisPass(
			operatorFilterRegistryAddress,
			restrictedRegistryAddress
		);

	// Deploy MightyNetLocking
	const timeBoosts: Record<number, number> = {
		10: 12000,
		60: 18000,
		300: 28000,
		600: 50000,
	};

	const tokenContracts: Record<string, number> = {
		[bbsAddress]: 10000,
		[mightyNetGenesisPassAddress]: 40000,
	};

	const mnLockingAddress = await deployMNLocking(
		restrictedRegistryAddress,
		timeBoosts,
		tokenContracts
	);

	// Output contract addresses
	console.info(`BigBearSyndicate: ${bbsAddress}`);
	console.info(`BigBearSyndicateMinter: ${bbsMinterAddress}`);
	console.info(`MightyNetGenesisPass: ${mightyNetGenesisPassAddress}`);
	console.info(
		`MightyNetGenesisPassMinter: ${mightyNetGenesisPassMinterAddress}`
	);
	console.info(`MightyNetLocking: ${mnLockingAddress}`);
	console.info(
		`MightyNetERC721RestrictedRegistry: ${restrictedRegistryAddress}`
	);
	console.info(`OperatorFilterRegistry: ${operatorFilterRegistryAddress}`);
}

async function deployMNLocking(
	restrictedRegistryAddress: string,
	timeBoosts: Record<number, number>,
	tokenContracts: Record<string, number>
) {
	const mnLockingAddress = await deployProxy(
		"MightyNetLocking",
		"initialize",
		restrictedRegistryAddress
	);

	const restrictedRegistryFactory = await ethers.getContractFactory(
		"MightyNetERC721RestrictedRegistry"
	);

	const restrictedRegistry = restrictedRegistryFactory.attach(
		restrictedRegistryAddress
	);

	await restrictedRegistry.grantRole(
		await restrictedRegistry.RESTRICTOR_ROLE(),
		mnLockingAddress
	);

	// Setup time boosts and token contract multipliers
	const mnLockingFactory = await ethers.getContractFactory(
		"MightyNetLocking"
	);

	const mnLocking = mnLockingFactory.attach(mnLockingAddress);

	await mnLocking.setLockLimit(100);

	for (const [seconds, boost] of Object.entries(timeBoosts)) {
		await mnLocking.setTimeBoost(seconds, boost);
	}

	for (const [tokenContract, multiplier] of Object.entries(tokenContracts)) {
		await mnLocking.setTokenContract(tokenContract, multiplier);
	}

	return mnLockingAddress;
}

async function deployMNGenesisPass(
	operatorFilterRegistryAddress: string,
	restrictedRegistryAddress: string
) {
	const mightyNetGenesisPassAddress = await deployProxy(
		"MightyNetGenesisPass",
		"initialize",
		"https://dev.cdn.mightynet.xyz/1337/metadata/",
		"https://dev.cdn.mightynet.xyz/1337/metadata/contract",
		operatorFilterRegistryAddress,
		restrictedRegistryAddress
	);

	// Deploy MightyNetGenesisPassMinter
	const mightyNetGenesisPassMinterAddress = await deployProxy(
		"MightyNetGenesisPassMinter",
		"initialize",
		mightyNetGenesisPassAddress
	);

	const mightyNetGenesisPassFactory = await ethers.getContractFactory(
		"MightyNetGenesisPass"
	);

	const mightyNetGenesisPass = mightyNetGenesisPassFactory.attach(
		mightyNetGenesisPassAddress
	) as MightyNetGenesisPass;

	await mightyNetGenesisPass.setMinter(mightyNetGenesisPassMinterAddress);

	const mightyNetGenesisPassMinterFactory = await ethers.getContractFactory(
		"MightyNetGenesisPassMinter"
	);

	const mightyNetGenesisPassMinter = mightyNetGenesisPassMinterFactory.attach(
		mightyNetGenesisPassMinterAddress
	) as MightyNetGenesisPassMinter;

	// Set phase to public phase
	await mightyNetGenesisPassMinter.setPhaseTimes(0, 1, 2);

	return { mightyNetGenesisPassAddress, mightyNetGenesisPassMinterAddress };
}

async function deployBbs(
	operatorFilterRegistryAddress: string,
	restrictedRegistryAddress: string
) {
	const bbsAddress = await deployProxy(
		"BigBearSyndicate",
		"initialize",
		"https://dev.cdn.mightynet.xyz/bbs/metadata/",
		"https://dev.cdn.mightynet.xyz/bbs/metadata/contract",
		operatorFilterRegistryAddress,
		restrictedRegistryAddress
	);

	// Deploy BigBearSyndicateMinter
	const bbsMinterAddress = await deployProxy(
		"BigBearSyndicateMinter",
		"initialize",
		bbsAddress
	);

	const bbsFactory = await ethers.getContractFactory("BigBearSyndicate");

	const bbs = bbsFactory.attach(bbsAddress) as BigBearSyndicate;

	await bbs.setMinter(bbsMinterAddress);

	const bbsMinterFactory = await ethers.getContractFactory(
		"BigBearSyndicateMinter"
	);

	const bbsMinter = bbsMinterFactory.attach(
		bbsMinterAddress
	) as BigBearSyndicateMinter;

	// Set phase to public phase
	await bbsMinter.setPhaseTimes(0, 1, 2);

	return { bbsAddress, bbsMinterAddress };
}

main();
