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

export interface SearchGeoNamesOptions {
	/** Search keyword or phrase */
	keyword: string;
	/** Custom dataset URL or path */
	dataUrl?: string;
	/** Optional streaming progress callback */
	onProgress?: (results: GeoNameResult[]) => void;
	/** Optional AbortSignal for query cancellation */
	signal?: AbortSignal;
}

export interface GeolocateNearestOptions {
	/** Latitude coordinate (-90 to 90) */
	latitude: number;
	/** Longitude coordinate (-180 to 180) */
	longitude: number;
	/** Custom dataset URL or path */
	dataUrl?: string;
	/** Maximum distance threshold in kilometers */
	maxDistanceKm?: number;
	/** Optional progress callback */
	onProgress?: (result: NearestLocationResult | null) => void;
	/** Optional AbortSignal for query cancellation */
	signal?: AbortSignal;
}

export interface LoadDatasetOptions {
	/** Custom dataset URL or path */
	dataUrl?: string;
}

export interface PrefetchDatasetOptions {
	/** Custom dataset URL or path */
	dataUrl?: string;
}

