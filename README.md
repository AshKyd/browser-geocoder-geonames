# browser-geocoder-geonames

Fast, lightweight browser-based forward geocoder and local reverse geocoder powered by [GeoNames](https://www.geonames.org/).

`browser-geocoder-geonames` performs fast prefix search and spatial nearest-neighbour reverse geocoding directly inside the client browser. It streams custom indexed binary data files over HTTP range requests, keeping memory overhead minimal.

## Features

- **Forward Search**: Fast prefix matching on location names sorted by population weight.
- **Reverse Geocoding**: Find nearby places by latitude and longitude using spatial geohashes.
- **Map URL Parser**: Extract geographic coordinates from Google Maps, Apple Maps, OpenStreetMap, Mapbox, Bing Maps, and TomTom URLs (including `p` parameters and zoom levels).
- **Zero Runtime Dependencies**: Ultra-lightweight with built-in geohash decoding and Haversine distance calculations.
- **Tree-Shakeable & Modular**: Functions split into discrete ES modules (`search`, `geolocate`, `parseMapUrl`, `loadDataset`) with `"sideEffects": false` for minimal bundle footprints.
- **Browser-Native Streaming**: Downloads and parses binary index headers while streaming without blocking the UI thread.
- **In-Memory Caching**: Memoises downloaded binary structures for subsequent searches.

---

## Installation

```bash
npm install browser-geocoder-geonames
```

---

## Usage Guide

### 1. Initialising the Geocoder

Pass the URL of your binary database file to `loadGeoNamesDataset`.

```typescript
import { loadGeoNamesDataset, searchGeoNames, geolocateNearest, parseMapUrl } from 'browser-geocoder-geonames';

// Option A: Vite automatic URL resolving from package bundle
import geonamesUrl from 'browser-geocoder-geonames/geonames.bin?url';

// Option B: Self-hosted custom database URL
// const geonamesUrl = '/static/geonames.bin';

// Load dataset (streams and caches index structure)
const dataset = await loadGeoNamesDataset(geonamesUrl);
```

### 2. Forward Searching Locations

Search by city or area name:

```typescript
// Support instant operation cancellation as the user types
const controller = new AbortController();

const results = await searchGeoNames('Sydney', geonamesUrl, (progress) => {
  console.log('Partial results stream:', progress);
}, controller.signal);

// Abort pending search if user types a new character:
// controller.abort();
```

### 3. Reverse Geocoding Coordinates

Find closest locations given latitude and longitude:

```typescript
const SydneyHarbour = { lat: -33.8568, lng: 151.2153 };

const nearestPlaces = geolocateNearest(dataset, SydneyHarbour.lat, SydneyHarbour.lng, {
  maxDistanceKm: 50,
  limit: 3
});

console.log(nearestPlaces);
/*
[
  {
    location: { name: 'Sydney', admin1: 'New South Wales', country: 'AU', ... },
    distanceKm: 1.48
  }
]
*/
```

### 4. Parsing Location Map URLs

Extract location parameters or raw coordinates directly from common web mapping links:

```typescript
const parsed = parseMapUrl('https://www.google.com/maps/@-33.86785,151.20732,14z');

if (parsed) {
  console.log(parsed.lat, parsed.lng, parsed.zoom);
}
```

---

## Hosting & Generating the Database

You can host your own custom dataset generated directly from official GeoNames data.

### Running the Generator Script

Execute the included dataset generator script:

```bash
node node_modules/browser-geocoder-geonames/scripts/fetch-geonames.js
```

This script:
1. Downloads `cities15000.zip` and `admin1CodesASCII.txt` from `files.geonames.org`.
2. Filters out metropolitan statistical areas (e.g. combined region names like "New York-Northern New Jersey-Long Island").
3. Constructs an indexed binary database containing sorted name lookups and spatial geohashes.
4. Outputs the binary database file to `./geonames.bin`.

Place the resulting `geonames.bin` file in your web server's static directory (e.g. `public/geonames.bin`).

---

## Technical Architecture & File Format

The `geonames.bin` file is designed for efficient client-side reading over HTTP range requests:

- **Index Header (First 12 KB)**: The binary file begins with a line-separated JSON header storing character offsets for alphabetical letter buckets (`a`-`z`, `0`-`9`) and geohash spatial buckets.
- **Alphabetical Buckets**: Location records inside each letter bucket are pre-sorted by population weight.
- **Spatial Geohashes**: Locations are indexed using 3-character geohashes for fast spatial searching.
- **In-Memory Caching**: Once loaded via `loadGeoNamesDataset`, letter and geohash bucket buffers are cached in memory for instant subsequent queries.

---

## Performance & File Size

| Metric | Measurement | Notes |
| --- | --- | --- |
| **Initial Header Download** | ~12 KB | Line-delimited JSON index header parsed on load |
| **Forward Search Latency** | < 1 ms | In-memory lookup after bucket fetch |
| **Reverse Geocode Latency** | ~50–80 ms | Nearest neighbour spatial lookup using geohash bucket |
| **Uncompressed File Size** | ~11.5 MB | Full dataset containing worldwide cities with population > 15,000 |
| **Compressed File Size (Brotli)** | **~3.5 MB** | Highly compressible text/binary structured layout |

### Compression Recommendation

For optimal web delivery, configure your static asset server (or CDN) to compress `geonames.bin` using **Brotli (`.br`)** or **Zstandard (`zstd`)**. 

Brotli compression reduces the binary dataset from **~11.5 MB down to ~3.5 MB**, dramatically speeding up initial load times while serving static requests over HTTP.

---

## Testing

Run the full Vitest test suite against the binary dataset and URL parsers:

```bash
npm run test
```

---

## License

MIT
