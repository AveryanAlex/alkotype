const STOP_WORDS = new Set([
	'a',
	'an',
	'and',
	'are',
	'as',
	'at',
	'be',
	'by',
	'for',
	'from',
	'has',
	'in',
	'is',
	'it',
	'its',
	'of',
	'on',
	'or',
	'that',
	'the',
	'to',
	'was',
	'with',
	'и',
	'в',
	'во',
	'на',
	'не',
	'но',
	'что',
	'это',
	'как',
	'по',
	'от',
	'из',
	'за'
]);

export function normalizeText(text: string): string {
	return text
		.toLowerCase()
		.normalize('NFKD')
		.replace(/[\u0300-\u036f]/g, '')
		.replace(/[’']/g, '')
		.replace(/[^\p{L}\p{N}\s]+/gu, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

export function tokenize(text: string): string[] {
	const normalized = normalizeText(text);
	return normalized ? normalized.split(' ') : [];
}

export function contentWords(text: string): string[] {
	return tokenize(text).filter((word) => word.length >= 4 && !STOP_WORDS.has(word));
}
