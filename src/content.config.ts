import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const language = z.enum(['en', 'ru']).default('en');

const sharedFields = {
	title: z.string().min(1),
	description: z.string().min(1),
	pubDate: z.coerce.date(),
	tags: z.array(z.string().min(1)).default([]),
	draft: z.boolean().default(false),
	language,
};

const blog = defineCollection({
	loader: glob({ base: './src/content/blog', pattern: '**/*.{md,mdx}' }),
	schema: z.object({
		...sharedFields,
		updatedDate: z.coerce.date().optional(),
	}),
});

const notes = defineCollection({
	loader: glob({ base: './src/content/notes', pattern: '**/*.{md,mdx}' }),
	schema: z.object({
		...sharedFields,
		status: z.string().min(1).default('log'),
	}),
});

export const collections = { blog, notes };
