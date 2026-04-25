---
title: "Blog setup notes"
description: "How this Astro and GitHub Pages blog is wired together."
pubDate: 2026-04-25
tags: ["astro", "github-pages", "workflow"]
status: "reference"
draft: false
language: "en"
---

## Astro

The site is built with Astro and content collections. Blog posts live in `src/content/blog/`; shorter notes live in `src/content/notes/`.

## GitHub Pages

The site is configured as a GitHub Pages project page. Because the repository is named `garage-notes`, Astro uses the `/garage-notes` base path.

## GitHub Actions

Deployment runs from `main` through GitHub Actions. The workflow builds the static site and publishes the generated `dist/` output with GitHub Pages.

## Markdown Workflow

Content is normal Markdown or MDX. Each entry needs validated frontmatter, including `title`, `description`, `pubDate`, `tags`, `draft`, and `language`.

## How To Add A New Note

Run:

```bash
npm run new:note -- "My Note Title"
```

Then edit the generated file under `src/content/notes/` and run `npm run build` before committing.
