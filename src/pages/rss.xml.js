import { getCollection } from 'astro:content';
import rss from '@astrojs/rss';
import { SITE_DESCRIPTION, SITE_TITLE } from '../consts';
import { byPubDateDesc, entryUrl, isPublished, withBase } from '../lib/content';

export async function GET(context) {
	const posts = (await getCollection('blog')).filter(isPublished);
	const notes = (await getCollection('notes')).filter(isPublished);
	const entries = [...posts, ...notes].sort(byPubDateDesc);

	return rss({
		title: SITE_TITLE,
		description: SITE_DESCRIPTION,
		site: new URL(withBase('/'), context.site).toString(),
		items: entries.map((entry) => ({
			title: entry.data.title,
			description: entry.data.description,
			pubDate: entry.data.pubDate,
			categories: entry.data.tags,
			link: entryUrl(entry),
		})),
	});
}
