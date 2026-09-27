import { describe, expect, it } from 'vitest';
import * as GeoGeocoder from '../src/index.js';

describe('index exports', () => {
	it('should export all public constants', () => {
		expect(GeoGeocoder.DEFAULT_DATA_URL).toBe('/geonames.txt');
		expect(GeoGeocoder.DEFAULT_MAX_GEOLOCATE_DISTANCE_KM).toBe(50);
	});

	it('should export primary geocoder functions', () => {
		expect(typeof GeoGeocoder.loadGeoNamesDataset).toBe('function');
		expect(typeof GeoGeocoder.prefetchGeoNamesDataset).toBe('function');
		expect(typeof GeoGeocoder.searchGeoNames).toBe('function');
		expect(typeof GeoGeocoder.geolocateNearest).toBe('function');
		expect(typeof GeoGeocoder.parseMapUrl).toBe('function');
	});

	it('should export utility helper functions', () => {
		expect(typeof GeoGeocoder.getNormalizedFirstLetter).toBe('function');
		expect(typeof GeoGeocoder.yieldToMain).toBe('function');
		expect(typeof GeoGeocoder.parseBase36Population).toBe('function');
		expect(typeof GeoGeocoder.haversineDistance).toBe('function');
		expect(typeof GeoGeocoder.decodeGeohash).toBe('function');
	});
});
