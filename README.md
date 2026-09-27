# browser-geocoder-geonames

Fast, lightweight browser-based forward geocoder and local reverse geocoder powered by [GeoNames](https://www.geonames.org/).

Uses a custom data format indexed for fast forward and reverse geocoding of place names in a 3.6 mb payload.

---

## Installation

```bash
npm install browser-geocoder-geonames
```

---

## Usage Guide

### 1. Initialising the Geocoder

Pass the URL of your database file to `loadGeoNamesDataset`:

```typescript
import {
  loadGeoNamesDataset,
  searchGeoNames,
  geolocateNearest,
  parseMapUrl,
} from "browser-geocoder-geonames";

// Option A: Vite automatic URL resolving from package bundle
import geonamesUrl from "browser-geocoder-geonames/geonames.txt?url";

// Option B: Self-hosted custom database URL
// const geonamesUrl = '/static/geonames.txt';

// Load dataset (streams and caches index structure)
const dataset = await loadGeoNamesDataset({ dataUrl: geonamesUrl });
```

### 2. Forward Searching Locations

Search by city or area name using options object:

```typescript
// Support instant operation cancellation as the user types
const controller = new AbortController();

const results = await searchGeoNames({
  keyword: "Sydney",
  dataUrl: geonamesUrl,
  onProgress: (progress) => {
    console.log("Partial results stream:", progress);
  },
  signal: controller.signal,
});

// Abort pending search if user types a new character:
// controller.abort();
```

### 3. Reverse Geocoding Coordinates

Find closest locations given latitude and longitude using options object:

```typescript
const SydneyHarbour = { lat: -33.8568, lng: 151.2153 };

const nearestPlace = await geolocateNearest({
  latitude: SydneyHarbour.lat,
  longitude: SydneyHarbour.lng,
  dataUrl: geonamesUrl,
  maxDistanceKm: 50,
});

console.log(nearestPlace);
/*
{
  name: 'Sydney',
  state: 'New South Wales',
  country: 'AU',
  distanceKm: 1.48,
  latitude: -33.8688,
  longitude: 151.2093
}
*/
```

### 4. Parsing Location Map URLs

Extract location parameters or raw coordinates directly from common web mapping links:

```typescript
const parsed = parseMapUrl(
  "https://www.google.com/maps/@-33.86785,151.20732,14z",
);

if (parsed) {
  console.log(parsed.latitude, parsed.longitude, parsed.zoom);
}
```

### 5. Cache Warming & Prefetching (Optional)

To warm the browser HTTP cache ahead of time, you can prefetch the dataset dynamically using `prefetchGeoNamesDataset()` or statically via HTML:

#### Dynamic JS Prefetching
```typescript
import { prefetchGeoNamesDataset } from "browser-geocoder-geonames";

prefetchGeoNamesDataset({ dataUrl: geonamesUrl });
```

#### Static HTML Prefetching
Add a `<link rel="prefetch">` tag in your document's `<head>` with `as="fetch"` (and `crossorigin="anonymous"` if fetching across origins):

```html
<link rel="prefetch" href="/geonames.txt" as="fetch" crossorigin="anonymous" />
```

---

## Hosting & Generating the Database

You can host your own custom dataset generated directly from official GeoNames data.

### Running the Generator Script

Execute the included dataset generator script:

```bash
# Default population cutoff (places with population >= 200, worldwide dataset)
node node_modules/browser-geocoder-geonames/scripts/fetch-geonames.js

# Custom minimum population cutoff (e.g. population >= 500)
node node_modules/browser-geocoder-geonames/scripts/fetch-geonames.js --min-pop=500

# Custom GeoNames dataset dump URL (e.g. single country dump like Australia AU.zip)
node node_modules/browser-geocoder-geonames/scripts/fetch-geonames.js --url=https://download.geonames.org/export/dump/AU.zip
```

This script:

1. Downloads `allCountries.zip` and `admin1CodesASCII.txt` from GeoNames.
2. Filters places by population cutoff (default 200, configurable via argument) and excludes statistical/metropolitan areas.
3. Encodes location data into base-36 population, state/country indices, and geohashes.
4. Outputs the indexed dataset file to `./public/geonames.txt`.

Place the resulting `geonames.txt` file in your web server's static directory (e.g. `public/geonames.txt`).

---

## Technical Architecture & File Format

The `geonames.txt` file is a compact text dataset format engineered for fast in-memory slicing:

- **Index Header (Line 1)**: The dataset begins with a single-line JSON header storing character offsets for alphabetical letter buckets (`a`-`z`) and geohash spatial buckets.
- **Tab-Separated Records**: Subsequent lines contain tab-separated fields: `name`, `base-36 population`, `country index`, `state index`, and `geohash`.
- **In-Memory Range Slicing**: Search and geolocate functions slice specific character ranges directly from the loaded dataset in memory without parsing unneeded rows.

---

## Performance & File Size

| Metric                            | Measurement | Notes                                                             |
| --------------------------------- | ----------- | ----------------------------------------------------------------- |
| **Initial Header Download**       | ~12 KB      | Line-delimited JSON index header parsed on load                   |
| **Forward Search Latency**        | < 1 ms      | In-memory lookup after bucket fetch                               |
| **Reverse Geocode Latency**       | ~50–80 ms   | Nearest neighbour spatial lookup using geohash bucket             |
| **Uncompressed File Size**        | ~11.5 MB    | Full dataset containing worldwide cities with population > 15,000 |
| **Compressed File Size (Brotli)** | **~3.5 MB** | Highly compressible text/binary structured layout                 |

### Compression Recommendation

For optimal web delivery, configure your static asset server (or CDN) to compress `geonames.txt` using **Brotli (`.br`)** or **Zstandard (`zstd`)**.

Brotli compression reduces the dataset from **~11.5 MB down to ~3.5 MB**, dramatically speeding up initial load times while serving static requests over HTTP.

---

## Testing

Run the full Vitest test suite against the binary dataset and URL parsers:

```bash
npm run test
```

---

## License

This library code is released under the **ISC License**.

### Data License

The geographical data processed and bundled by this package is sourced from [GeoNames](https://www.geonames.org/) under the [Creative Commons Attribution 4.0 International License (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/).

> This work is licensed under a [Creative Commons Attribution 4.0 License](https://creativecommons.org/licenses/by/4.0/).

You are free to share and adapt the data for any purpose (including commercially), provided you give appropriate credit to [GeoNames](https://www.geonames.org/) and provide a link to the license.
