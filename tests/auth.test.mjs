import { test } from "node:test";
import assert from "node:assert/strict";
import { credentialsSchema, signupSchema, authErrorMessage } from "../lib/auth/validation.ts";

const signup = { email: "person@example.com", password: "sample-pass-123", confirmPassword: "sample-pass-123", displayName: "Test User" };

test("signup accepts valid input and trims email and name", () => {
  const result = signupSchema.parse({ ...signup, email: " person@example.com ", displayName: " Test User " });
  assert.equal(result.email, signup.email);
  assert.equal(result.displayName, signup.displayName);
});
test("signup rejects mismatched passwords", () => {
  assert.equal(signupSchema.safeParse({ ...signup, confirmPassword: "different-pass" }).success, false);
});
test("signup rejects short passwords and empty names", () => {
  assert.equal(signupSchema.safeParse({ ...signup, password: "short", confirmPassword: "short" }).success, false);
  assert.equal(signupSchema.safeParse({ ...signup, displayName: " " }).success, false);
});
test("credentials reject invalid email and oversized passwords", () => {
  assert.equal(credentialsSchema.safeParse({ email: "bad", password: "pass" }).success, false);
  assert.equal(credentialsSchema.safeParse({ email: signup.email, password: "x".repeat(257) }).success, false);
});
test("login does not apply new signup password requirements to existing users", () => {
  assert.equal(credentialsSchema.safeParse({ email: signup.email, password: "oldpass" }).success, true);
});
test("rate limits provide actionable feedback", () => {
  assert.match(authErrorMessage({ status: 429 }), /wait/i);
  assert.match(authErrorMessage({ code: "over_email_send_rate_limit" }), /wait/i);
});
test("unconfirmed users get confirmation instructions", () => {
  assert.match(authErrorMessage({ code: "email_not_confirmed" }), /confirm your email/i);
});
test("unknown errors do not reveal internal server details", () => {
  assert.equal(authErrorMessage({ code: "private-server-detail" }).includes("private-server-detail"), false);
});
