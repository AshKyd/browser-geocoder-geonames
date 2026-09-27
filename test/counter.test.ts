import { describe, expect, it, vi } from 'vitest';
import { setupCounter } from '../src/counter.js';

describe('setupCounter', () => {
	it('should set initial button text to Count is 0', () => {
		const buttonMock = {
			innerHTML: '',
			addEventListener: vi.fn()
		} as unknown as HTMLButtonElement;

		setupCounter(buttonMock);

		expect(buttonMock.innerHTML).toBe('Count is 0');
		expect(buttonMock.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
	});

	it('should increment count on button click', () => {
		let clickListener: (() => void) | undefined;

		const buttonMock = {
			innerHTML: '',
			addEventListener: vi.fn((event: string, listener: () => void) => {
				if (event === 'click') clickListener = listener;
			})
		} as unknown as HTMLButtonElement;

		setupCounter(buttonMock);
		expect(buttonMock.innerHTML).toBe('Count is 0');

		expect(clickListener).toBeDefined();
		clickListener!();
		expect(buttonMock.innerHTML).toBe('Count is 1');

		clickListener!();
		expect(buttonMock.innerHTML).toBe('Count is 2');
	});
});
