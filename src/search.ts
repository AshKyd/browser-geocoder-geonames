import { DEFAULT_DATA_URL } from './constants.js';
import { loadGeoNamesDataset } from './loadDataset.js';
import type { GeoNameResult } from './types.js';
import {
	decodeGeohash,
	getNormalizedFirstLetter,
	parseBase36Population,
	yieldToMain
} from './utils.js';

const parsedLetterCache = new Map<string, GeoNameResult[]>();
const searchQueryCache = new Map<string, GeoNameResult[]>();

/**
 * Checks whether a row matches a list of search tokens across name, country, and state fields.
 */
function isRowMatchingTokens(
	tokens: string[],
	name: string,
	country: string,
	state: string
): boolean {
	const nameLower = name
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.toLowerCase();
	const countryLower = country.toLowerCase();
	const stateLower = state
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.toLowerCase();

	return tokens.every((token) => {
		if (nameLower.includes(token)) return true;
		if (countryLower === token) return true;
		if (stateLower.includes(token)) return true;
		return false;
	});
}

/**
 * Searches the compact GeoNames dataset for a multi-word search query using cached letter buckets.
 */
export async function searchGeoNames(
	keyword: string,
	dataUrl: string = DEFAULT_DATA_URL,
	onProgress?: (results: GeoNameResult[]) => void,
	signal?: AbortSignal
): Promise<GeoNameResult[]> {
	if (signal?.aborted) return [];

	if (!dataUrl || !dataUrl.trim()) {
		throw new Error('[browser-geocoder-geonames] dataUrl parameter must be specified.');
	}

	const tokens = keyword.trim().toLowerCase().split(/\s+/).filter(Boolean);
	if (tokens.length === 0) return [];

	const cacheKey = `${dataUrl}::${tokens.join(' ')}`;
	if (searchQueryCache.has(cacheKey)) {
		const cached = searchQueryCache.get(cacheKey)!;
		onProgress?.([...cached]);
		return cached;
	}

	const dataset = await loadGeoNamesDataset(dataUrl);
	const initialLetter = getNormalizedFirstLetter(tokens[0]);
	const letterCacheKey = `${dataUrl}::letter::${initialLetter}`;

	let letterRecords: GeoNameResult[];

	if (parsedLetterCache.has(letterCacheKey)) {
		letterRecords = parsedLetterCache.get(letterCacheKey)!;
	} else {
		letterRecords = [];
		const range = dataset.letterRanges ? dataset.letterRanges[initialLetter] : undefined;
		if (range) {
			const [startPos, endPos] = range;
			let pos = startPos;
			while (pos < endPos) {
				let nextNL = dataset.rawText.indexOf('\n', pos);
				if (nextNL === -1 || nextNL > endPos) nextNL = endPos;

				const line = dataset.rawText.substring(pos, nextNL);
				const linePos = pos;
				pos = nextNL + 1;
				if (!line.trim()) continue;

				const fields = line.split('\t');
				const name = fields[0];
				if (!name) continue;

				const popB36 = fields[1] || '';
				const countryIdxStr = fields[2];
				const stateIdxStr = fields[3];
				const hash = fields[4] || '';
				if (!hash) continue;

				const country = countryIdxStr !== '' ? dataset.countries[Number(countryIdxStr)] || '' : '';
				const state = stateIdxStr !== '' ? dataset.states[Number(stateIdxStr)] || '' : '';
				const [latitude, longitude] = decodeGeohash(hash);

				letterRecords.push({
					id: `${name}-${hash}-${linePos}`,
					name,
					country,
					state,
					population: parseBase36Population(popB36),
					latitude,
					longitude
				});
			}
		}
		parsedLetterCache.set(letterCacheKey, letterRecords);
	}

	const found: GeoNameResult[] = [];
	const MAX_MATCHES = 50;
	const MAX_CHUNK_MS = 8;
	let lastYieldTime = typeof performance !== 'undefined' ? performance.now() : Date.now();

	for (const item of letterRecords) {
		if (signal?.aborted) return found;
		if (found.length >= MAX_MATCHES) break;

		const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
		if (now - lastYieldTime > MAX_CHUNK_MS) {
			await yieldToMain();
			lastYieldTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
			if (found.length > 0) {
				onProgress?.([...found]);
			}
		}

		if (isRowMatchingTokens(tokens, item.name, item.country, item.state)) {
			const nameLower = item.name
				.normalize('NFD')
				.replace(/[\u0300-\u036f]/g, '')
				.toLowerCase();
			const isNameMatch = tokens.every((token) => nameLower.includes(token));
			found.push({
				...item,
				isNameMatch
			});
		}
	}

	searchQueryCache.set(cacheKey, found);

	if (found.length > 0) {
		onProgress?.([...found]);
	}

	return found;
}
