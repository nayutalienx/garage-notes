---
title: "SecureVol: a process allowlist for mounted VeraCrypt volumes on Windows"
description: "A practical write-up about building a local Windows minifilter, service, installer, and Dear ImGui admin panel for already-mounted encrypted containers."
pubDate: 2026-04-26
updatedDate: 2026-04-26
tags: ["windows", "security", "veracrypt", "drivers"]
draft: false
language: "en"
translationKey: "securevol-veracrypt-volume-isolation"
---

## Context

VeraCrypt is good at protecting data while it is at rest. Once a container is mounted, though, Windows sees a normal volume with a normal filesystem. At that point the problem changes: the data is already decrypted, so the important question is not only which user can access it, but which processes can read and write files on that mounted volume.

SecureVol started from that exact need: protect an already-mounted VeraCrypt volume with an explicit process allowlist. Chrome should be able to use a profile stored on the protected drive. Portable Telegram should be able to keep its data there. Notepad, Explorer, random helper processes, and everything else should get `ACCESS_DENIED`.

The final project became a local defensive Windows tool:

- a kernel minifilter driver using WDK / Filter Manager;
- a .NET 8 user-mode service;
- a CLI for diagnostics and administration;
- a native Win32/DX11 admin UI built on upstream Dear ImGui;
- a GUI installer with an embedded payload and GitHub Releases auto-update.

