import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import {
	decodeGeohash,
	geolocateNearest,
	haversineDistance,
	loadGeoNamesDataset,
	parseMapUrl,
	searchGeoNames
} from '../src/index.js';

// Resolve local geonames.txt file URL for testing dataset operations
const dataFileUrl = pathToFileURL(path.resolve('public/geonames.txt')).href;

describe('browser-geocoder-geonames', () => {
	describe('haversineDistance', () => {
		it('should calculate distance between Sydney and Melbourne (~713 km)', () => {
			const sydney = { lat: -33.8688, lon: 151.2093 };
			const melbourne = { lat: -37.8136, lon: 144.9631 };
			const dist = haversineDistance(sydney.lat, sydney.lon, melbourne.lat, melbourne.lon);
			expect(dist).toBeGreaterThan(700);
			expect(dist).toBeLessThan(730);
		});

		it('should return 0 distance for identical coordinates', () => {
			const dist = haversineDistance(-33.8688, 151.2093, -33.8688, 151.2093);
			expect(dist).toBe(0);
		});
	});

	describe('decodeGeohash', () => {
		it('should accurately decode a known geohash string', () => {
			// Sydney geohash r3gx2
			const [lat, lon] = decodeGeohash('r3gx2');
			expect(lat).toBeCloseTo(-33.86, 1);
			expect(lon).toBeCloseTo(151.2, 1);
		});
	});

	describe('loadGeoNamesDataset', () => {
		it('should load dataset line 1 header index and raw text', async () => {
			const dataset = await loadGeoNamesDataset(dataFileUrl);
			expect(dataset).toBeDefined();
			expect(dataset.rawText).toBeDefined();
			expect(dataset.countries).toBeInstanceOf(Array);
			expect(dataset.states).toBeInstanceOf(Array);
			expect(dataset.letterRanges).toBeDefined();
			expect(dataset.geoRanges).toBeDefined();
		});

		it('should memoize promise and return cached result on subsequent calls', async () => {
			const cacheTestUrl = 'https://example.com/cache-test.bin';
			const mockFetch = vi.fn().mockResolvedValue({
				ok: true,
				text: async () => JSON.stringify({ countries: ['AU'], states: [], letterRanges: {}, geoRanges: {} }) + '\n'
			});
			vi.stubGlobal('fetch', mockFetch);

			try {
				const dataset1 = await loadGeoNamesDataset(cacheTestUrl);
				const dataset2 = await loadGeoNamesDataset(cacheTestUrl);
				expect(dataset1).toEqual(dataset2);
				expect(mockFetch).toHaveBeenCalledTimes(1);
			} finally {
				vi.unstubAllGlobals();
			}
		});

		it('should throw error when dataUrl is empty', async () => {
			await expect(loadGeoNamesDataset('')).rejects.toThrow('[browser-geocoder-geonames] dataUrl parameter must be specified.');
		});

		it('should fetch dataset over HTTP and parse header index when fetch is used', async () => {
			const fakeHeader = { countries: ['AU'], states: ['NSW'], letterRanges: {}, geoRanges: {} };
			const fakeBody = JSON.stringify(fakeHeader) + '\nAU\tSydney\t-33.86\t151.20\n';

			const mockFetch = vi.fn().mockResolvedValue({
				ok: true,
				text: async () => fakeBody
			});

			vi.stubGlobal('fetch', mockFetch);

			try {
				const httpUrl = 'https://example.com/geonames.txt';
				const dataset = await loadGeoNamesDataset(httpUrl);
				expect(mockFetch).toHaveBeenCalledWith(httpUrl);
				expect(dataset.countries).toEqual(['AU']);
				expect(dataset.rawText).toBe(fakeBody);
			} finally {
				vi.unstubAllGlobals();
			}
		});

		it('should throw error when HTTP response is not ok', async () => {
			const mockFetch = vi.fn().mockResolvedValue({
				ok: false,
				statusText: 'Not Found'
			});

			vi.stubGlobal('fetch', mockFetch);

			try {
				const httpUrl = 'https://example.com/missing.bin';
				await expect(loadGeoNamesDataset(httpUrl)).rejects.toThrow('Failed to fetch dataset from https://example.com/missing.bin: Not Found');
			} finally {
				vi.unstubAllGlobals();
			}
		});
	});

	describe('searchGeoNames', () => {
		it('should search for Sydney and return New South Wales location', async () => {
			const results = await searchGeoNames('Sydney', dataFileUrl);
			expect(results.length).toBeGreaterThan(0);
			const sydney = results.find((r) => r.name === 'Sydney' && r.country === 'AU');
			expect(sydney).toBeDefined();
			expect(sydney?.state).toBe('New South Wales');
			expect(sydney?.latitude).toBeCloseTo(-33.86, 1);
		});

		it('should return empty array for empty keyword', async () => {
			const results = await searchGeoNames('   ', dataFileUrl);
			expect(results).toEqual([]);
		});

		it('should invoke progress callback during search', async () => {
			let progressReported = false;
			await searchGeoNames('London', dataFileUrl, (partial) => {
				if (partial.length > 0) progressReported = true;
			});
			expect(progressReported).toBe(true);
		});

		it('should cancel search early when signal is aborted', async () => {
			const controller = new AbortController();
			controller.abort();
			const results = await searchGeoNames('Sydney', dataFileUrl, undefined, controller.signal);
			expect(results).toEqual([]);
		});
	});

	describe('geolocateNearest', () => {
		it('should find nearest city for Sydney Harbour coordinates', async () => {
			const sydneyHarbour = { lat: -33.8568, lng: 151.2153 };
			const result = await geolocateNearest(sydneyHarbour.lat, sydneyHarbour.lng, dataFileUrl, 50);
			expect(result).not.toBeNull();
			expect(['Sydney', 'Dawes Point']).toContain(result?.name);
			expect(result?.country).toBe('AU');
			expect(result?.distanceKm).toBeLessThan(10);
		});

		it('should return null if no location exists within maxDistanceKm', async () => {
			// Middle of South Pacific Ocean
			const remoteOcean = { lat: -45.0, lng: -140.0 };
			const result = await geolocateNearest(remoteOcean.lat, remoteOcean.lng, dataFileUrl, 5);
			expect(result).toBeNull();
		});
	});

	describe('parseMapUrl', () => {
		it('should parse Google Maps URLs', () => {
			const res = parseMapUrl('https://www.google.com/maps/@-33.86785,151.20732,14z');
			expect(res?.latitude).toBe(-33.86785);
			expect(res?.longitude).toBe(151.20732);
			expect(res?.zoom).toBe(14);
		});

		it('should parse OpenStreetMap URLs', () => {
			const res = parseMapUrl('https://www.openstreetmap.org/#map=13/-33.8678/151.2073');
			expect(res?.latitude).toBe(-33.8678);
			expect(res?.longitude).toBe(151.2073);
			expect(res?.zoom).toBe(13);
		});

		it('should parse Apple Maps URLs', () => {
			const res = parseMapUrl('https://maps.apple.com/?center=-33.86785,151.20732&q=Sydney');
			expect(res?.latitude).toBe(-33.86785);
			expect(res?.longitude).toBe(151.20732);
			expect(res?.label).toBe('Sydney');
		});

		it('should parse Bing Maps URLs', () => {
			const res = parseMapUrl('https://www.bing.com/maps/?cp=-27.570783%7E152.982103&lvl=12.9&style=r');
			expect(res?.latitude).toBe(-27.570783);
			expect(res?.longitude).toBe(152.982103);
			expect(res?.zoom).toBe(12.9);
		});

		it('should parse TomTom URLs', () => {
			const res = parseMapUrl('https://plan.tomtom.com/en?p=-27.44885,150.8864,8.16z');
			expect(res?.latitude).toBe(-27.44885);
			expect(res?.longitude).toBe(150.8864);
			expect(res?.zoom).toBe(8.16);
		});
	});
});
