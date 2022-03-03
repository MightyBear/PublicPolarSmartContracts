import { S3 } from "aws-sdk";
import fs from "fs";
import { ethers } from "hardhat";
import parseArgs from "minimist";

const DEFAULT_INPUT_FILE = "input/dev.tsv";
const DEFAULT_OUTPUT_DIR = "dist/metadata";
const DEFAULT_MEDIA_URI = "https://dev.cdn.mightynet.xyz/mtt/media/";
const DEFAULT_S3_BUCKET = "polar-web3-metadata-dev";

// command : HARDHAT_NETWORK=mumbai ts-node --files scripts/mtt/batchMint.ts <contract-address> -i <input tsv> -o <output directory without ending /> -c -u -m

var argv = parseArgs(process.argv.slice(2));

if (argv._.length != 1) {
	console.error(
		`Expected one argument. 
        
        Usage: ts-node batchMint.ts <contract-address>
        
        Arguments:
        
        -i input file
        -o output directory
		-e media uri
		-b s3 bucket name
		-c should create metadata
		-u should upload metadata (all files in output directory)
		-m should mint and airdrop tokens`
	);
	process.exit(1);
}
const contractAddress: string = process.argv.slice(2)[0] as string;
const inputFile = argv.i ?? DEFAULT_INPUT_FILE;
const outputDir = argv.o ?? DEFAULT_OUTPUT_DIR;
const mediaUri = argv.e ?? DEFAULT_MEDIA_URI;
const s3bucket = argv.b ?? DEFAULT_S3_BUCKET;

const shouldCreateMetadata = argv.c ?? false;
const shouldUploadMetadata = argv.u ?? false;
const mintTrophies = argv.m ?? false;

const nonAttributeColumns: string[] = [
	"Token ID",
	"Name",
	"Address",
	"Image",
	"Description",
];

interface MetadataAttribute {
	trait_type: string;
	value: string;
}

interface TrophyData {
	id: number;
	name: string;
	description: string;
	address: string;
	image: string;
	attributes: MetadataAttribute[];
}

interface TrophyMetadata {
	name: string;
	description: string;
	image: string;
	attributes: MetadataAttribute[];
}

const readData = async () => {
	const data = fs.readFileSync(inputFile, "utf8");
	const header: string[] = data
		.replace("\r\n", "\n")
		.replace("\r", "\n")
		.split("\n")[0]
		.split("\t");
	const trophyData: TrophyData[] = data
		.replace("\r\n", "\n")
		.replace("\r", "\n")
		.split("\n")
		.filter((line, index) => index > 0)
		.filter(line => line.trim().length > 0)
		.map(line => {
			const trophyLine = line.replace("\r", "").split("\t");
			const trophy: TrophyData = {
				id: 0,
				name: "",
				description: "",
				address: "",
				image: "",
				attributes: [],
			};
			trophy.id = parseInt(trophyLine[header.indexOf("Token ID")]);
			trophy.name = trophyLine[header.indexOf("Name")];
			trophy.address = trophyLine[header.indexOf("Address")];
			trophy.image = `${mediaUri}${trophyLine[header.indexOf("Image")]}`;
			trophy.description = trophyLine[header.indexOf("Description")];

			const attributes: MetadataAttribute[] = trophyLine
				.map((att, index) => {
					return {
						trait_type: header[index],
						value: att,
					};
				})
				.filter(
					(att, index) => !nonAttributeColumns.includes(header[index])
				);
			trophy.attributes = attributes;
			console.log(`Token ${trophy.id} : `, trophy);
			return trophy;
		});
	return trophyData;
};

const createMetadata = async (trophyData: TrophyData[]) => {
	console.info("Create metadata for trophies");
	if (!fs.existsSync(outputDir)) {
		fs.mkdirSync(outputDir, { recursive: true });
	}
	trophyData.forEach(async trophy => {
		const metadata = {
			name: trophy.name,
			description: trophy.description,
			image: trophy.image,
			attributes: trophy.attributes,
		};
		fs.writeFileSync(
			`${outputDir}/${trophy.id}.json`,
			JSON.stringify(metadata, null, 2)
		);
	});
};

const s3 = new S3();
const uploadMetadata = async () => {
	console.info("Upload trophy metadata");
	if (!fs.existsSync(outputDir)) {
		console.error(
			"require output directory that contains generated metadata"
		);
		process.exit();
	}
	const files = fs.readdirSync(outputDir);
	const failedUpload: string[] = [];
	files.forEach(file => {
		s3.putObject({
			Bucket: s3bucket,
			Key: `mtt/mtt/metadata/${file.replace(".json", "")}`,
			Body: fs.readFileSync(`${outputDir}/${file}`),
			ContentType: "application/json",
		})
			.promise()
			.then(res => {
				console.log(`Upload succeeded - `, res);
			})
			.catch(err => {
				console.error("Upload failed:", err);
				failedUpload.push(file);
			});
	});
	if (failedUpload.length > 0) {
		console.error("Failed uploads: ", failedUpload);
	}
};

const batchMint = async (trophyData: TrophyData[]) => {
	console.info("Batch Minting...");
	const invalidAddresses = trophyData.filter(
		data => !ethers.utils.isAddress(data.address)
	);
	if (invalidAddresses.length > 0) {
		throw new Error(
			`The following addresses are invalid: ${invalidAddresses.map(
				invalidAddress => invalidAddress.address
			)}`
		);
	}
	const addresses = trophyData.map(data => data.address);
	const tokens = trophyData.map(data => data.id);
	for (let i = 0; i < addresses.length; ++i) {
		console.log(`token ${tokens[i]} - ${addresses[i]}`);
	}
	let factory = await ethers.getContractFactory("MightyTrophy");
	console.info(`Attaching to MightyTrophy at ${contractAddress}`);
	let contract = await factory.attach(contractAddress);
	try {
		await contract.batchMint(addresses, tokens);
	} catch (e) {
		console.error(e);
		console.error(`Failed to batch mint`, addresses, tokens);
	}
};

const main = async () => {
	const trophyData = await readData();
	if (shouldCreateMetadata) {
		await createMetadata(trophyData);
	}
	if (shouldUploadMetadata) {
		await uploadMetadata();
	}
	if (mintTrophies) {
		await batchMint(trophyData);
	}
};

main();
