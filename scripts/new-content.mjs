import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [type, ...titleParts] = process.argv.slice(2);
const title = titleParts.join(' ').trim();
const validTypes = new Set(['blog', 'notes']);

if (!validTypes.has(type) || !title) {
	console.error('Usage: node scripts/new-content.mjs <blog|notes> "Title"');
	process.exit(1);
}

const today = new Date().toISOString().slice(0, 10);
const slug = slugify(title);
const dir = join(process.cwd(), 'src', 'content', type);
const file = join(dir, `${slug}.md`);

if (existsSync(file)) {
	console.error(`Refusing to overwrite existing file: ${file}`);
	process.exit(1);
}

mkdirSync(dir, { recursive: true });
writeFileSync(file, template(type, title, today), 'utf8');
console.log(file);

function slugify(value) {
	const slug = value
		.normalize('NFKD')
		.replace(/[\u0300-\u036f]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');

	return slug || `untitled-${Date.now()}`;
}

function template(contentType, entryTitle, date) {
	if (contentType === 'blog') {
		return `---
title: "${escapeYaml(entryTitle)}"
description: "Short description"
pubDate: ${date}
updatedDate: ${date}
tags: []
draft: true
language: "en"
---

## Context

## Problem

## What I Tried

## What Failed

## Current Direction

## Open Questions

## Next Step
`;
	}

	return `---
title: "${escapeYaml(entryTitle)}"
description: "Short description"
pubDate: ${date}
tags: []
status: "experiment"
draft: true
language: "en"
---

## Context

## What I Tried

## Current Direction

## Next Step
`;
}

function escapeYaml(value) {
	return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}
