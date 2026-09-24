---
name: Clerk App Storage uploads
description: App Storage templates assume Replit Auth, while this app uses Clerk for authenticated upload and object serving.
---

For this project, storage upload and private object routes must use `getAuth(req).userId` from Clerk rather than the template's `req.isAuthenticated()` check.

**Why:** The App Storage template is written for Replit Auth and otherwise rejects valid Clerk sessions or checks authentication after attempting to resolve an object.

**How to apply:** Mount storage routes alongside the Clerk middleware, validate Clerk auth before object lookup, and keep product image bytes in App Storage while persisting only the served object path.