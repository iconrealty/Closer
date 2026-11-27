# Closer CRM Firestore Security Specification

## 1. Data Invariants
1. **Strict Ownership Isolation**: Every `/users/{userId}` document is readable and writable only by `request.auth.uid == userId` with `request.auth.token.email_verified == true`.
2. **Client Ownership Binding**: Every `/clients/{clientId}` document must belong to `request.auth.uid == incoming().ownerId` on creation and `existing().ownerId == request.auth.uid` on reads, updates, and deletes.
3. **Immutable Ownership & Identity**: On updates, `ownerId`, `id`, and `createdAt` cannot change.
4. **Server-Side Temporal Integrity**: Both `createdAt` (on create) and `updatedAt` (on create & update) must strictly equal `request.time`.
5. **Path Variable Hardening**: Document IDs (`userId`, `clientId`) must match `^[a-zA-Z0-9_\-]+$` and be `<= 128` characters.
6. **Bounded Arrays & Strings**: Every string and array field enforces strict length/size limits to prevent resource poisoning.
7. **Zero Client Query Trust**: `allow list` on `/clients/{clientId}` explicitly requires `existing().ownerId == request.auth.uid` so unauthorized queries fail at the rules layer.

## 2. The "Dirty Dozen" Attack Payloads (Must Return `PERMISSION_DENIED`)
1. **Unauthenticated Read/List**: Anonymous user reads `/clients` or `/clients/c-1` (`request.auth == null`).
2. **Cross-Tenant Read**: Verified User B attempts `get(/clients/c-owned-by-A)`.
3. **Cross-Tenant List Without Owner Filter**: Verified User B queries `/clients` without `.where('ownerId', '==', uidB)`.
4. **Owner Spoofing on Create**: User B creates `/clients/c-999` with `ownerId: uidA`.
5. **Unverified Email Write**: User with `email_verified: false` attempts to create `/clients/c-1`.
6. **Ghost Field / Shadow Update**: Owner attempts `updateDoc` injecting `{ isAdmin: true }` or `{ role: 'superadmin' }`.
7. **Ownership Reassignment**: Owner attempts `updateDoc` modifying `ownerId` to another UID.
8. **Client-Spoofed Timestamp**: Owner creates `/clients/c-2` with `createdAt: "2020-01-01T00:00:00Z"` instead of `request.time`.
9. **Immutable `createdAt` Tampering**: Owner attempts `updateDoc` altering `createdAt`.
10. **Path Variable ID Poisoning**: User attempts to write `/clients/bad..id!!` or a 300-character document ID.
11. **Oversized String / Resource Poisoning**: User attempts to write `criteriaNotes` of length 20,000 (> 5,000 limit).
12. **Unbounded Array Poisoning**: User attempts to write `locations` with 50 items (> 20 limit) or `tags` with 100 items (> 30 limit).
