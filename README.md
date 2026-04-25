# Garage Notes

Garage Notes is a minimal Astro blog for engineering notes, experiments, and unfinished thoughts.

The site is deployed as a GitHub Pages project page at:

https://nayutalienx.github.io/garage-notes/

## Local Development

```bash
npm install
npm run dev
```

Useful commands:

```bash
npm run build
npm run preview
npm run check
```

## Add Content

Create a blog post:

```bash
npm run new:post -- "My Post Title"
```

Create a note:

```bash
npm run new:note -- "My Note Title"
```

Blog posts live in `src/content/blog/`. Notes live in `src/content/notes/`. Drafts are excluded from production lists and routes.

## Deployment

Deployment runs from `main` through GitHub Actions using GitHub Pages. The workflow builds Astro and deploys the static output from `dist/`.

This repository is not `nayutalienx.github.io`, so Astro is configured with `base: "/garage-notes"` for project-page routing.
