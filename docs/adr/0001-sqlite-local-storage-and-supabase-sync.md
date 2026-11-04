# ADR 0001: Local SQLite Storage with Supabase Sync

## Context

Originally, the backend relied on writing an in-memory JSON snapshot to `data/db.json` on disk. While simple, writing an entire JSON blob on every write became a bottleneck during high-volume catalog synchronization and concurrent student session writes. Furthermore, Windows file-locking occasionally interfered with atomic file replacements.

## Decision

Adopt **SQLite (`better-sqlite3`)** embedded locally in `data/planner.sqlite` as the primary transactional database:

1. `PRAGMA journal_mode = WAL;` and `PRAGMA synchronous = NORMAL;` provide concurrent reads and fast atomic batch transactions.
2. Relational tables with indices on `courses(code, name)`, `sections(course_code, sec_number)`, `students(student_id)`, and `majors(id)`.
3. Supabase Postgres remains the cloud synchronization source of truth, updated in atomic RPC or chunked batch upserts.
4. An encrypted snapshot `db.json` is exported asynchronously as a backup envelope, guaranteeing zero plain-text personal data on disk.

## Status

Accepted and Implemented.
