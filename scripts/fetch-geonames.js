import fs from 'node:fs';
import { createWriteStream, existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import geohash from 'ngeohash';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Parse CLI arguments
function parseArgs() {
	let datasetUrl = 'https://download.geonames.org/export/dump/allCountries.zip';
	let populationThreshold = 200;

	for (const arg of process.argv.slice(2)) {
		const urlMatch = arg.match(/^(?:--url=|--dataset-url=)?(https?:\/\/.+)$/i);
		if (urlMatch) {
			datasetUrl = urlMatch[1];
			continue;
		}

		const popMatch = arg.match(/^(?:--min-pop=)?(\d+)$/);
		if (popMatch) {
			populationThreshold = Number(popMatch[1]);
			continue;
		}
	}

	return { datasetUrl, populationThreshold };
}

const { datasetUrl: ZIP_URL, populationThreshold: POPULATION_THRESHOLD } = parseArgs();
const ADMIN1_URL = 'https://download.geonames.org/export/dump/admin1CodesASCII.txt';

// Derive local filenames from custom dataset URL if provided (e.g. AU.zip -> AU.zip / AU.txt)
const zipFilename = path.basename(new URL(ZIP_URL).pathname) || 'allCountries.zip';
const txtFilename = zipFilename.endsWith('.zip')
	? zipFilename.replace(/\.zip$/i, '.txt')
	: zipFilename;

const ZIP_FILE_PATH = path.resolve(__dirname, zipFilename);
const TXT_FILE_PATH = path.resolve(__dirname, txtFilename);
const ADMIN1_FILE_PATH = path.resolve(__dirname, 'admin1CodesASCII.txt');
const PUBLIC_DIRECTORY = path.resolve(__dirname, '../public');
const OUTPUT_FILE_PATH = path.resolve(PUBLIC_DIRECTORY, 'geonames.txt');

const GEOHASH_PRECISION = 6; // Length of geohash string (6 is ~1.2km precision)

/**
 * Normalizes location name starting letter to a single Latin a-z character.
 */
function getNormalizedFirstLetter(name) {
	if (!name) return 'a';
	const normalizedStr = name
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.replace(/[^a-zA-Z]/g, '')
		.toLowerCase();
	return normalizedStr.charAt(0) || 'a';
}

/**
 * Downloads dataset zip archive from GeoNames if it does not already exist locally.
 */
async function ensureZipFileDownloaded() {
	if (existsSync(TXT_FILE_PATH)) {
		console.log(`Text file already extracted at ${TXT_FILE_PATH}`);
		return;
	}

	if (existsSync(ZIP_FILE_PATH)) {
		console.log(`Zip file already fetched at ${ZIP_FILE_PATH}`);
		return;
	}

	console.log(`Fetching ${ZIP_URL}...`);
	const response = await fetch(ZIP_URL);
	if (!response.ok || !response.body) {
		throw new Error(`Failed to download GeoNames archive: ${response.statusText}`);
	}

	const fileStream = createWriteStream(ZIP_FILE_PATH);
	await pipeline(Readable.fromWeb(response.body), fileStream);
	console.log(`Download completed: ${ZIP_FILE_PATH}`);
}

/**
 * Downloads admin1CodesASCII.txt from GeoNames if it does not exist locally.
 */
async function ensureAdmin1FileDownloaded() {
	if (existsSync(ADMIN1_FILE_PATH)) {
		console.log(`Admin1 mapping file already fetched at ${ADMIN1_FILE_PATH}`);
		return;
	}

	console.log(`Fetching ${ADMIN1_URL}...`);
	const response = await fetch(ADMIN1_URL);
	if (!response.ok || !response.body) {
		throw new Error(`Failed to download admin1CodesASCII.txt: ${response.statusText}`);
	}

	const fileStream = createWriteStream(ADMIN1_FILE_PATH);
	await pipeline(Readable.fromWeb(response.body), fileStream);
	console.log(`Download completed: ${ADMIN1_FILE_PATH}`);
}

/**
 * Ensures text file is extracted from zip archive.
 */
async function ensureTextFileExtracted() {
	if (existsSync(TXT_FILE_PATH)) {
		return;
	}

	console.log(`Extracting ${txtFilename} from ${zipFilename}...`);
	const unzipper = await import('unzipper').catch(() => null);
	if (unzipper) {
		const readStream = fs.createReadStream(ZIP_FILE_PATH);
		await readStream
			.pipe(unzipper.Parse())
			.on('entry', (entry) => {
				if (entry.path === txtFilename || entry.path.endsWith('.txt')) {
					entry.pipe(fs.createWriteStream(TXT_FILE_PATH));
				} else {
					entry.autodrain();
				}
			})
			.promise();
		console.log(`Extracted ${txtFilename} to ${TXT_FILE_PATH}`);
		return;
	}

	const { execSync } = await import('node:child_process');
	execSync(`unzip -o "${ZIP_FILE_PATH}" "*.txt" -d "${__dirname}"`);
	console.log(`Extracted text dataset using shell unzip command.`);
}

/**
 * Loads admin1 code to state name mapping.
 */
async function loadAdmin1Map() {
	await ensureAdmin1FileDownloaded();
	const adminMap = new Map();

	const inputStream = fs.createReadStream(ADMIN1_FILE_PATH, { encoding: 'utf8' });
	const rl = readline.createInterface({
		input: inputStream,
		crlfDelay: Infinity
	});

	for await (const line of rl) {
		if (!line.trim()) continue;
		const [code, name, asciiName] = line.split('\t');
		if (code && (name || asciiName)) {
			adminMap.set(code, name || asciiName);
		}
	}

	return adminMap;
}

/**
 * Processes the raw GeoNames text file into a single compact geonames.txt file.
 */
async function processGeoNames() {
	await ensureZipFileDownloaded();
	await ensureTextFileExtracted();
	const admin1Map = await loadAdmin1Map();

	const inputStream = fs.createReadStream(TXT_FILE_PATH, { encoding: 'utf8' });
	const rl = readline.createInterface({
		input: inputStream,
		crlfDelay: Infinity
	});

	const rawRecords = [];
	const countriesSet = new Set();
	const statesSet = new Set();

	let totalProcessed = 0;
	let totalKept = 0;

	for await (const line of rl) {
		if (!line.trim()) continue;
		totalProcessed++;

		const fields = line.split('\t');
		const name = fields[1];
		const lat = Number(fields[4]);
		const lon = Number(fields[5]);
		const featureClass = fields[6] || '';
		const featureCode = fields[7] || '';
		const country = fields[8] || '';
		const admin1Code = fields[10] || '';
		const population = Number(fields[14]) || 0;

		if (population < POPULATION_THRESHOLD) {
			continue;
		}

		// Filter out statistical regions, census metropolitan areas, and micro/metro areas
		if (
			featureClass === 'L' ||
			featureCode === 'RGNE' ||
			featureCode === 'RGN' ||
			/metro area|micro area|statistical area/i.test(name)
		) {
			continue;
		}

		const key = `${country}.${admin1Code}`;
		let stateName = admin1Map.get(key) || '';
		if (/^\d+$/.test(stateName) || /^[0-9A-Z]{1,3}$/.test(stateName)) {
			stateName = '';
		}

		const popInHundreds = Math.round(population / 100);
		const hash = geohash.encode(lat, lon, GEOHASH_PRECISION);
		const initialLetter = getNormalizedFirstLetter(name);

		rawRecords.push({ name, initialLetter, popInHundreds, country, state: stateName, hash, rawPopulation: population });
		totalKept++;
	}

	// Deduplicate records with identical name + country + state, keeping highest population entry
	const dedupMap = new Map();
	for (const rec of rawRecords) {
		const key = `${rec.name.toLowerCase()}|${rec.country.toLowerCase()}|${rec.state.toLowerCase()}`;
		const existing = dedupMap.get(key);
		if (!existing || rec.rawPopulation > existing.rawPopulation) {
			dedupMap.set(key, rec);
		}
	}

	const uniqueRecords = Array.from(dedupMap.values());
	for (const rec of uniqueRecords) {
		if (rec.country) countriesSet.add(rec.country);
		if (rec.state) statesSet.add(rec.state);
	}

	const rawRecordsToUse = uniqueRecords;

	const countries = Array.from(countriesSet).sort();
	const states = Array.from(statesSet).sort();

	const countryIndexMap = new Map(countries.map((c, idx) => [c, idx]));
	const stateIndexMap = new Map(states.map((s, idx) => [s, idx]));

	// Sort records by first letter, then by 1-char geohash, then by normalized name
	rawRecordsToUse.sort((recordA, recordB) => {
		if (recordA.initialLetter !== recordB.initialLetter) {
			return recordA.initialLetter.localeCompare(recordB.initialLetter);
		}
		const gA = recordA.hash.slice(0, 1);
		const gB = recordB.hash.slice(0, 1);
		if (gA !== gB) {
			return gA.localeCompare(gB);
		}
		const nameA = recordA.name
			.normalize('NFD')
			.replace(/[\u0300-\u036f]/g, '')
			.toLowerCase();
		const nameB = recordB.name
			.normalize('NFD')
			.replace(/[\u0300-\u036f]/g, '')
			.toLowerCase();
		return nameA.localeCompare(nameB);
	});

	await mkdir(PUBLIC_DIRECTORY, { recursive: true });

	const license = {
		text: 'This work is licensed under a Creative Commons Attribution 4.0 License, see https://creativecommons.org/licenses/by/4.0/. The Data is provided "as is" without warranty or any representation of accuracy, timeliness or completeness.',
		url: 'https://creativecommons.org/licenses/by/4.0/',
		attribution: 'GeoNames (https://www.geonames.org)'
	};

	const dataLines = rawRecordsToUse.map((record) => {
		const popBase36 = record.popInHundreds.toString(36);
		const countryIdx = record.country ? countryIndexMap.get(record.country) : '';
		const stateIdx = record.state ? stateIndexMap.get(record.state) : '';
		return `${record.name}\t${popBase36}\t${countryIdx}\t${stateIdx}\t${record.hash}`;
	});

	// Calculate relative line start/end offsets for data lines in JS string characters
	const letterRangesRel = {};
	const geoRangesRel = {};

	let currentRelOffset = 0;
	rawRecordsToUse.forEach((record, idx) => {
		const lineStr = dataLines[idx];
		const lineCharLen = lineStr.length + 1; // +1 for '\n'
		const l = record.initialLetter;
		const g1 = record.hash.slice(0, 1);

		if (!letterRangesRel[l]) {
			letterRangesRel[l] = [currentRelOffset, currentRelOffset + lineCharLen];
		} else {
			letterRangesRel[l][1] = currentRelOffset + lineCharLen;
		}

		if (g1) {
			if (!geoRangesRel[g1]) {
				geoRangesRel[g1] = [];
			}
			const ranges = geoRangesRel[g1];
			if (ranges.length > 0 && ranges[ranges.length - 1][1] === currentRelOffset) {
				ranges[ranges.length - 1][1] = currentRelOffset + lineCharLen;
			} else {
				ranges.push([currentRelOffset, currentRelOffset + lineCharLen]);
			}
		}

		currentRelOffset += lineCharLen;
	});

	// Iteratively balance header JSON char length so absolute offsets in letterRanges/geoRanges are 100% exact for JS string slicing
	let headerData = {
		license,
		countries,
		states,
		letterRanges: letterRangesRel,
		geoRanges: geoRangesRel
	};

	let headerJsonStr = JSON.stringify(headerData);
	let headerCharLen = headerJsonStr.length + 1;

	// Perform offset shifting to add header char length
	for (let pass = 0; pass < 3; pass++) {
		const letterRanges = {};
		for (const l in letterRangesRel) {
			letterRanges[l] = [
				letterRangesRel[l][0] + headerCharLen,
				letterRangesRel[l][1] + headerCharLen
			];
		}

		const geoRanges = {};
		for (const g in geoRangesRel) {
			geoRanges[g] = geoRangesRel[g].map(([start, end]) => [
				start + headerCharLen,
				end + headerCharLen
			]);
		}

		headerData = {
			license,
			countries,
			states,
			letterRanges,
			geoRanges
		};

		headerJsonStr = JSON.stringify(headerData);
		const newHeaderCharLen = headerJsonStr.length + 1;
		if (newHeaderCharLen === headerCharLen) {
			break;
		}
		headerCharLen = newHeaderCharLen;
	}

	const fullText = [headerJsonStr, ...dataLines].join('\n');
	fs.writeFileSync(OUTPUT_FILE_PATH, fullText, 'utf8');

	const stats = fs.statSync(OUTPUT_FILE_PATH);
	console.log(`Processing complete:`);
	console.log(`- Total records read: ${totalProcessed.toLocaleString()}`);
	console.log(
		`- Kept (Pop >= ${POPULATION_THRESHOLD.toLocaleString()}): ${totalKept.toLocaleString()}`
	);
	console.log(`- Output size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
	console.log(`- Header JSON size: ${(Buffer.byteLength(headerJsonStr, 'utf8') / 1024).toFixed(2)} KB`);
	console.log(`- Output written to: ${OUTPUT_FILE_PATH}`);
}

processGeoNames().catch((err) => {
	console.error('Error processing GeoNames data:', err);
});