Source code: [securevol-windows](https://github.com/nayutalienx/securevol-windows).

## What It Protects

SecureVol does not replace VeraCrypt. VeraCrypt protects the container when it is closed. SecureVol adds a runtime gate while the container is mounted and visible to Windows.

The policy uses several application identity signals:

- normalized executable path;
- Windows user account;
- executable SHA-256, when a specific version should be pinned;
- Authenticode publisher, when signed updates should be trusted;
- a flag requiring a valid signature.

One important detail: the `publisher` field is matched against the executable's Authenticode certificate publisher as resolved by Windows. It is not the file description, not `CompanyName` from version metadata, not the folder name, and not the name the application uses in its UI. For portable Telegram, the actual publisher was `Telegram FZ-LLC`; a hand-written value like `tg llc` correctly produced `PublisherMismatch`.

## Architecture

The kernel driver is intentionally small. It does not hash executables, parse signatures, or run complex policy logic. Its job is to:

- attach as a minifilter;
- inspect `IRP_MJ_CREATE` for the protected volume;
- identify the requesting process id;
- ask the user-mode service for a verdict or use a cached verdict;
- deny unknown processes on the protected volume.

The expensive and more maintainable logic lives in user mode:

- reading `policy.json`;
- path normalization;
- SHA-256 calculation;
- Authenticode validation;
- user matching;
- structured logs;
- diagnostics upload and clipboard fallback;
- protection state management.

This split was much safer than trying to make the kernel driver smart. Kernel-mode code stays small, avoids blocking work, and has fewer ways to hang the machine.

## Why ACLs Were Not Enough

NTFS ACLs answer "which security principal can open this file?" The project needed a different answer: "which process, launched by this same user, can open this file?"

If the same user runs Chrome, Notepad, a terminal, a sync client, and Telegram, normal ACLs do not provide a clean per-process boundary. A separate local user helps, but it does not solve the full workflow. Applications update, spawn child processes, use updaters, open files through reparse paths, and sometimes run from portable directories.

So the control point moved lower: filesystem opens, enforced by a minifilter.

## What Was Hard

The hardest code was not where I first expected it. The driver was dangerous, but relatively direct: attach, communication port, pre-create callback, cache, deny path. Most of the time went into productization and Windows edge cases.

### 1. Installing The Driver Package

On a development machine, everything looked simpler: WDK was installed, test-signing was enabled, a local certificate existed, and `fltmc load` worked. On a clean machine the real problems appeared:

- the WDK toolset is not always where scripts expect it;
- a driver package can be staged with `pnputil` while `fltmc load` still cannot find the `.sys`;
- a test-signed driver needs correct test-signing state and sometimes a reboot;
- the service can keep old files locked under `Program Files`, especially a self-contained .NET payload;
- repair and uninstall must not kill the installer process itself;
- install must not be reported as successful if the driver is not loaded and the service is not responding.

The installer had to become more than "copy files and hope." It now has a setup host with explicit stages, logs, elevation checks, old-process cleanup, repair mode, and a clear install summary.

### 2. Service Startup And Mount Timing

A VeraCrypt volume may not be mounted when Windows starts. Protection therefore cannot depend on `A:` existing during boot.

The correct behavior is:

- the service starts automatically;
- policy stores the volume GUID / mount point;
- if the volume is missing, the service keeps running;
- when the volume appears later, protection is re-armed;
- after reboot and remount, protection applies without a manual repair step.

This was one of the important bugs. After reboot, the container could be mounted open. The fix was delayed mount rearm, not a one-time installer action.

### 3. The Admin UI Must Survive Backend Problems

The first UI trusted the live backend path too much. If the pipe hung or the service was slow, buttons like `On`, `Off`, `Add`, `Remove`, and diagnostics became traps.

The model changed:

- the UI can show a local snapshot when the backend is temporarily unavailable;
- operations write policy locally and then try to push it into the driver;
- errors are copied to the clipboard;
- diagnostics has a fallback path;
- the release tag is visible in the UI;
- administrative operations require elevation.

For this type of tool, "request timed out" is not enough. The UI needs concrete state: policy saved, driver push failed, service down, port up/down, generation, protected volume, and recent denies.

### 4. Dear ImGui Worked, But Layout Still Matters

The first admin surface looked too much like a web dashboard: large panels, too much empty space, and poor compactness. That was the wrong shape for a small system utility.

Upstream `ocornut/imgui` over Win32/DX11 was a better fit:

- fast native UI;
- minimal dependencies;
- compact tables;
- easy raw technical state;
- no web stack for a driver admin panel.

But ImGui is not magic. If the layout is careless, buttons do not fit, scrolling feels broken, and modal windows become messy. The final UI became compact-first: the rules table is primary, rule details are separate, and system/denies/tools live in a scrollable `More` panel.

### 5. Telegram And Symlink Paths

Chrome was relatively predictable. Telegram was a useful real-world path test.

Portable Telegram can live inside the VeraCrypt volume but be launched through an external folder with a symlink or junction. For policy matching, the path observed by SecureVol may not be the path the user visually expects. Deny logs can show:

- the external launcher folder path;
- the real `A:\...` path;
- updater executables;
- different publisher/signature outcomes.

The practical solution is to add allow rules for the actual executable paths seen in SecureVol diagnostics and avoid guessing the publisher. If publisher matching is enabled, it must be the exact Authenticode publisher.

## Current Result

The project now does what it was built to do:

- protects one configured mounted VeraCrypt volume;
- applies deny-by-default only to that protected volume;
- allows explicitly approved applications;
- switches enforcement with `On` / `Off`;
- survives unmount/remount;
- re-arms after reboot when the container is mounted again;
- supports Chrome profiles on the protected volume;
- supports Telegram once path/user/publisher rules match reality;
- provides install/repair/uninstall/update;
- shows release tag, state, and diagnostics in the admin UI.

This is not a sandbox and not an EDR. Admin, SYSTEM, and kernel compromise are out of scope. If an attacker controls the kernel or administrator account, local policy can be bypassed. SecureVol addresses a narrower but practical problem: same-user processes should not automatically get access to a decrypted container just because it is mounted.

## Takeaways

The main technical takeaway: for runtime protection of a mounted encrypted volume, the right control point is not VeraCrypt and not NTFS ACLs. It is the filesystem access path. On Windows, that naturally means a minifilter.

The main product takeaway: the driver is only half of the project. To make the tool work on another machine, it needs an installer, repair path, logs, diagnostics, update path, reboot behavior, and a clear UI. Without those pieces, even a correct kernel decision path feels broken.

The main UX takeaway: security tooling must be explicit. If a rule fails because of `PublisherMismatch`, the user should see that reason instead of guessing why Telegram did not open.

SecureVol ended up as a small but real Windows systems project: driver, service, native UI, installer, and the operational problems around them. The valuable part is not only that it blocks access to a mounted VeraCrypt volume, but that it shows the full path from "let's allowlist processes" to a working local tool.
