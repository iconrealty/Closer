/**
 * Firestore Security Rules Verification Spec ("Dirty Dozen" Payloads)
 * Run against Firebase Emulator Suite (@firebase/rules-unit-testing) when testing locally.
 */

export const DIRTY_DOZEN_PAYLOAD_TESTS = [
  {
    name: '1. Unauthenticated read on /clients/{id}',
    auth: null,
    operation: 'get',
    path: 'clients/c-1',
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '2. Cross-tenant get on another agent client',
    auth: { uid: 'agent-b', email_verified: true },
    operation: 'get',
    path: 'clients/c-owned-by-a',
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '3. Unfiltered list query on /clients',
    auth: { uid: 'agent-b', email_verified: true },
    operation: 'list',
    path: 'clients',
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '4. Owner spoofing on client create',
    auth: { uid: 'agent-b', email_verified: true },
    operation: 'create',
    path: 'clients/c-spoof',
    payload: { id: 'c-spoof', ownerId: 'agent-a', firstName: 'Jane' },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '5. Unverified email write blocked',
    auth: { uid: 'agent-a', email_verified: false },
    operation: 'create',
    path: 'clients/c-unverified',
    payload: { id: 'c-unverified', ownerId: 'agent-a', firstName: 'Jane' },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '6. Shadow update injecting ghost key isAdmin',
    auth: { uid: 'agent-a', email_verified: true },
    operation: 'update',
    path: 'clients/c-owned-by-a',
    payload: { isAdmin: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '7. Reassigning ownerId on update blocked',
    auth: { uid: 'agent-a', email_verified: true },
    operation: 'update',
    path: 'clients/c-owned-by-a',
    payload: { ownerId: 'agent-b' },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '8. Client-spoofed createdAt timestamp blocked',
    auth: { uid: 'agent-a', email_verified: true },
    operation: 'create',
    path: 'clients/c-bad-time',
    payload: { id: 'c-bad-time', ownerId: 'agent-a', createdAt: '2020-01-01T00:00:00Z' },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '9. Altering immutable createdAt on update blocked',
    auth: { uid: 'agent-a', email_verified: true },
    operation: 'update',
    path: 'clients/c-owned-by-a',
    payload: { createdAt: '2020-01-01T00:00:00Z' },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '10. Invalid document ID character poisoning blocked',
    auth: { uid: 'agent-a', email_verified: true },
    operation: 'create',
    path: 'clients/bad..id!!',
    payload: { id: 'bad..id!!', ownerId: 'agent-a' },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '11. Oversized criteriaNotes > 5000 chars blocked',
    auth: { uid: 'agent-a', email_verified: true },
    operation: 'create',
    path: 'clients/c-huge-notes',
    payload: { id: 'c-huge-notes', ownerId: 'agent-a', criteriaNotes: 'x'.repeat(5001) },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '12. Unbounded array > 20 locations blocked',
    auth: { uid: 'agent-a', email_verified: true },
    operation: 'create',
    path: 'clients/c-huge-locs',
    payload: {
      id: 'c-huge-locs',
      ownerId: 'agent-a',
      locations: Array.from({ length: 25 }, (_, i) => `City ${i}`),
    },
    expected: 'PERMISSION_DENIED',
  },
];
