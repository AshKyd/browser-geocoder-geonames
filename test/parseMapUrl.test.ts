import { describe, expect, it } from 'vitest';
import { parseMapUrl } from '../src/parseMapUrl.js';

describe('parseMapUrl', () => {
	describe('Google Maps', () => {
		it('should parse @ coordinates and zoom level', () => {
			const result = parseMapUrl('https://www.google.com/maps/@-33.86785,151.20732,14z');
			expect(result).not.toBeNull();
			expect(result?.latitude).toBe(-33.86785);
			expect(result?.longitude).toBe(151.20732);
			expect(result?.zoom).toBe(14);
		});

		it('should parse @ coordinates without zoom level', () => {
			const result = parseMapUrl('https://www.google.com/maps/@-33.86785,151.20732');
			expect(result).not.toBeNull();
			expect(result?.latitude).toBe(-33.86785);
			expect(result?.longitude).toBe(151.20732);
			expect(result?.zoom).toBeUndefined();
		});

		it('should parse place URL with label and 3d/4d coordinates', () => {
			const result = parseMapUrl(
				'https://www.google.com/maps/place/Sydney+NSW/@-33.86785,151.20732,12z/data=!3m1!4b1!4m6!3m5!1s0x6b12ae401e8b983f:0x5017d6816768250!8m2!3d-33.8688197!4d151.2092955'
			);
			expect(result).not.toBeNull();
			expect(result?.latitude).toBe(-33.8688197);
			expect(result?.longitude).toBe(151.2092955);
			expect(result?.label).toBe('Sydney NSW');
		});

		it('should parse goo.gl short map URLs', () => {
			const result = parseMapUrl('https://goo.gl/maps/@-33.86785,151.20732,10z');
			expect(result).not.toBeNull();
			expect(result?.latitude).toBe(-33.86785);
			expect(result?.longitude).toBe(151.20732);
			expect(result?.zoom).toBe(10);
		});

		it('should parse maps.app.goo.gl short map URLs', () => {
			const result = parseMapUrl('https://maps.app.goo.gl/@-33.86785,151.20732,15z');
			expect(result).not.toBeNull();
			expect(result?.latitude).toBe(-33.86785);
			expect(result?.longitude).toBe(151.20732);
			expect(result?.zoom).toBe(15);
		});

		it('should handle Google Maps URL without valid coordinates', () => {
			const result = parseMapUrl('https://www.google.com/maps/place/InvalidPlace');
			expect(result).toBeNull();
		});
	});

	describe('OpenStreetMap', () => {
		it('should parse hash coordinates and zoom level', () => {
			const result = parseMapUrl('https://www.openstreetmap.org/#map=13/-33.8678/151.2073');
			expect(result).not.toBeNull();
			expect(result?.latitude).toBe(-33.8678);
			expect(result?.longitude).toBe(151.2073);
			expect(result?.zoom).toBe(13);
		});

		it('should parse mlat and mlon search parameters', () => {
			const result = parseMapUrl('https://www.openstreetmap.org/?mlat=-33.86785&mlon=151.20732');
			expect(result).not.toBeNull();
			expect(result?.latitude).toBe(-33.86785);
			expect(result?.longitude).toBe(151.20732);
		});

		it('should return null for OpenStreetMap URL without coordinates', () => {
			const result = parseMapUrl('https://www.openstreetmap.org/about');
			expect(result).toBeNull();
		});
	});

	describe('Apple Maps', () => {
		it('should parse center query param and label q param', () => {
			const result = parseMapUrl('https://maps.apple.com/?center=-33.86785,151.20732&q=Sydney');
			expect(result).not.toBeNull();
			expect(result?.latitude).toBe(-33.86785);
			expect(result?.longitude).toBe(151.20732);
			expect(result?.label).toBe('Sydney');
		});

		it('should parse ll query param', () => {
			const result = parseMapUrl('https://maps.apple.com/?ll=-33.86785,151.20732');
			expect(result).not.toBeNull();
			expect(result?.latitude).toBe(-33.86785);
			expect(result?.longitude).toBe(151.20732);
		});

		it('should parse encoded center param via fallback regex', () => {
			const result = parseMapUrl('https://maps.apple.com/custom?center=-33.86785%2C151.20732');
			expect(result).not.toBeNull();
			expect(result?.latitude).toBe(-33.86785);
			expect(result?.longitude).toBe(151.20732);
		});

		it('should return null for Apple Maps URL with invalid coordinate values', () => {
			const result = parseMapUrl('https://maps.apple.com/?center=invalid,coord');
			expect(result).toBeNull();
		});
	});

	describe('Bing Maps', () => {
		it('should parse cp parameter with encoded tilde %7E and lvl zoom', () => {
			const result = parseMapUrl('https://www.bing.com/maps/?cp=-27.570783%7E152.982103&lvl=12.9&style=r');
			expect(result).not.toBeNull();
			expect(result?.latitude).toBe(-27.570783);
			expect(result?.longitude).toBe(152.982103);
			expect(result?.zoom).toBe(12.9);
		});

		it('should parse cp parameter with literal tilde ~ without zoom', () => {
			const result = parseMapUrl('https://www.bing.com/maps/?cp=-27.570783~152.982103');
			expect(result).not.toBeNull();
			expect(result?.latitude).toBe(-27.570783);
			expect(result?.longitude).toBe(152.982103);
			expect(result?.zoom).toBeUndefined();
		});

		it('should parse regex fallback for cp and lvl parameters', () => {
			const result = parseMapUrl('https://www.bing.com/maps/search?cp=-27.570783~152.982103&lvl=14');
			expect(result).not.toBeNull();
			expect(result?.latitude).toBe(-27.570783);
			expect(result?.longitude).toBe(152.982103);
			expect(result?.zoom).toBe(14);
		});

		it('should return null for Bing Maps URL without valid cp parameter', () => {
			const result = parseMapUrl('https://www.bing.com/maps/?cp=invalid');
			expect(result).toBeNull();
		});
	});

	describe('TomTom', () => {
		it('should parse plan URL with p search parameter lat,lon,zoom', () => {
			const result = parseMapUrl('https://plan.tomtom.com/en?p=-27.44885,150.8864,8.16z');
			expect(result).not.toBeNull();
			expect(result?.latitude).toBe(-27.44885);
			expect(result?.longitude).toBe(150.8864);
			expect(result?.zoom).toBe(8.16);
		});

		it('should parse TomTom p search parameter without zoom', () => {
			const result = parseMapUrl('https://plan.tomtom.com/en?p=-27.44885,150.8864');
			expect(result).not.toBeNull();
			expect(result?.latitude).toBe(-27.44885);
			expect(result?.longitude).toBe(150.8864);
			expect(result?.zoom).toBeUndefined();
		});

		it('should parse TomTom regex fallback coordinates', () => {
			const result = parseMapUrl('https://tomtom.com/en_gb/maps/-27.44885,150.8864,12z');
			expect(result).not.toBeNull();
			expect(result?.latitude).toBe(-27.44885);
			expect(result?.longitude).toBe(150.8864);
			expect(result?.zoom).toBe(12);
		});

		it('should return null for TomTom URL with invalid p parameter', () => {
			const result = parseMapUrl('https://tomtom.com/en_gb/maps/invalid');
			expect(result).toBeNull();
		});
	});

	describe('Generic & Fallback parsing', () => {
		it('should parse geo: URI format', () => {
			const result = parseMapUrl('geo:-33.86785,151.20732');
			expect(result).not.toBeNull();
			expect(result?.latitude).toBe(-33.86785);
			expect(result?.longitude).toBe(151.20732);
		});

		it('should parse comma-separated lat,lon string', () => {
			const result = parseMapUrl('-33.86785, 151.20732');
			expect(result).not.toBeNull();
			expect(result?.latitude).toBe(-33.86785);
			expect(result?.longitude).toBe(151.20732);
		});

		it('should return null for lat/lon values exceeding geographical bounds (lat > 90 or lon > 180)', () => {
			expect(parseMapUrl('95.0, 151.20732')).toBeNull();
			expect(parseMapUrl('-33.86785, 200.0')).toBeNull();
		});

		it('should return null for empty or whitespace input', () => {
			expect(parseMapUrl('')).toBeNull();
			expect(parseMapUrl('   ')).toBeNull();
		});

		it('should return null for non-coordinate text strings', () => {
			expect(parseMapUrl('random text with no coordinates')).toBeNull();
			expect(parseMapUrl('https://example.com/page')).toBeNull();
		});
	});
});
