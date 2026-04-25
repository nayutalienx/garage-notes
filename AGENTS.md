# Garage Notes Agent Guide

## Project Purpose

This is a personal engineering blog and public lab notebook.

The main idea is to publish small work-in-progress notes instead of waiting for perfect final posts. Keep the "garage door up" style, but do not leak secrets.

## Tech Stack

- Astro
- Markdown and MDX content collections
- GitHub Pages
- GitHub Actions
- npm

## Content Rules

- Blog posts are polished long-form articles.
- Notes are short work-in-progress logs.
- Prefer clear titles that are searchable.
- Good title example: `Windows volume isolation: why ACLs are not enough`
- Bad title example: `random thoughts`
- Use English by default.
- Russian is allowed if the topic is mostly local or Russian-speaking.
- Do not invent facts.
- Mark uncertainty clearly.
- Do not publish private data, tokens, passwords, API keys, IPs, banking details, legal case details, or NDA content.
- For security and networking posts, explain concepts and architecture, but avoid publishing live exploit details, credentials, private infrastructure endpoints, or copy-paste abuse instructions.

## Writing Style

- Concise.
- Practical.
- Technical.
- Honest about dead ends.
- No fake hype.
- No corporate marketing tone.

## Recommended Post Structure

- Context
- Problem
- What I tried
- What failed
- Current direction
- Open questions
- Next step

## Development Rules

- Run `npm run build` before committing.
- Use `npm run check` when changing schemas, layouts, or TypeScript.
- Keep dependencies minimal.
- Do not add React, Vue, or Svelte unless there is a clear need.
- Do not break the GitHub Pages base path.
- Preserve RSS.
- Preserve draft filtering.
- Blog content lives in `src/content/blog/`.
- Note content lives in `src/content/notes/`.
- Templates live in `templates/`.
- New content can be created with:
  - `npm run new:post -- "My Post Title"`
  - `npm run new:note -- "My Note Title"`

## Deployment Rules

- Deploy happens from `main` through GitHub Actions.
- Do not use a `gh-pages` branch unless explicitly requested.
- If the repo name is not `${OWNER}.github.io`, Astro `base` must match `/${REPO_NAME}`.
- This repo is a project page, so `astro.config.mjs` uses `base: "/garage-notes"`.
- After changing routing or config, verify the production base path.

## Git Rules

- Use clear commit messages.
- Do not commit `.env`.
- Do not commit `dist/`; GitHub Actions builds it.
- Do not commit secrets.
- Do not rewrite published history unless explicitly requested.

## Future Agent Checklist

- Inspect this `AGENTS.md`.
- Run `npm install` if dependencies are missing.
- Run `npm run build`.
- Run `npm run check` for schema, route, or TypeScript changes.
- Check content frontmatter.
- Avoid publishing drafts.
- Commit and push.
