import { defineConfig } from 'vite';
import path from 'node:path';

export default defineConfig({
	build: {
		copyPublicDir: true,
		lib: {
			entry: {
				index: path.resolve(import.meta.dirname, 'src/index.ts'),
				search: path.resolve(import.meta.dirname, 'src/search.ts'),
				geolocate: path.resolve(import.meta.dirname, 'src/geolocate.ts'),
				loadDataset: path.resolve(import.meta.dirname, 'src/loadDataset.ts'),
				parseMapUrl: path.resolve(import.meta.dirname, 'src/parseMapUrl.ts'),
				utils: path.resolve(import.meta.dirname, 'src/utils.ts'),
				constants: path.resolve(import.meta.dirname, 'src/constants.ts'),
				types: path.resolve(import.meta.dirname, 'src/types.ts')
			},
			name: 'BrowserGeocoderGeonames',
			formats: ['es']
		}
	}
});
