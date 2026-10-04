---
applyTo: "**"
description: "description"
---

# SYSTEM INSTRUCTIONS: Senior Web Development & AI Agent Constraints

## 1. Operational & Token Budget Rules

- **Direct Output Mandate:** Provide execution-ready code immediately. Omit all introductions, summaries, polite text, and post-code boilerplate.
- **Diff-Based Updates:** When modifying existing files, output ONLY the affected code blocks with precise contextual line markers (e.g., `// Replace function handleAuth inside src/auth.js`). Never re-output unchanged code.
- **No Unsolicited Explanations:** Do not explain the mechanics of the generated code unless explicitly requested using `/explain` or direct prompt questions.
- **Strict Scope Boundaries:** Implement only the requested feature. Do not refactor unrelated parts of the file or invent unrequested functionality.

## 2. Core Architecture & Clean Code Principles

- **Early Returns (Guard Clauses):** Handle invalid states, `null` checks, and boundary limits at the very beginning of functions. Eliminate deep nested `if-else` branching entirely.
- **Single Responsibility (SRP):** Keep business logic, state mutations, and DOM/UI rendering strictly isolated in dedicated functions or modules.
- **Immutability First:** Treat objects and arrays as immutable. Use spread operators (`...`), `map`, `filter`, and `reduce` instead of direct mutations (`push`, `splice`, or reassignments).
- **Composition over Inheritance:** Design modular, reusable utilities and components using composition patterns.

## 3. Strict Type Safety & Data Contracts

- **Explicit Type Declarations:** Explicitly define parameter types and return types for every function.
- **Zero Implicit `any`:** Never use `any`. Utilize `unknown` with runtime type narrowing, generics, or precise interfaces/types when handling flexible data.
- **Discriminated Unions:** Model dynamic states (e.g., `Idle`, `Loading`, `Success`, `Error`) using discriminated unions to enforce compile-time exhaustiveness checks.
- **JSDoc / Schema Annotations:** For JavaScript projects, enforce detailed `@type`, `@param`, `@returns`, and `@typedef` JSDoc annotations on all functions and modules.

## 4. Frontend, UI Engine & Modern CSS Architecture

- **Semantic HTML5 Baseline:** Mandate semantic tags (`<header>`, `<nav>`, `<main>`, `<article>`, `<section>`, `<footer>`, `<aside>`) over generic `<div>` wrappers.
- **Defensive UI States:** Always render explicit states for: (1) Loading, (2) Error/Failure, (3) Empty Data, and (4) Success Data.
- **CSS Architecture:**
  - Use modern CSS layout models (CSS Grid for 2D, Flexbox for 1D).
  - Define design tokens (colors, typography, spacing, breakpoints) using CSS custom properties (`:root` variables).
  - Write Mobile-First responsive layouts using `@media (min-width: ...)`.
  - Avoid inline CSS styles and `!important` declarations without exception.
- **Accessibility (a11y - WCAG 2.1 AA):**
  - Include appropriate `aria-*` attributes, correct `role` tags, and dynamic `alt` texts.
  - Ensure full keyboard accessibility (`tabindex`, focus rings, `Enter`/`Space` handlers for custom interactive elements).

## 5. Asynchronous Operations & API Resilience

- **Async/Await Standard:** Use `async/await` syntax exclusively. Promise chain `.then()/.catch()` is prohibited.
- **Mandatory Error Boundaries:** Wrap all async I/O and API operations inside explicit `try/catch/finally` blocks.
- **Request Cancellation:** Implement `AbortController` signals for network requests, searches, and long-running operations to prevent race conditions and memory leaks.
- **Input Sanitization & XSS Prevention:** Never inject raw string HTML using `innerHTML` or `document.write`. Use `textContent` or framework-native safe binding methods.

## 6. Performance, DOM & Memory Optimization

- **DOM Batching:** Minimize direct DOM reads/writes. Batch DOM operations using `DocumentFragment` or Virtual DOM patterns where applicable.
- **Memory Leak Prevention:** Always tear down/remove event listeners, active intervals (`clearInterval`), timeouts, and subscriptions when teardown/unmount occurs.
- **Debounce & Throttle:** Enforce debouncing or throttling on high-frequency DOM events (e.g., `scroll`, `resize`, `input`, `keyup`).

## 7. Security & Environment Integrity

- **Zero Secret Exposure:** Never hardcode API keys, credentials, or private URLs in the source code. Enforce the use of environment variables (`process.env` / `import.meta.env`).
- **Strict Input Validation:** Validate and sanitize all external data inputs at boundary interfaces (forms, query parameters, API responses) before executing application logic.
