import { getCollection } from 'astro:content';
import { byPubDateDesc, collectTags, entryUrl, isPublished, withBase } from '../lib/content';

const STATIC_PATHS = ['/', 'about/', 'blog/', 'notes/', 'tags/'];

export async function GET(context) {
	const blog = (await getCollection('blog')).filter(isPublished);
	const notes = (await getCollection('notes')).filter(isPublished);
	const entries = [...blog, ...notes].sort(byPubDateDesc);
	const tags = collectTags(entries);

	const urls = [
		...STATIC_PATHS.map((path) => absoluteUrl(context.site, withBase(path))),
		...entries.map((entry) => absoluteUrl(context.site, entryUrl(entry))),
		...tags.map((tag) => absoluteUrl(context.site, withBase(`tags/${tag.slug}/`))),
	];

	const body = [
		'<?xml version="1.0" encoding="UTF-8"?>',
		'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
		...urls.map((url) => `  <url><loc>${escapeXml(url)}</loc></url>`),
		'</urlset>',
		'',
	].join('\n');

	return new Response(body, {
		headers: {
			'Content-Type': 'application/xml; charset=utf-8',
		},
	});
}

function absoluteUrl(site, path) {
	return new URL(path, site).toString();
}

function escapeXml(value) {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;');
}
