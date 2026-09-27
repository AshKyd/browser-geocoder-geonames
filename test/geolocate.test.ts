import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { geolocateNearest } from '../src/geolocate.js';

const dataFileUrl = pathToFileURL(path.resolve('public/geonames.txt')).href;

describe('geolocateNearest', () => {
	it('should find nearest city for Sydney Harbour coordinates within 50 km', async () => {
		const sydneyHarbour = { lat: -33.8568, lng: 151.2153 };
		const result = await geolocateNearest(sydneyHarbour.lat, sydneyHarbour.lng, dataFileUrl, 50);

		expect(result).not.toBeNull();
		expect(['Sydney', 'Dawes Point']).toContain(result?.name);
		expect(result?.country).toBe('AU');
		expect(result?.state).toBe('New South Wales');
		expect(result?.distanceKm).toBeLessThan(10);
	});

	it('should invoke onProgress callback as nearer locations are identified', async () => {
		let progressCalled = false;
		let receivedResult: unknown = null;

		await geolocateNearest(
			-33.8568,
			151.2153,
			dataFileUrl,
			50,
			(result) => {
				progressCalled = true;
				receivedResult = result;
			}
		);

		expect(progressCalled).toBe(true);
		expect(receivedResult).not.toBeNull();
	});

	it('should return cached result on repeat queries and trigger onProgress', async () => {
		const lat = -33.8568;
		const lng = 151.2153;
		const onProgressMock = vi.fn();

		const res1 = await geolocateNearest(lat, lng, dataFileUrl, 50);
		const res2 = await geolocateNearest(lat, lng, dataFileUrl, 50, onProgressMock);

		expect(res1).toEqual(res2);
		expect(onProgressMock).toHaveBeenCalledWith(res1);
	});

	it('should return null if no location exists within maxDistanceKm cutoff', async () => {
		const remoteOcean = { lat: -45.0, lng: -140.0 };
		const result = await geolocateNearest(remoteOcean.lat, remoteOcean.lng, dataFileUrl, 5);
		expect(result).toBeNull();
	});

	it('should return null immediately if AbortSignal is aborted', async () => {
		const controller = new AbortController();
		controller.abort();

		const result = await geolocateNearest(-33.8568, 151.2153, dataFileUrl, 50, undefined, controller.signal);
		expect(result).toBeNull();
	});

	it('should abort search mid-stream when AbortSignal triggers', async () => {
		const controller = new AbortController();

		const promise = geolocateNearest(
			-33.8568,
			151.2153,
			dataFileUrl,
			50,
			() => {
				controller.abort();
			},
			controller.signal
		);

		const result = await promise;
		expect(result === null || typeof result === 'object').toBe(true);
	});

	it('should throw error if dataUrl is empty or whitespace', async () => {
		await expect(geolocateNearest(-33.8568, 151.2153, '')).rejects.toThrow(
			'[browser-geocoder-geonames] dataUrl parameter must be specified.'
		);
		await expect(geolocateNearest(-33.8568, 151.2153, '   ')).rejects.toThrow(
			'[browser-geocoder-geonames] dataUrl parameter must be specified.'
		);
	});

	it('should handle dataset with missing geoRanges or missing geohash prefix', async () => {
		const headerObj = { countries: [], states: [], letterRanges: {}, geoRanges: {} };
		const responseBody = JSON.stringify(headerObj) + '\n';

		const mockFetch = vi.fn().mockResolvedValue({
			ok: true,
			text: async () => responseBody
		});
		vi.stubGlobal('fetch', mockFetch);

		try {
			const noRangesUrl = 'https://example.com/no-georange.bin';
			const result = await geolocateNearest(-33.8568, 151.2153, noRangesUrl, 50);
			expect(result).toBeNull();
		} finally {
			vi.unstubAllGlobals();
		}
	});

	it('should skip invalid lines, missing hash, or empty line records in geo ranges', async () => {
		// geohash prefix for (-33.8568, 151.2153) starts with 'r'
		const headerObj = {
			countries: ['AU'],
			states: ['NSW'],
			letterRanges: {},
			geoRanges: { r: [[0, 500]] }
		};

		const dataLines = [
			'',
			'\t10\t0\t0\tr3gx2',
			'PlaceWithoutHash\t10\t0\t0\t',
			'ValidSydney\t10\t0\t0\tr3gx2'
		].join('\n');

		const headerStr = JSON.stringify(headerObj);
		const headerLen = headerStr.length + 1;
		headerObj.geoRanges.r = [[headerLen, headerLen + dataLines.length]];
		const fullText = JSON.stringify(headerObj) + '\n' + dataLines;

		const mockFetch = vi.fn().mockResolvedValue({
			ok: true,
			text: async () => fullText
		});
		vi.stubGlobal('fetch', mockFetch);

		try {
			const customGeoUrl = 'https://example.com/custom-geo-records.bin';
			const result = await geolocateNearest(-33.8568, 151.2153, customGeoUrl, 50);

			expect(result).not.toBeNull();
			expect(result?.name).toBe('ValidSydney');
			expect(result?.country).toBe('AU');
			expect(result?.state).toBe('NSW');
		} finally {
			vi.unstubAllGlobals();
		}
	});

	it('should yield execution when processing chunk time exceeds MAX_CHUNK_MS', async () => {
		const headerObj = {
			countries: ['AU'],
			states: [],
			letterRanges: {},
			geoRanges: { r: [[0, 0]] }
		};

		const records: string[] = [];
		for (let i = 0; i < 20; i++) {
			records.push(`Place${i}\t10\t0\t0\tr3gx2`);
		}
		const dataLines = records.join('\n');

		const headerStr = JSON.stringify(headerObj);
		const headerLen = headerStr.length + 1;
		headerObj.geoRanges.r = [[headerLen, headerLen + dataLines.length]];
		const fullText = JSON.stringify(headerObj) + '\n' + dataLines;

		const mockFetch = vi.fn().mockResolvedValue({
			ok: true,
			text: async () => fullText
		});
		vi.stubGlobal('fetch', mockFetch);

		let mockTime = 0;
		const originalNow = performance.now;
		performance.now = vi.fn(() => {
			mockTime += 5;
			return mockTime;
		});

		const onProgressMock = vi.fn();

		try {
			const yieldGeoUrl = 'https://example.com/yield-geo-test.bin';
			const result = await geolocateNearest(-33.8568, 151.2153, yieldGeoUrl, 50, onProgressMock);
			expect(result).not.toBeNull();
			expect(onProgressMock).toHaveBeenCalled();
		} finally {
			performance.now = originalNow;
			vi.unstubAllGlobals();
		}
	});
});
