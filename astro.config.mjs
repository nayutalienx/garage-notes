// @ts-check

import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { defineConfig } from 'astro/config';

const owner = 'nayutalienx';
const repo = 'garage-notes';
const isUserSite = String(repo) === `${owner}.github.io`;

// https://astro.build/config
export default defineConfig({
	site: `https://${owner}.github.io`,
	base: isUserSite ? '/' : `/${repo}`,
	integrations: [mdx(), sitemap()],
});
