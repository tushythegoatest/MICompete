# Security Specification for CaseMatch

## Data Invariants
1. A user profile must have a valid `uid` that matches the document ID and the authenticated user's UID.
2. A user's email in their profile must match their authenticated email.
3. Chat messages must have a `senderId` matching the authenticated user.
4. Chat messages can only be read by the sender or the receiver.

## The Dirty Dozen Payloads
1. **Identity Theft (Profile)**: Attempt to create a profile for another UID.
2. **Email Spoofing**: Attempt to use an email in profile that doesn't match auth email.
3. **Privilege Escalation**: Attempt to update another user's profile.
4. **Shadow Fields**: Adding a `role: 'admin'` field to a user profile.
5. **Message Impersonation**: Sending a message with a `senderId` that is not yours.
6. **Eavesdropping**: Reading messages where you are neither sender nor receiver.
7. **Junk ID**: Creating a message with a 2MB string as ID.
8. **Resource Exhaustion**: Sending a 1MB string in the `text` field.
9. **Timestamp Manipulation**: Setting `createdAt` to a future date.
10. **State Poisoning**: Updating `uid` or `email` in profile after creation (they should be immutable).
11. **Negative Count**: Setting `competitionCount` to -1.
12. **Null Text**: Sending a chat message with empty or null `text`.

## The Test Runner
```typescript
// firestore.rules.test.ts
// (To be implemented)
```
