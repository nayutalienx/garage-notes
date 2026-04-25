import type { CollectionEntry } from 'astro:content';

export type BlogEntry = CollectionEntry<'blog'>;
export type NoteEntry = CollectionEntry<'notes'>;
export type Entry = BlogEntry | NoteEntry;

const base = import.meta.env.BASE_URL.endsWith('/')
	? import.meta.env.BASE_URL
	: `${import.meta.env.BASE_URL}/`;

export function withBase(path = '') {
	const cleanPath = path.replace(/^\/+/, '');
	return `${base}${cleanPath}`;
}

export function isPublished<T extends { data: { draft?: boolean } }>(entry: T) {
	return import.meta.env.DEV || !entry.data.draft;
}

export function byPubDateDesc(a: Entry, b: Entry) {
	return b.data.pubDate.valueOf() - a.data.pubDate.valueOf();
}

export function entryUrl(entry: Entry) {
	return withBase(`${entry.collection}/${entry.id}/`);
}

export function entryKind(entry: Entry) {
	return entry.collection === 'blog' ? 'Blog' : 'Note';
}

export function tagSlug(tag: string) {
	return encodeURIComponent(tag.trim().toLowerCase().replace(/\s+/g, '-'));
}

export function collectTags(entries: Entry[]) {
	const tags = new Map<string, { tag: string; slug: string; count: number }>();

	for (const entry of entries) {
		for (const tag of entry.data.tags) {
			const key = tag.trim().toLowerCase();
			const current = tags.get(key);
			if (current) {
				current.count += 1;
			} else {
				tags.set(key, { tag, slug: tagSlug(tag), count: 1 });
			}
		}
	}

	return [...tags.values()].sort((a, b) => a.tag.localeCompare(b.tag));
}
