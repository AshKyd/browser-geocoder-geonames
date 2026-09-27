import { DEFAULT_DATA_URL } from './constants.js';
import type { GeoNamesParsedStore, LoadDatasetOptions, PrefetchDatasetOptions } from './types.js';

const datasetCache = new Map<string, Promise<GeoNamesParsedStore>>();

/**
 * Downloads the dataset, parses line 1 JSON index header (letterRanges + geoRanges),
 * and memoizes dataset promise in memory.
 */
export async function loadGeoNamesDataset(
	options: LoadDatasetOptions | string = DEFAULT_DATA_URL
): Promise<GeoNamesParsedStore> {
	const dataUrl = typeof options === 'string' ? options : (options?.dataUrl ?? DEFAULT_DATA_URL);
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
	})().catch((err) => {
		datasetCache.delete(dataUrl);
		throw err;
	});

	datasetCache.set(dataUrl, promise);
	return promise;
}

/**
 * Inserts a `<link rel="prefetch">` element into document.head to warm the browser HTTP cache for the dataset file.
 */
export function prefetchGeoNamesDataset(
	options: PrefetchDatasetOptions | string = DEFAULT_DATA_URL
): void {
	const dataUrl = typeof options === 'string' ? options : (options?.dataUrl ?? DEFAULT_DATA_URL);
	if (typeof document === 'undefined' || !dataUrl || !dataUrl.trim()) return;

	const links = Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="prefetch"]'));
	const alreadyPrefetched = links.some((link) => link.href === dataUrl || link.getAttribute('href') === dataUrl);
	if (alreadyPrefetched) return;

	const link = document.createElement('link');
	link.rel = 'prefetch';
	link.href = dataUrl;
	link.as = 'fetch';
	if (dataUrl.startsWith('http://') || dataUrl.startsWith('https://')) {
		link.crossOrigin = 'anonymous';
	}
	document.head.appendChild(link);
}

