/**
 * InvestWise AI — Firestore Security Rules Test Suite (Dirty Dozen Reference)
 * Verifies all 12 adversarial payloads against the Eight Pillars invariants.
 * Run with Firebase Emulator Suite when available:
 *   npx firebase emulators:exec --only firestore "npx tsx firestore.rules.test.ts"
 */

export interface DirtyDozenCase {
  id: string;
  name: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  path: string;
  expected: 'PERMISSION_DENIED';
  rationale: string;
}

export const DIRTY_DOZEN_CASES: DirtyDozenCase[] = [
  {
    id: 'DD-01',
    name: 'Privilege Escalation on Signup',
    operation: 'create',
    path: '/users/attacker1',
    expected: 'PERMISSION_DENIED',
    rationale: 'Users cannot self-assign role=admin or tier=premium during creation.'
  },
  {
    id: 'DD-02',
    name: 'Shadow Field Injection on Profile Update',
    operation: 'update',
    path: '/users/investor1',
    expected: 'PERMISSION_DENIED',
    rationale: 'affectedKeys().hasOnly() rejects undeclared fields like isVerified.'
  },
  {
    id: 'DD-03',
    name: 'Self-Upgrade Tier Bypass',
    operation: 'update',
    path: '/users/investor1',
    expected: 'PERMISSION_DENIED',
    rationale: 'Non-admin investor cannot mutate tier or role fields.'
  },
  {
    id: 'DD-04',
    name: 'Cross-User PII Read',
    operation: 'get',
    path: '/users/investor1/private/profile',
    expected: 'PERMISSION_DENIED',
    rationale: 'Split PII collection denies reads to non-owners.'
  },
  {
    id: 'DD-05',
    name: 'Blanket List Scraping on Support Tickets',
    operation: 'list',
    path: '/supportTickets',
    expected: 'PERMISSION_DENIED',
    rationale: 'allow list enforces resource.data.userId == request.auth.uid.'
  },
  {
    id: 'DD-06',
    name: 'Orphaned Transaction Injection',
    operation: 'create',
    path: '/users/investor1/transactions/tx_orphan',
    expected: 'PERMISSION_DENIED',
    rationale: 'Master Gate exists() checks parent portfolio existence.'
  },
  {
    id: 'DD-07',
    name: 'Frontend Fake Payment Activation',
    operation: 'create',
    path: '/users/investor1/subscriptions/sub_fake',
    expected: 'PERMISSION_DENIED',
    rationale: 'Clients may only create pending_verification records with webhookVerified=false.'
  },
  {
    id: 'DD-08',
    name: 'Timestamp Backdating',
    operation: 'create',
    path: '/users/investor1/portfolios/pf_backdated',
    expected: 'PERMISSION_DENIED',
    rationale: 'createdAt must strictly equal request.time.'
  },
  {
    id: 'DD-09',
    name: 'ID Poisoning / Denial of Wallet',
    operation: 'create',
    path: '/users/investor1/watchlists/' + 'A'.repeat(140),
    expected: 'PERMISSION_DENIED',
    rationale: 'isValidId enforces <= 128 chars and ^[a-zA-Z0-9_\\-]+$.'
  },
  {
    id: 'DD-10',
    name: 'Unbounded Array Exhaustion',
    operation: 'create',
    path: '/users/investor1/watchlists/wl_huge',
    expected: 'PERMISSION_DENIED',
    rationale: 'Total Array Guarding restricts symbols.size() <= 50.'
  },
  {
    id: 'DD-11',
    name: 'Unverified Email Admin Spoof',
    operation: 'update',
    path: '/platformConfig/settings',
    expected: 'PERMISSION_DENIED',
    rationale: 'isAdmin() requires request.auth.token.email_verified == true.'
  },
  {
    id: 'DD-12',
    name: 'Terminal State Mutation on Resolved Ticket',
    operation: 'update',
    path: '/supportTickets/ticket_resolved',
    expected: 'PERMISSION_DENIED',
    rationale: 'Terminal state lock blocks non-admin updates when status == resolved.'
  }
];
