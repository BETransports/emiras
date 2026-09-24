---
name: TypeScript DOM iterable support
description: Generated browser clients use Headers.entries and need DOM iterable types in shared client compilation.
---

The shared React API client must include `dom.iterable` in its TypeScript `lib` list because generated fetch helpers call `Headers.entries()`.

**Why:** Without it, OpenAPI codegen succeeds but the workspace library typecheck fails on the generated client.

**How to apply:** If generated browser client code reports missing iterable members on `Headers`, check the client package `tsconfig` before changing generated output.