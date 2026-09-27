import { describe, expect, it } from 'vitest';
import { parseMapUrl } from '../src/index.js';

describe('parseMapUrl', () => {
	it('should parse Google Maps @ coordinates and zoom', () => {
		const result = parseMapUrl('https://www.google.com/maps/@-33.86785,151.20732,14z');
		expect(result).not.toBeNull();
		expect(result?.latitude).toBe(-33.86785);
		expect(result?.longitude).toBe(151.20732);
		expect(result?.zoom).toBe(14);
	});

	it('should parse Google Maps place URL with label and 3d/4d coordinates', () => {
		const result = parseMapUrl(
			'https://www.google.com/maps/place/Sydney+NSW/@-33.86785,151.20732,12z/data=!3m1!4b1!4m6!3m5!1s0x6b12ae401e8b983f:0x5017d6816768250!8m2!3d-33.8688197!4d151.2092955'
		);
		expect(result).not.toBeNull();
		expect(result?.latitude).toBe(-33.8688197);
		expect(result?.longitude).toBe(151.2092955);
		expect(result?.label).toBe('Sydney NSW');
	});

	it('should parse OpenStreetMap hash coordinates', () => {
		const result = parseMapUrl('https://www.openstreetmap.org/#map=13/-33.8678/151.2073');
		expect(result).not.toBeNull();
		expect(result?.latitude).toBe(-33.8678);
		expect(result?.longitude).toBe(151.2073);
		expect(result?.zoom).toBe(13);
	});

	it('should parse OpenStreetMap mlat/mlon search params', () => {
		const result = parseMapUrl('https://www.openstreetmap.org/?mlat=-33.86785&mlon=151.20732');
		expect(result).not.toBeNull();
		expect(result?.latitude).toBe(-33.86785);
		expect(result?.longitude).toBe(151.20732);
	});

	it('should parse Apple Maps center and query label', () => {
		const result = parseMapUrl('https://maps.apple.com/?center=-33.86785,151.20732&q=Sydney');
		expect(result).not.toBeNull();
		expect(result?.latitude).toBe(-33.86785);
		expect(result?.longitude).toBe(151.20732);
		expect(result?.label).toBe('Sydney');
	});

	it('should parse Bing Maps cp (%7E encoded) and lvl zoom', () => {
		const result = parseMapUrl('https://www.bing.com/maps/?cp=-27.570783%7E152.982103&lvl=12.9&style=r');
		expect(result).not.toBeNull();
		expect(result?.latitude).toBe(-27.570783);
		expect(result?.longitude).toBe(152.982103);
		expect(result?.zoom).toBe(12.9);
	});

	it('should parse Bing Maps cp (tilde ~) without zoom', () => {
		const result = parseMapUrl('https://www.bing.com/maps/?cp=-27.570783~152.982103');
		expect(result).not.toBeNull();
		expect(result?.latitude).toBe(-27.570783);
		expect(result?.longitude).toBe(152.982103);
	});

	it('should parse TomTom plan URL with p search parameter lat,lon,zoom', () => {
		const result = parseMapUrl('https://plan.tomtom.com/en?p=-27.44885,150.8864,8.16z');
		expect(result).not.toBeNull();
		expect(result?.latitude).toBe(-27.44885);
		expect(result?.longitude).toBe(150.8864);
		expect(result?.zoom).toBe(8.16);
	});

	it('should parse Generic lat,lon text fallback', () => {
		const result = parseMapUrl('-33.86785, 151.20732');
		expect(result).not.toBeNull();
		expect(result?.latitude).toBe(-33.86785);
		expect(result?.longitude).toBe(151.20732);
	});

	it('should return null for invalid string', () => {
		const result = parseMapUrl('invalid string without coordinates');
		expect(result).toBeNull();
	});
});
