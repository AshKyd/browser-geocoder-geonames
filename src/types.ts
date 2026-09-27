export interface GeoNameResult {
	id: string;
	name: string;
	country: string;
	state: string;
	population: number;
	latitude: number;
	longitude: number;
	/** True if all search tokens match in the place name directly */
	isNameMatch?: boolean;
}

export interface NearestLocationResult {
	name: string;
	country: string;
	state: string;
	distanceKm: number;
	latitude: number;
	longitude: number;
}

export interface ParsedMapUrlResult {
	latitude: number;
	longitude: number;
	zoom?: number;
	label?: string;
}

export interface GeoNamesLicense {
	text: string;
	url: string;
	attribution: string;
}

export interface GeoNamesParsedStore {
	license?: GeoNamesLicense;
	countries: string[];
	states: string[];
	/** Contiguous character ranges [start, end] per normalized starting letter a-z */
	letterRanges: Record<string, [number, number]>;
	/** Contiguous character ranges [[start, end], ...] per 1-character geohash prefix */
	geoRanges: Record<string, [number, number][]>;
	/** Raw uncompressed text dataset string */
	rawText: string;
}

export type GeoNamesDict = GeoNamesParsedStore;
