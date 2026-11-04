# ADR 0002: CSP Solver with Forward Checking & Worker Pool

## Context

Students selecting 7+ courses with multiple sections generated thousands of permutation branches. Standard naive backtracking explored unviable branches deeply, stalling the UI thread during peak solving.

## Decision

1. **CSP Forward Checking (MRV Heuristic):** Prioritize courses with the minimum remaining candidate values (MRV). When tentatively assigning a candidate section, prune conflicting sections from future courses. If any unassigned course domain becomes empty, backtrack immediately.
2. **Online / Asynchronous Class Modeling:** Explicitly identify online/e-learning lectures (e.g. 00:00-00:00) so they do not conflict with physical lectures or distort daily gap stats.
3. **Multi-threaded Web Worker Pool:** Distribute solving requests across a pool of Web Workers in `scheduleSolverClient.ts`, maintaining 60 FPS UI responsiveness.
4. **Pure TypeScript Engine:** Migrate `scheduleSolver.js` to pure `scheduleSolver.ts` for strict typing and compile-time guarantees.

## Status

Accepted and Implemented.
