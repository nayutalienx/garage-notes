---
title: "DOCX to PDF bot for a small VPS"
description: "A minimal Telegram bot that converts DOCX files to PDF with aiogram, LibreOffice headless, asyncio.Queue, and systemd."
pubDate: 2026-04-26
updatedDate: 2026-04-26
tags: ["python", "telegram", "libreoffice", "systemd"]
draft: false
language: "en"
---

## Context

I needed a small production Telegram bot for a simple workflow:

1. A user sends a `.docx` file.
2. The bot downloads it.
3. LibreOffice converts it to PDF in headless mode.
4. The bot sends the PDF back.
5. Temporary files disappear immediately after the job.

The code is public here: [nayutalienx/docx-pdf-bot](https://github.com/nayutalienx/docx-pdf-bot).

The target server is intentionally small: roughly the kind of VPS where adding Docker, Redis, Celery, and a database would be more architecture than the problem deserves.

## Problem

LibreOffice is the right tool for DOCX conversion, but it is not lightweight. Running several conversions at the same time on a tiny machine is an easy way to waste RAM, trigger slowdowns, or get unstable behavior.

The bot also handles user documents, so the design has to be conservative:

- no long-term storage;
- no trusting filenames;
- no `shell=True`;
- no shared LibreOffice profile;
- no parallel LibreOffice batch;
- logs visible through `journalctl`;
- deployment through `systemd`, not a custom terminal session.

## What I Tried

The first version keeps the whole system deliberately boring:

- Python 3.11+;
- aiogram 3.x;
- `asyncio.Queue(maxsize=5)`;
- one worker coroutine;
- one LibreOffice conversion at a time;
- `tempfile` for every job;
- a separate LibreOffice profile directory for every conversion;
- `.env` for the bot token;
- `systemd` for restart and boot management.

The conversion command uses LibreOffice directly:

```bash
soffice --headless --nologo --norestore --nofirststartwizard \
  -env:UserInstallation=file:///tmp/some-profile \
  --convert-to pdf:writer_pdf_Export \
  --outdir /tmp/some-job \
  /tmp/some-job/input.docx
```

The Python side uses `subprocess.run(..., shell=False)` with a 120 second timeout. If LibreOffice returns successfully but the PDF is missing, that is treated as a conversion failure.

## What Failed

The main sharp edge was not the conversion itself. It was user-facing file names.

Telegram can send documents with filenames, but the bot should not execute or trust anything from that filename. The first implementation normalized too aggressively, which made the returned PDFs look like technical artifacts instead of preserving the original document name.

The fix was to keep the safety boundary but pass a clean output filename explicitly when sending the result back through aiogram. The files still live only inside a temporary directory, and the bot still avoids shell interpolation.

## Current Direction

The current version is a compact deployment unit:

- `bot.py` handles Telegram, validation, queueing, and the worker;
- `converter.py` contains the LibreOffice call;
- `config.py` reads environment configuration;
- `systemd/docx-pdf-bot.service` runs the process from `/opt/docx-pdf-bot`;
- `.env.example` documents the token format without storing secrets.

The bot accepts only `.docx`, rejects files above 20 MB, and reports a readable Russian error message when conversion fails.

The deployment path is simple enough to reproduce:

```bash
sudo apt install -y python3 python3-venv python3-pip \
  libreoffice libreoffice-writer \
  fonts-dejavu fonts-liberation \
  fonts-crosextra-carlito fonts-crosextra-caladea fontconfig

python3 -m venv venv
./venv/bin/pip install -r requirements.txt
systemctl enable --now docx-pdf-bot
```

## Open Questions

- Whether the default font package set is enough for real-world documents.
- Whether some users will send DOCX files that LibreOffice can open but cannot faithfully render.
- Whether the 20 MB file limit is too generous for very complex documents on a small VPS.

Those are operational questions, not reasons to add a queue broker or database yet.

## Next Step

The next useful improvement is probably a small test fixture set: several DOCX files with tables, Cyrillic text, missing fonts, headers, footers, and images. That would make it easier to catch conversion regressions before touching the live service.
