import { DEFAULT_DATA_URL } from './constants.js';
import { loadGeoNamesDataset } from './loadDataset.js';
import type { GeoNameResult, SearchGeoNamesOptions } from './types.js';
import {
	decodeGeohash,
	getNormalizedFirstLetter,
	normalizeText,
	parseBase36Population,
	yieldToMain
} from './utils.js';

interface PreparedLetterRecord extends GeoNameResult {
	normalizedName: string;
	normalizedCountry: string;
	normalizedState: string;
}

// Single active letter bucket cache to maintain typeahead speed while conserving memory
const parsedLetterCache = new Map<string, PreparedLetterRecord[]>();

/**
 * Checks whether a row matches a list of pre-normalized search tokens across name, country, and state fields.
 */
function isRowMatchingTokens(
	tokens: string[],
	normName: string,
	normCountry: string,
	normState: string
): boolean {
	return tokens.every((token) => {
		if (normName.includes(token)) return true;
		if (normCountry === token) return true;
		if (normState.includes(token)) return true;
		return false;
	});
}

/**
 * Searches the compact GeoNames dataset for a multi-word search query using cached letter buckets.
 */
export async function searchGeoNames(
	options: SearchGeoNamesOptions | string,
	dataUrlParam: string = DEFAULT_DATA_URL,
	onProgressParam?: (results: GeoNameResult[]) => void,
	signalParam?: AbortSignal
): Promise<GeoNameResult[]> {
	const opts: SearchGeoNamesOptions =
		typeof options === 'string'
			? {
					keyword: options,
					dataUrl: dataUrlParam,
					onProgress: onProgressParam,
					signal: signalParam
				}
			: options;

	const {
		keyword = '',
		dataUrl = DEFAULT_DATA_URL,
		onProgress,
		signal
	} = opts || {};

	if (signal?.aborted) return [];

	if (!dataUrl || !dataUrl.trim()) {
		throw new Error('[browser-geocoder-geonames] dataUrl parameter must be specified.');
	}

	const tokens = keyword.trim().toLowerCase().split(/\s+/).filter(Boolean);
	if (tokens.length === 0) return [];

	const dataset = await loadGeoNamesDataset(dataUrl);
	const initialLetter = getNormalizedFirstLetter(tokens[0]);
	const letterCacheKey = `${dataUrl}::letter::${initialLetter}`;

	let letterRecords: PreparedLetterRecord[];

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
					longitude,
					normalizedName: normalizeText(name),
					normalizedCountry: country.toLowerCase(),
					normalizedState: normalizeText(state)
				});
			}
		}

		// Keep only the single most recent letter bucket active in memory
		if (parsedLetterCache.size >= 1) {
			parsedLetterCache.clear();
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

		if (isRowMatchingTokens(tokens, item.normalizedName, item.normalizedCountry, item.normalizedState)) {
			const isNameMatch = tokens.every((token) => item.normalizedName.includes(token));
			const { normalizedName: _n, normalizedCountry: _c, normalizedState: _s, ...result } = item;
			found.push({
				...result,
				isNameMatch
			});
		}
	}

	if (found.length > 0) {
		onProgress?.([...found]);
	}

	return found;
}
