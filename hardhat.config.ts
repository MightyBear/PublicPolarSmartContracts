import * as dotenv from "dotenv";

import { HardhatUserConfig, task } from "hardhat/config";
import "@openzeppelin/hardhat-upgrades";
import "@nomiclabs/hardhat-etherscan";
import "@nomiclabs/hardhat-waffle";
import "@typechain/hardhat";
import "hardhat-gas-reporter";
import "solidity-coverage";
import "hardhat-contract-sizer";

dotenv.config();

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task("accounts", "Prints the list of accounts", async (taskArgs, hre) => {
	const accounts = await hre.ethers.getSigners();

	for (const account of accounts) {
		console.log(account.address);
	}
});

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

const config: HardhatUserConfig = {
	solidity: "0.8.4",
	networks: {
		hardhat: {
			chainId: 1337,
		},

		// Testnet
		testnetL1: {
			url: `https://eth-sepolia.g.alchemy.com/v2/${process.env.L1_ALCHEMY_API_KEY}`,
			accounts: [process.env.TESTNET_PRIVATE_KEY!],
		},
		testnetL2: {
			url: `https://arb-goerli.g.alchemy.com/v2/${process.env.L2_ALCHEMY_API_KEY}`,
			accounts: [process.env.TESTNET_PRIVATE_KEY!],
		},

		// Mainnet
		mainnetL1: {
			url: `https://eth-mainnet.alchemyapi.io/v2/${process.env.L1_ALCHEMY_API_KEY}`,
			accounts: [process.env.MAINNET_PRIVATE_KEY!],
		},
		mainnetL2: {
			url: `https://polygon-mainnet.g.alchemy.com/v2/${process.env.L2_ALCHEMY_API_KEY}`,
			accounts: [process.env.MAINNET_PRIVATE_KEY!],
		},
	},
	gasReporter: {
		enabled: process.env.REPORT_GAS !== undefined,
		currency: "USD",
	},
	etherscan: {
		apiKey: {
			mainnet: process.env.ETHERSCAN_API_KEY!,
			arbitrumGoerli: process.env.ARBISCAN_API_KEY!,
		},
	},
};

export default config;
