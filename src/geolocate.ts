import geohash from 'ngeohash';
import { DEFAULT_DATA_URL, DEFAULT_MAX_GEOLOCATE_DISTANCE_KM } from './constants.js';
import { loadGeoNamesDataset } from './loadDataset.js';
import type { GeolocateNearestOptions, NearestLocationResult } from './types.js';
import { decodeGeohash, haversineDistance, yieldToMain } from './utils.js';

const geolocateQueryCache = new Map<string, NearestLocationResult | null>();

/**
 * Finds the nearest location name to given lat/lon coordinates from the GeoNames dataset using cached geohash buckets.
 */
export async function geolocateNearest(
	options: GeolocateNearestOptions | number,
	longitudeParam?: number,
	dataUrlParam: string = DEFAULT_DATA_URL,
	maxDistanceKmParam: number = DEFAULT_MAX_GEOLOCATE_DISTANCE_KM,
	onProgressParam?: (result: NearestLocationResult | null) => void,
	signalParam?: AbortSignal
): Promise<NearestLocationResult | null> {
	const opts: GeolocateNearestOptions =
		typeof options === 'number'
			? {
					latitude: options,
					longitude: longitudeParam ?? 0,
					dataUrl: dataUrlParam,
					maxDistanceKm: maxDistanceKmParam,
					onProgress: onProgressParam,
					signal: signalParam
				}
			: options;

	const {
		latitude,
		longitude,
		dataUrl = DEFAULT_DATA_URL,
		maxDistanceKm = DEFAULT_MAX_GEOLOCATE_DISTANCE_KM,
		onProgress,
		signal
	} = opts || {};

	if (signal?.aborted) return null;

	if (!dataUrl || !dataUrl.trim()) {
		throw new Error('[browser-geocoder-geonames] dataUrl parameter must be specified.');
	}

	const geoCacheKey = `${dataUrl}::${latitude.toFixed(4)},${longitude.toFixed(4)}::${maxDistanceKm}`;
	if (geolocateQueryCache.has(geoCacheKey)) {
		const cached = geolocateQueryCache.get(geoCacheKey)!;
		if (cached) onProgress?.({ ...cached });
		return cached;
	}

	const dataset = await loadGeoNamesDataset(dataUrl);
	let nearest: NearestLocationResult | null = null;

	const centerPrefix = geohash.encode(latitude, longitude, 1);
	const neighborPrefixes = geohash.neighbors(centerPrefix);
	const targetGeoPrefixes = Array.from(new Set([centerPrefix, ...neighborPrefixes]));

	const targetRanges: [number, number][] = [];
	for (const prefix of targetGeoPrefixes) {
		if (dataset.geoRanges && dataset.geoRanges[prefix]) {
			targetRanges.push(...dataset.geoRanges[prefix]);
		}
	}

	const MAX_CHUNK_MS = 8;
	let lastYieldTime = typeof performance !== 'undefined' ? performance.now() : Date.now();

	for (const [startPos, endPos] of targetRanges) {
		if (signal?.aborted) return nearest && nearest.distanceKm <= maxDistanceKm ? nearest : null;
		let pos = startPos;
		while (pos < endPos) {
			const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
			if (now - lastYieldTime > MAX_CHUNK_MS) {
				await yieldToMain();
				lastYieldTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
				if (nearest && nearest.distanceKm <= maxDistanceKm) {
					onProgress?.({ ...nearest });
				}
			}

			let nextNL = dataset.rawText.indexOf('\n', pos);
			if (nextNL === -1 || nextNL > endPos) nextNL = endPos;

			const line = dataset.rawText.substring(pos, nextNL);
			pos = nextNL + 1;
			if (!line.trim()) continue;

			const fields = line.split('\t');
			const name = fields[0];
			const countryIdxStr = fields[2];
			const stateIdxStr = fields[3];
			const hash = fields[4] || '';
			if (!name || !hash) continue;

			const country = countryIdxStr !== '' ? dataset.countries[Number(countryIdxStr)] || '' : '';
			const state = stateIdxStr !== '' ? dataset.states[Number(stateIdxStr)] || '' : '';

			const [targetLat, targetLon] = decodeGeohash(hash);
			const dist = haversineDistance(latitude, longitude, targetLat, targetLon);

			if (!nearest || dist < nearest.distanceKm) {
				nearest = {
					name,
					country,
					state,
					distanceKm: dist,
					latitude: targetLat,
					longitude: targetLon
				};

				if (nearest.distanceKm <= maxDistanceKm) {
					onProgress?.({ ...nearest });
				}
			}
		}
	}

	const finalResult = nearest && nearest.distanceKm <= maxDistanceKm ? nearest : null;
	const MAX_CACHE_SIZE = 100;
	if (geolocateQueryCache.size >= MAX_CACHE_SIZE) {
		const oldestKey = geolocateQueryCache.keys().next().value;
		if (oldestKey !== undefined) {
			geolocateQueryCache.delete(oldestKey);
		}
	}
	geolocateQueryCache.set(geoCacheKey, finalResult);
	return finalResult;
}
