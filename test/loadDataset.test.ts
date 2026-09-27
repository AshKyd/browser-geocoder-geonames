import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { loadGeoNamesDataset, prefetchGeoNamesDataset } from '../src/loadDataset.js';

const localDataFileUrl = pathToFileURL(path.resolve('public/geonames.txt')).href;
const localDataFilePath = path.resolve('public/geonames.txt');

describe('loadDataset', () => {
	describe('prefetchGeoNamesDataset', () => {
		it('should do nothing in non-DOM environment', () => {
			expect(() => prefetchGeoNamesDataset('/geonames.txt')).not.toThrow();
		});

		it('should append link rel prefetch to document head in DOM environment', () => {
			const appendedElements: HTMLLinkElement[] = [];
			const mockHead = {
				appendChild: vi.fn((el: HTMLLinkElement) => {
					appendedElements.push(el);
					return el;
				})
			};

			const mockLinkElement = {
				rel: '',
				href: ''
			};

			const mockDocument = {
				head: mockHead,
				querySelectorAll: vi.fn().mockReturnValue([]),
				createElement: vi.fn((tag: string) => {
					if (tag === 'link') return mockLinkElement;
					return {};
				})
			};

			vi.stubGlobal('document', mockDocument);

			try {
				prefetchGeoNamesDataset('/test-prefetch.bin');
				expect(mockDocument.createElement).toHaveBeenCalledWith('link');
				expect(mockLinkElement.rel).toBe('prefetch');
				expect(mockLinkElement.href).toBe('/test-prefetch.bin');
				expect(mockHead.appendChild).toHaveBeenCalledTimes(1);
			} finally {
				vi.unstubAllGlobals();
			}
		});

		it('should not duplicate prefetch link if matching link already exists', () => {
			const mockExistingLink = {
				rel: 'prefetch',
				href: '/existing-prefetch.bin',
				getAttribute: (attr: string) => (attr === 'href' ? '/existing-prefetch.bin' : null)
			};

			const mockHead = {
				appendChild: vi.fn()
			};

			const mockDocument = {
				head: mockHead,
				querySelectorAll: vi.fn().mockReturnValue([mockExistingLink]),
				createElement: vi.fn()
			};

			vi.stubGlobal('document', mockDocument);

			try {
				prefetchGeoNamesDataset('/existing-prefetch.bin');
				expect(mockDocument.createElement).not.toHaveBeenCalled();
				expect(mockHead.appendChild).not.toHaveBeenCalled();
			} finally {
				vi.unstubAllGlobals();
			}
		});
	});

	it('should load dataset via URL', async () => {
		const dataset = await loadGeoNamesDataset(localDataFileUrl);
		expect(dataset).toBeDefined();
		expect(dataset.rawText).toBeDefined();
		expect(Array.isArray(dataset.countries)).toBe(true);
		expect(Array.isArray(dataset.states)).toBe(true);
		expect(dataset.letterRanges).toBeDefined();
		expect(dataset.geoRanges).toBeDefined();
	});

	it('should memoize dataset promise and return cached result on subsequent calls', async () => {
		const mockFetch = vi.fn().mockResolvedValue({
			ok: true,
			text: async () => JSON.stringify({ countries: ['AU'], states: [], letterRanges: {}, geoRanges: {} }) + '\n'
		});
		vi.stubGlobal('fetch', mockFetch);

		try {
			const cacheUrl = 'https://example.com/cache-memoize-test.bin';
			const dataset1 = await loadGeoNamesDataset(cacheUrl);
			const dataset2 = await loadGeoNamesDataset(cacheUrl);
			expect(dataset1).toEqual(dataset2);
			expect(mockFetch).toHaveBeenCalledTimes(1);
		} finally {
			vi.unstubAllGlobals();
		}
	});

	it('should fetch dataset over HTTP when URL starts with http:// or https://', async () => {
		const headerObj = { countries: ['AU'], states: ['NSW'], letterRanges: {}, geoRanges: {} };
		const responseBody = JSON.stringify(headerObj) + '\nSydney\t10\t0\t0\tr3gx2\n';

		const mockFetch = vi.fn().mockResolvedValue({
			ok: true,
			text: async () => responseBody
		});
		vi.stubGlobal('fetch', mockFetch);

		try {
			const httpUrl = 'https://example.com/remote-geonames.txt';
			const dataset = await loadGeoNamesDataset(httpUrl);
			expect(mockFetch).toHaveBeenCalledWith(httpUrl);
			expect(dataset.countries).toEqual(['AU']);
			expect(dataset.rawText).toBe(responseBody);
		} finally {
			vi.unstubAllGlobals();
		}
	});

	it('should parse dataset when header has no trailing newline', async () => {
		const headerObj = { countries: ['NZ'], states: [], letterRanges: {}, geoRanges: {} };
		const responseBody = JSON.stringify(headerObj);

		const mockFetch = vi.fn().mockResolvedValue({
			ok: true,
			text: async () => responseBody
		});
		vi.stubGlobal('fetch', mockFetch);

		try {
			const httpUrl = 'https://example.com/no-newline.bin';
			const dataset = await loadGeoNamesDataset(httpUrl);
			expect(dataset.countries).toEqual(['NZ']);
			expect(dataset.rawText).toBe(responseBody);
		} finally {
			vi.unstubAllGlobals();
		}
	});

	it('should fetch dataset over fetch for file:// URLs or local file paths', async () => {
		const headerObj = { countries: ['CA'], states: [], letterRanges: {}, geoRanges: {} };
		const responseBody = JSON.stringify(headerObj) + '\n';

		const mockFetch = vi.fn().mockResolvedValue({
			ok: true,
			text: async () => responseBody
		});
		vi.stubGlobal('fetch', mockFetch);

		try {
			const nonExistentFileUrl = 'file:///non/existent/path/geonames.txt';
			const dataset = await loadGeoNamesDataset(nonExistentFileUrl);
			expect(mockFetch).toHaveBeenCalledWith(nonExistentFileUrl);
			expect(dataset.countries).toEqual(['CA']);
		} finally {
			vi.unstubAllGlobals();
		}
	});

	it('should throw error when dataUrl parameter is empty or whitespace', async () => {
		await expect(loadGeoNamesDataset('')).rejects.toThrow(
			'[browser-geocoder-geonames] dataUrl parameter must be specified.'
		);
		await expect(loadGeoNamesDataset('   ')).rejects.toThrow(
			'[browser-geocoder-geonames] dataUrl parameter must be specified.'
		);
	});

	it('should throw error when HTTP response status is not ok', async () => {
		const mockFetch = vi.fn().mockResolvedValue({
			ok: false,
			statusText: 'Server Error 500'
		});
		vi.stubGlobal('fetch', mockFetch);

		try {
			const errorUrl = 'https://example.com/error-500.bin';
			await expect(loadGeoNamesDataset(errorUrl)).rejects.toThrow(
				'Failed to fetch dataset from https://example.com/error-500.bin: Server Error 500'
			);
		} finally {
			vi.unstubAllGlobals();
		}
	});

	it('should throw error when header JSON is invalid', async () => {
		const mockFetch = vi.fn().mockResolvedValue({
			ok: true,
			text: async () => 'INVALID_JSON_HEADER\nline2'
		});
		vi.stubGlobal('fetch', mockFetch);

		try {
			const invalidJsonUrl = 'https://example.com/bad-json.bin';
			await expect(loadGeoNamesDataset(invalidJsonUrl)).rejects.toThrow();
		} finally {
			vi.unstubAllGlobals();
		}
	});
});
