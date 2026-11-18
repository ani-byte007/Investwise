# InvestWise AI — Firestore Security Specification (Phase 0)

## 1. Data Invariants

1. **Identity Integrity (`users/{uid}`)**: A user document ID must match `request.auth.uid`. Users may only create their own profile with `role == 'investor'` and `tier == 'free'`. Self-escalation to `role == 'admin'` or `tier == 'premium'` is strictly denied.
2. **PII Isolation (`users/{uid}/private/profile`)**: Email addresses, phone numbers, and personal account settings reside exclusively in the `private` subcollection, readable and writable only by `isOwner(userId)` or `isAdmin()`.
3. **Portfolio Ownership & Master Gate (`users/{uid}/portfolios/{portfolioId}`, `users/{uid}/transactions/{txId}`)**: A transaction cannot exist without a valid parent `portfolioId` document owned by the same `userId` (`exists(/databases/$(database)/documents/users/$(userId)/portfolios/$(incoming().portfolioId))`).
4. **Immutable Ownership & Temporal Integrity**: `userId` and `createdAt` (`request.time`) are immutable after document creation. `updatedAt` must equal `request.time`.
5. **Payment Audit Integrity (`users/{uid}/subscriptions/{subId}`)**: Users may create a subscription checkout intent only with `status == 'pending_verification'` and `webhookVerified == false`. Only `isAdmin()` can transition a subscription to `active`, `refunded`, or set `webhookVerified == true`.
6. **Bounded Arrays (`watchlists`)**: Watchlist `symbols` arrays are strictly bounded to `<= 50` entries, each validated as a string ticker.
7. **Support Ticket Isolation (`supportTickets/{ticketId}`)**: Users can create and list only their own tickets (`resource.data.userId == request.auth.uid`) and cannot alter `adminReply` or `status` beyond initial `'open'`.
8. **Platform Configuration (`platformConfig/settings`)**: Publicly readable for tier limits and licensing disclosures; writable strictly by `isAdmin()`.

## 2. The "Dirty Dozen" Adversarial Payloads

1. **Privilege Escalation on Signup**: `POST /users/attacker` with `{ uid: "attacker", role: "admin", tier: "premium" }` -> DENIED (`role` must be `'investor'`, `tier` must be `'free'`).
2. **Shadow Field Injection on Profile Update**: `PATCH /users/u1` with `{ displayName: "Ravi", isVerified: true }` -> DENIED (`affectedKeys().hasOnly(...)` blocks ghost fields).
3. **Self-Upgrade Tier Bypass**: `PATCH /users/u1` with `{ tier: "premium", updatedAt: serverTimestamp() }` -> DENIED (non-admin cannot modify `tier` or `role`).
4. **Cross-User PII Read**: Authenticated `u2` calls `GET /users/u1/private/profile` -> DENIED (`isOwner` fails).
5. **Blanket List Scraping on Support Tickets**: Authenticated `u2` calls `LIST /supportTickets` without `where('userId', '==', 'u2')` -> DENIED (`allow list` requires `resource.data.userId == request.auth.uid || isAdmin()`).
6. **Orphaned Transaction Injection**: `u1` creates `/users/u1/transactions/tx1` referencing non-existent `portfolioId: "ghost_pf"` -> DENIED (Master Gate `exists(...)` fails).
7. **Frontend Fake Payment Activation**: `u1` creates `/users/u1/subscriptions/sub1` with `{ status: "active", webhookVerified: true, amountInr: 0 }` -> DENIED (`status` must be `'pending_verification'`, `webhookVerified` must be `false`).
8. **Timestamp Backdating**: `u1` creates `/users/u1/portfolios/pf1` with `{ createdAt: "2020-01-01T00:00:00Z" }` -> DENIED (`incoming().createdAt == request.time`).
9. **ID Poisoning / Denial of Wallet**: `u1` writes `/users/u1/watchlists/<150-char-invalid-id!@#>` -> DENIED (`isValidId` regex & 128-char cap fails).
10. **Unbounded Array Exhaustion**: `u1` writes `/users/u1/watchlists/w1` with `symbols: [51 tickers]` -> DENIED (`symbols.size() <= 50`).
11. **Unverified Email Admin Spoof**: Token with `email: "anikesh.0251mba193@dgu.ac.in"` and `email_verified: false` calls `PATCH /platformConfig/settings` -> DENIED (`email_verified == true` required).
12. **Terminal State Mutation on Support Ticket**: `u1` updates resolved ticket `/supportTickets/t1` (`status: 'resolved'`) -> DENIED (terminal state lock; only `isAdmin()` may override).
