import geohash from 'ngeohash';

/**
 * Strips diacritics and converts string to lowercase for search normalization.
 */
export function normalizeText(text: string): string {
	if (!text) return '';
	return text
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.toLowerCase();
}

/**
 * Normalizes location name starting letter to a single Latin a-z character.
 */
export function getNormalizedFirstLetter(name: string): string {
	if (!name) return 'a';
	const normalizedStr = normalizeText(name).replace(/[^a-z]/g, '');
	return normalizedStr.charAt(0) || 'a';
}

/**
 * Helper to yield control back to the browser's main thread to maintain 60fps frame rate.
 */
export function yieldToMain(): Promise<void> {
	if (typeof scheduler !== 'undefined' && typeof scheduler.yield === 'function') {
		return scheduler.yield();
	}
	return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Parses a base-36 population integer and scales back to hundreds.
 */
export function parseBase36Population(popB36: string): number {
	const popHundreds = parseInt(popB36, 36);
	return isNaN(popHundreds) ? 0 : popHundreds * 100;
}

/**
 * Calculates the Haversine distance in kilometers between two lat/lon coordinates.
 */
export function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
	const R = 6371;
	const dLat = ((lat2 - lat1) * Math.PI) / 180;
	const dLon = ((lon2 - lon1) * Math.PI) / 180;
	const a =
		Math.sin(dLat / 2) * Math.sin(dLat / 2) +
		Math.cos((lat1 * Math.PI) / 180) *
			Math.cos((lat2 * Math.PI) / 180) *
			Math.sin(dLon / 2) *
			Math.sin(dLon / 2);
	const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
	return R * c;
}

/**
 * Decodes a geohash string into [latitude, longitude] numbers.
 */
export function decodeGeohash(hash: string): [number, number] {
	const { latitude, longitude } = geohash.decode(hash);
	return [latitude, longitude];
}
