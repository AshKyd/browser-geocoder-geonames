import type { ParsedMapUrlResult } from './types.js';

/**
 * Parses popular map URLs (Google Maps, OpenStreetMap, Apple Maps, Mapbox, Bing Maps)
 * and extracts latitude, longitude, optional zoom level, and place label.
 */
export function parseMapUrl(input: string): ParsedMapUrlResult | null {
	const str = input.trim();
	if (!str) return null;

	let url: URL | null = null;
	try {
		url = new URL(str);
	} catch {
		// Not a valid full URL
	}

	// 1. Google Maps
	if (
		str.includes('google.com/maps') ||
		str.includes('goo.gl/maps') ||
		str.includes('maps.app.goo.gl')
	) {
		let label: string | undefined;
		const placeMatch = str.match(/\/maps\/place\/([^/@]+)/);
		if (placeMatch && placeMatch[1]) {
			label = decodeURIComponent(placeMatch[1].replace(/\+/g, ' '));
		}

		const payloadMatch = str.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
		if (payloadMatch) {
			const lat = Number(payloadMatch[1]);
			const lon = Number(payloadMatch[2]);
			if (!isNaN(lat) && !isNaN(lon)) {
				return { latitude: lat, longitude: lon, label };
			}
		}

		const atMatch = str.match(/@(-?\d+\.\d+),(-?\d+\.\d+)(?:,(\d+(?:\.\d+)?)[zm])?/);
		if (atMatch) {
			const lat = Number(atMatch[1]);
			const lon = Number(atMatch[2]);
			const zoom = atMatch[3] ? Number(atMatch[3]) : undefined;
			if (!isNaN(lat) && !isNaN(lon)) {
				return { latitude: lat, longitude: lon, zoom, label };
			}
		}
	}

	// 2. OpenStreetMap
	if (str.includes('openstreetmap.org')) {
		const osmHashMatch = str.match(/#map=(\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)/);
		if (osmHashMatch) {
			const zoom = Number(osmHashMatch[1]);
			const lat = Number(osmHashMatch[2]);
			const lon = Number(osmHashMatch[3]);
			if (!isNaN(lat) && !isNaN(lon)) {
				return { latitude: lat, longitude: lon, zoom };
			}
		}

		if (url) {
			const mlat = url.searchParams.get('mlat');
			const mlon = url.searchParams.get('mlon');
			if (mlat && mlon) {
				const lat = Number(mlat);
				const lon = Number(mlon);
				if (!isNaN(lat) && !isNaN(lon)) {
					return { latitude: lat, longitude: lon };
				}
			}
		}
	}

	// 3. Apple Maps
	if (str.includes('maps.apple.com')) {
		if (url) {
			const center = url.searchParams.get('center');
			const ll = url.searchParams.get('ll');
			const qParam = url.searchParams.get('q');
			const targetCoordStr = center || ll;

			if (targetCoordStr) {
				const parts = decodeURIComponent(targetCoordStr).split(',');
				if (parts.length >= 2) {
					const lat = Number(parts[0]);
					const lon = Number(parts[1]);
					if (!isNaN(lat) && !isNaN(lon)) {
						return { latitude: lat, longitude: lon, label: qParam || undefined };
					}
				}
			}
		}

		const appleRegexMatch = str.match(/(?:center|ll)=(-?\d+\.\d+)(?:%2C|,)(-?\d+\.\d+)/i);
		if (appleRegexMatch) {
			const lat = Number(appleRegexMatch[1]);
			const lon = Number(appleRegexMatch[2]);
			if (!isNaN(lat) && !isNaN(lon)) {
				return { latitude: lat, longitude: lon };
			}
		}
	}

	// 4. Bing Maps
	if (str.includes('bing.com/maps')) {
		let zoom: number | undefined;
		if (url) {
			const lvlStr = url.searchParams.get('lvl');
			if (lvlStr) {
				const parsedZoom = Number(lvlStr);
				if (!isNaN(parsedZoom)) zoom = parsedZoom;
			}

			const cp = url.searchParams.get('cp');
			if (cp) {
				const parts = cp.split('~');
				if (parts.length >= 2) {
					const lat = Number(parts[0]);
					const lon = Number(parts[1]);
					if (!isNaN(lat) && !isNaN(lon)) {
						return { latitude: lat, longitude: lon, zoom };
					}
				}
			}
		}

		const bingRegexMatch = str.match(/cp=(-?\d+\.\d+)(?:%7E|~)(-?\d+\.\d+)/i);
		if (bingRegexMatch) {
			const lat = Number(bingRegexMatch[1]);
			const lon = Number(bingRegexMatch[2]);
			const lvlMatch = str.match(/lvl=(\d+(?:\.\d+)?)/i);
			if (lvlMatch && lvlMatch[1]) {
				const parsedZoom = Number(lvlMatch[1]);
				if (!isNaN(parsedZoom)) zoom = parsedZoom;
			}
			if (!isNaN(lat) && !isNaN(lon)) {
				return { latitude: lat, longitude: lon, zoom };
			}
		}
	}

	// 5. TomTom
	if (str.includes('tomtom.com')) {
		if (url) {
			const pParam = url.searchParams.get('p');
			if (pParam) {
				const parts = pParam.split(',');
				if (parts.length >= 2) {
					const lat = Number(parts[0]);
					const lon = Number(parts[1]);
					const zoomStr = parts[2] ? parts[2].replace(/z$/i, '') : undefined;
					const zoom = zoomStr ? Number(zoomStr) : undefined;
					if (!isNaN(lat) && !isNaN(lon)) {
						return { latitude: lat, longitude: lon, zoom: zoom && !isNaN(zoom) ? zoom : undefined };
					}
				}
			}
		}

		const tomtomMatch = str.match(/(-?\d+\.\d+),(-?\d+\.\d+)(?:,(\d+(?:\.\d+)?)z)?/i);
		if (tomtomMatch) {
			const lat = Number(tomtomMatch[1]);
			const lon = Number(tomtomMatch[2]);
			const zoom = tomtomMatch[3] ? Number(tomtomMatch[3]) : undefined;
			if (!isNaN(lat) && !isNaN(lon)) {
				return { latitude: lat, longitude: lon, zoom };
			}
		}
	}

	// 5. Generic lat,lon or geo: URI matching fallback
	const genericCoordMatch =
		str.match(/geo:(-?\d+\.\d+),(-?\d+\.\d+)/i) || str.match(/(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/);
	if (genericCoordMatch) {
		const lat = Number(genericCoordMatch[1]);
		const lon = Number(genericCoordMatch[2]);
		if (!isNaN(lat) && !isNaN(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
			return { latitude: lat, longitude: lon };
		}
	}

	return null;
}
