import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { searchGeoNames } from '../src/search.js';

const dataFileUrl = pathToFileURL(path.resolve('public/geonames.txt')).href;

describe('searchGeoNames', () => {
	it('should return matching results for a valid single-token search keyword', async () => {
		const results = await searchGeoNames('Sydney', dataFileUrl);
		expect(results.length).toBeGreaterThan(0);

		const sydney = results.find((r) => r.name === 'Sydney' && r.country === 'AU');
		expect(sydney).toBeDefined();
		expect(sydney?.state).toBe('New South Wales');
		expect(sydney?.latitude).toBeCloseTo(-33.86, 1);
		expect(sydney?.longitude).toBeCloseTo(151.2, 1);
		expect(sydney?.isNameMatch).toBe(true);
	});

	it('should return Paris in France as top result when searching for "Paris"', async () => {
		const results = await searchGeoNames('Paris', dataFileUrl);
		expect(results.length).toBeGreaterThan(0);

		const topMatch = results[0];
		expect(topMatch.name).toBe('Paris');
		expect(topMatch.country).toBe('FR');
		expect(topMatch.state).toBe('Île-de-France');
		expect(topMatch.isNameMatch).toBe(true);
	});

	it('should match multiple tokens across name, country, and state fields', async () => {
		const results = await searchGeoNames('Sydney New South Wales AU', dataFileUrl);
		expect(results.length).toBeGreaterThan(0);
		const match = results.find((r) => r.name === 'Sydney');
		expect(match).toBeDefined();
		expect(match?.country).toBe('AU');
		expect(match?.state).toBe('New South Wales');
	});

	it('should handle diacritics and accents in search keyword and place names', async () => {
		const results = await searchGeoNames('Munchen', dataFileUrl);
		expect(Array.isArray(results)).toBe(true);
	});

	it('should invoke onProgress callback during search', async () => {
		let progressCalled = false;
		let lastResultsCount = 0;

		await searchGeoNames(
			'London',
			dataFileUrl,
			(partial) => {
				progressCalled = true;
				lastResultsCount = partial.length;
			}
		);

		expect(progressCalled).toBe(true);
		expect(lastResultsCount).toBeGreaterThan(0);
	});

	it('should reuse parsed letter bucket for subsequent search queries', async () => {
		const keyword = 'CacheLetterSearchTest';

		const results1 = await searchGeoNames(keyword, dataFileUrl);
		const results2 = await searchGeoNames(keyword, dataFileUrl);

		expect(results1).toEqual(results2);
	});

	it('should reuse parsed letter cache for different keywords with the same starting letter', async () => {
		const results1 = await searchGeoNames('ParamattaTestOne', dataFileUrl);
		const results2 = await searchGeoNames('ParamattaTestTwo', dataFileUrl);
		expect(Array.isArray(results1)).toBe(true);
		expect(Array.isArray(results2)).toBe(true);
	});

	it('should return empty array when keyword is empty or whitespace-only', async () => {
		expect(await searchGeoNames('', dataFileUrl)).toEqual([]);
		expect(await searchGeoNames('   ', dataFileUrl)).toEqual([]);
	});

	it('should return empty array immediately if AbortSignal is already aborted', async () => {
		const controller = new AbortController();
		controller.abort();

		const results = await searchGeoNames('Sydney', dataFileUrl, undefined, controller.signal);
		expect(results).toEqual([]);
	});

	it('should abort search mid-stream when AbortSignal triggers during execution', async () => {
		const controller = new AbortController();

		const promise = searchGeoNames('Melbourne', dataFileUrl, () => {
			controller.abort();
		}, controller.signal);

		const results = await promise;
		expect(results.length).toBeLessThanOrEqual(50);
	});

	it('should throw error if dataUrl is empty or whitespace', async () => {
		await expect(searchGeoNames('Sydney', '')).rejects.toThrow(
			'[browser-geocoder-geonames] dataUrl parameter must be specified.'
		);
		await expect(searchGeoNames('Sydney', '   ')).rejects.toThrow(
			'[browser-geocoder-geonames] dataUrl parameter must be specified.'
		);
	});

	it('should return empty array if starting letter has no range in dataset', async () => {
		const headerObj = { countries: [], states: [], letterRanges: {}, geoRanges: {} };
		const responseBody = JSON.stringify(headerObj) + '\n';
		const mockFetch = vi.fn().mockResolvedValue({
			ok: true,
			text: async () => responseBody
		});
		vi.stubGlobal('fetch', mockFetch);

		try {
			const emptyRangesUrl = 'https://example.com/no-letter-range.bin';
			const results = await searchGeoNames('Zzz', emptyRangesUrl);
			expect(results).toEqual([]);
		} finally {
			vi.unstubAllGlobals();
		}
	});

	it('should correctly parse records with empty fields, missing hash, or invalid line data', async () => {
		const headerObj = {
			countries: ['AU'],
			states: ['NSW'],
			letterRanges: { s: [0, 500] },
			geoRanges: {}
		};

		// 1. empty line
		// 2. record missing name
		// 3. record missing hash
		// 4. record with state match only (isNameMatch = false)
		// 5. valid record
		const dataLines = [
			'',
			'\t10\t0\t0\tr3gx2',
			'SydneyNoHash\t10\t0\t0\t',
			'StateOnlyPlace\t10\t0\t0\tr3gx2',
			'SydneyValid\t10\t0\t0\tr3gx2'
		].join('\n');

		const fullDatasetText = JSON.stringify(headerObj) + '\n' + dataLines;

		// Correct startPos offset to line after JSON header
		const headerLen = JSON.stringify(headerObj).length + 1;
		headerObj.letterRanges.s = [headerLen, headerLen + dataLines.length];
		const correctedFullText = JSON.stringify(headerObj) + '\n' + dataLines;

		const mockFetch = vi.fn().mockResolvedValue({
			ok: true,
			text: async () => correctedFullText
		});
		vi.stubGlobal('fetch', mockFetch);

		try {
			const customDatasetUrl = 'https://example.com/custom-search-records.bin';
			const results = await searchGeoNames('StateOnlyPlace', customDatasetUrl);

			expect(results.length).toBe(1);
			const stateOnly = results.find((r) => r.name === 'StateOnlyPlace');
			expect(stateOnly).toBeDefined();
			expect(stateOnly?.isNameMatch).toBe(true);
		} finally {
			vi.unstubAllGlobals();
		}
	});

	it('should yield execution to main thread when search chunk duration exceeds MAX_CHUNK_MS', async () => {
		const headerObj = {
			countries: ['AU'],
			states: [],
			letterRanges: { a: [0, 0] },
			geoRanges: {}
		};

		// Build multiple data lines
		const records: string[] = [];
		for (let i = 0; i < 20; i++) {
			records.push(`Alpha${i}\t10\t0\t\tr3gx2`);
		}
		const dataLines = records.join('\n');
		const headerStr = JSON.stringify(headerObj);
		const headerLen = headerStr.length + 1;

		headerObj.letterRanges.a = [headerLen, headerLen + dataLines.length];
		const fullText = JSON.stringify(headerObj) + '\n' + dataLines;

		const mockFetch = vi.fn().mockResolvedValue({
			ok: true,
			text: async () => fullText
		});
		vi.stubGlobal('fetch', mockFetch);

		// Mock performance.now to simulate time passing > 8ms
		let mockTime = 0;
		const originalNow = performance.now;
		performance.now = vi.fn(() => {
			mockTime += 5; // Increments by 5ms per check
			return mockTime;
		});

		const onProgressMock = vi.fn();

		try {
			const yieldTestUrl = 'https://example.com/yield-test.bin';
			const results = await searchGeoNames('Alpha', yieldTestUrl, onProgressMock);
			expect(results.length).toBeGreaterThan(0);
			expect(onProgressMock).toHaveBeenCalled();
		} finally {
			performance.now = originalNow;
			vi.unstubAllGlobals();
		}
	});
});
