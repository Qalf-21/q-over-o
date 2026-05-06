// ─────────────────────────────────────────────────────────────────────────────
// DEPRECATED — This file is intentionally empty.
//
// The in-memory User model (bcryptjs password hashing, array-based storage)
// pre-dates the Supabase integration and was never imported by any active
// controller. All user creation, lookup, and password handling is now handled
// directly by Supabase inside:
//
//   backend/controllers/authController.js  (signUp, signInWithPassword)
//   backend/middleware/authMiddleware.js    (getUser, profiles table)
//
// bcryptjs has been removed from the FRONTEND package.json (it was a dead
// browser dependency). It remains absent from backend/package.json because
// the backend never declared it as a dependency.
//
// This file is kept as a tombstone so git history remains traceable.
// It is safe to delete it entirely in a follow-up cleanup commit.
// ─────────────────────────────────────────────────────────────────────────────