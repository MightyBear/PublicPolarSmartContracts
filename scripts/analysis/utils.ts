/*
 * Copyright (c) 2022 Mighty Bear Games
 */

import { BigNumber, ethers } from "ethers";
import fs from "fs";

export async function exportGas(
	estimates: Record<string, BigNumber>,
	contractName: string
) {
	console.log(`Exporting gas estimates for ${contractName}...`);

	let dir = process.cwd() + "/dist/gas";

	if (!fs.existsSync(dir)) {
		fs.mkdirSync(dir, { recursive: true });
	}

	let data = "Method\tGas Estimate\n";

	for (let method in estimates) {
		const eth = ethers.utils.formatEther(estimates[method]);

		data += `${method}\t${eth}\n`;
	}

	const filename = dir + `/${contractName}.tsv`;

	fs.writeFileSync(filename, data);

	console.log(`Gas estimates exported to ${filename}`);
}
