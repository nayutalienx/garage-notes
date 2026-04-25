---
title: "Windows volume isolation: why VeraCrypt + ACLs are not enough"
description: "A working note on isolating mounted encrypted volumes from untrusted local processes."
pubDate: 2026-04-25
updatedDate: 2026-04-25
tags: ["windows", "security", "veracrypt", "drivers"]
draft: false
language: "en"
---

## Problem

I want a mounted encrypted volume to be useful during a work session without making every local process equally able to read it. VeraCrypt protects data at rest, but once the volume is mounted, the operating system exposes a normal filesystem view.

That means the practical question moves from encryption to runtime access control: which processes are allowed to touch the mounted drive while it is unlocked?

## Naive Approach

The first idea is to combine VeraCrypt with Windows ACLs:

- mount the volume;
- set restrictive NTFS permissions;
- give access only to the expected user or service account;
- assume unrelated apps cannot read the data.

This can be enough for normal multi-user hygiene, but it is not a process isolation boundary for one logged-in user.

## Why ACLs Are Not Enough

Windows ACLs primarily answer "which security principal can access this object?" They do not cleanly answer "which process launched by the same user can access this object?"

If a browser, editor plugin, terminal, sync client, malware sample, or random helper process runs as the same user that owns the mounted files, ACLs usually do not distinguish between them. Once the user is allowed, many same-user processes inherit the ability to read.

There are related controls in Windows, but they come with tradeoffs:

- separate users or service accounts improve boundaries but make interactive workflows clumsy;
- AppLocker or WDAC can constrain execution, but they are broader application control systems;
- sandboxing can help, but it changes how the trusted application is launched and maintained;
- EFS and encryption do not solve the already-mounted runtime access problem.

So the core issue remains: the mounted volume is decrypted and visible to the OS, and normal file permissions are not a per-process allowlist.

## Possible Direction: Minifilter Driver + Service + Process Allowlist

A more serious direction is a filesystem minifilter driver paired with a user-mode service:

1. The driver observes file operations against the protected volume path or device.
2. A service owns policy: allowed executable paths, signer checks, parent process rules, session checks, and temporary grants.
3. The driver asks the service, or consults a cached decision, before allowing sensitive reads and writes.
4. Unknown or untrusted processes get denied even if the same user account would normally have NTFS permission.

This is only a direction, not a complete design. A correct implementation would need careful handling of process identity, race conditions, rename paths, hard links, reparse points, caching, service failure behavior, and boot or mount timing.

## Open Questions

- How should process identity be represented: PID, image path, code signature, token, or a combination?
- What is the failure mode when the policy service is unavailable?
- Can the policy safely handle editors and tools that spawn helper processes?
- How should writes, metadata reads, directory listings, and memory-mapped files be treated?
- What is the acceptable UX cost for mounting, granting, and revoking access?

## Next Steps

The next useful step is not to claim the isolation is solved. It is to build a small prototype that logs file access attempts for one mounted test volume, then compare the observed process tree with the expected trusted workflow.
