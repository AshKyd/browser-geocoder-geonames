import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const geonamesContent = fs.readFileSync(path.resolve('public/geonames.txt'), 'utf-8');

const originalFetch = globalThis.fetch;

globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
	const urlString = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

	if (
		urlString.startsWith('file://') ||
		urlString.endsWith('geonames.txt') ||
		urlString.includes('geonames.txt')
	) {
		try {
			const filePath = urlString.startsWith('file://') ? fileURLToPath(urlString) : path.resolve(urlString);
			if (fs.existsSync(filePath)) {
				const content = fs.readFileSync(filePath, 'utf-8');
				return new Response(content, {
					status: 200,
					statusText: 'OK',
					headers: { 'Content-Type': 'text/plain' }
				});
			}
		} catch {
			// ignore and fall through
		}

		return new Response(geonamesContent, {
			status: 200,
			statusText: 'OK',
			headers: { 'Content-Type': 'text/plain' }
		});
	}

	if (originalFetch) {
		return originalFetch(input, init);
	}

	return new Response('Not Found', { status: 404, statusText: 'Not Found' });
};
