import { DEFAULT_DATA_URL } from './constants.js';
import type { GeoNamesParsedStore } from './types.js';

const datasetCache = new Map<string, Promise<GeoNamesParsedStore>>();

/**
 * Downloads the dataset, parses line 1 JSON index header (letterRanges + geoRanges),
 * and memoizes dataset promise in memory.
 */
export async function loadGeoNamesDataset(
	dataUrl: string = DEFAULT_DATA_URL
): Promise<GeoNamesParsedStore> {
	if (!dataUrl || !dataUrl.trim()) {
		throw new Error('[browser-geocoder-geonames] dataUrl parameter must be specified.');
	}

	const cached = datasetCache.get(dataUrl);
	if (cached) return cached;

	const promise = (async () => {
		let text = '';
		const isNode = typeof process !== 'undefined' && Boolean(process.versions?.node);
		const isRemote = dataUrl.startsWith('http://') || dataUrl.startsWith('https://');

		if (dataUrl.startsWith('file://') || (isNode && !isRemote)) {
			try {
				const { readFile } = await import('node:fs/promises');
				const { fileURLToPath } = await import('node:url');
				const filePath = dataUrl.startsWith('file://') ? fileURLToPath(dataUrl) : dataUrl;
				text = await readFile(filePath, 'utf-8');
			} catch {
				// Fallback to fetch if file reading fails
			}
		}

		if (!text) {
			const res = await fetch(dataUrl);
			if (!res.ok) {
				throw new Error(`Failed to fetch dataset from ${dataUrl}: ${res.statusText}`);
			}
			text = await res.text();
		}

		const headerEnd = text.indexOf('\n');
		const headerLine = headerEnd !== -1 ? text.slice(0, headerEnd) : text;
		const headerData: GeoNamesParsedStore = JSON.parse(headerLine);

		return {
			...headerData,
			rawText: text
		};
	})();

	datasetCache.set(dataUrl, promise);
	return promise;
}
