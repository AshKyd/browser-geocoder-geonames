import { describe, expect, it, vi } from 'vitest';
import {
	decodeGeohash,
	getNormalizedFirstLetter,
	haversineDistance,
	parseBase36Population,
	yieldToMain
} from '../src/utils.js';

describe('utils', () => {
	describe('getNormalizedFirstLetter', () => {
		it('should return normalized lowercase letter for standard Latin names', () => {
			expect(getNormalizedFirstLetter('Sydney')).toBe('s');
			expect(getNormalizedFirstLetter('Melbourne')).toBe('m');
			expect(getNormalizedFirstLetter('New York')).toBe('n');
		});

		it('should strip diacritics and accents before returning first letter', () => {
			expect(getNormalizedFirstLetter('München')).toBe('m');
			expect(getNormalizedFirstLetter('São Paulo')).toBe('s');
			expect(getNormalizedFirstLetter('Ålesund')).toBe('a');
			expect(getNormalizedFirstLetter('Évry')).toBe('e');
		});

		it('should ignore leading non-alphabetic characters', () => {
			expect(getNormalizedFirstLetter('  Paris')).toBe('p');
			expect(getNormalizedFirstLetter('123 Sydney')).toBe('s');
			expect(getNormalizedFirstLetter('- Melbourne')).toBe('m');
		});

		it('should return fallback "a" for empty, non-string, or non-alphabetic inputs', () => {
			expect(getNormalizedFirstLetter('')).toBe('a');
			expect(getNormalizedFirstLetter('12345')).toBe('a');
			expect(getNormalizedFirstLetter('!@#$%')).toBe('a');
			// @ts-expect-error testing invalid input types
			expect(getNormalizedFirstLetter(null)).toBe('a');
			// @ts-expect-error testing invalid input types
			expect(getNormalizedFirstLetter(undefined)).toBe('a');
		});
	});

	describe('yieldToMain', () => {
		it('should resolve via setTimeout fallback when scheduler API is unavailable', async () => {
			const originalScheduler = (globalThis as unknown as { scheduler?: unknown }).scheduler;
			// Ensure scheduler is undefined
			delete (globalThis as unknown as { scheduler?: unknown }).scheduler;

			try {
				let resolved = false;
				const promise = yieldToMain().then(() => {
					resolved = true;
				});
				expect(resolved).toBe(false);
				await promise;
				expect(resolved).toBe(true);
			} finally {
				if (originalScheduler) {
					(globalThis as unknown as { scheduler: unknown }).scheduler = originalScheduler;
				}
			}
		});

		it('should invoke scheduler.yield when scheduler API is available', async () => {
			const originalScheduler = (globalThis as unknown as { scheduler?: unknown }).scheduler;
			const mockYield = vi.fn().mockResolvedValue(undefined);
			(globalThis as unknown as { scheduler: { yield: typeof mockYield } }).scheduler = {
				yield: mockYield
			};

			try {
				await yieldToMain();
				expect(mockYield).toHaveBeenCalledTimes(1);
			} finally {
				delete (globalThis as unknown as { scheduler?: unknown }).scheduler;
				if (originalScheduler) {
					(globalThis as unknown as { scheduler: unknown }).scheduler = originalScheduler;
				}
			}
		});
	});

	describe('parseBase36Population', () => {
		it('should parse valid base-36 population strings into hundreds', () => {
			expect(parseBase36Population('10')).toBe(3600); // 36 * 100
			expect(parseBase36Population('z')).toBe(3500); // 35 * 100
			expect(parseBase36Population('0')).toBe(0);
			expect(parseBase36Population('100')).toBe(129600); // 1296 * 100
		});

		it('should return 0 for invalid or empty base-36 strings', () => {
			expect(parseBase36Population('')).toBe(0);
			expect(parseBase36Population('!@#$%')).toBe(0);
		});
	});

	describe('haversineDistance', () => {
		it('should return 0 distance for identical coordinates', () => {
			expect(haversineDistance(-33.8688, 151.2093, -33.8688, 151.2093)).toBe(0);
		});

		it('should calculate distance between Sydney and Melbourne (~713 km)', () => {
			const dist = haversineDistance(-33.8688, 151.2093, -37.8136, 144.9631);
			expect(dist).toBeGreaterThan(700);
			expect(dist).toBeLessThan(730);
		});

		it('should calculate distance across equator and prime meridian', () => {
			const dist = haversineDistance(51.5074, -0.1278, 48.8566, 2.3522); // London to Paris
			expect(dist).toBeGreaterThan(330);
			expect(dist).toBeLessThan(360);
		});

		it('should handle antipodal points correctly (~20,015 km)', () => {
			const dist = haversineDistance(0, 0, 0, 180);
			expect(dist).toBeCloseTo(20015, -2);
		});
	});

	describe('decodeGeohash', () => {
		it('should decode a valid geohash string into latitude and longitude tuple', () => {
			const [lat, lon] = decodeGeohash('r3gx2');
			expect(lat).toBeCloseTo(-33.86, 1);
			expect(lon).toBeCloseTo(151.2, 1);
		});

		it('should decode high precision geohashes accurately', () => {
			const [lat, lon] = decodeGeohash('gcpuv77');
			expect(lat).toBeCloseTo(51.5, 1);
			expect(lon).toBeCloseTo(-0.12, 1);
		});
	});
});
