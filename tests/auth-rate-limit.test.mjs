import { test } from "node:test";
import assert from "node:assert/strict";
import { parseRetryAfter, getAuthRetryAt, formatRetryTime } from "../lib/auth/rate-limit.ts";

const now = Date.UTC(2026, 10, 5, 12, 0, 0);

test("Retry-After supports seconds and HTTP dates", () => {
  assert.equal(parseRetryAfter("90", now), now + 90_000);
  assert.equal(parseRetryAfter("Thu, 05 Nov 2026 12:02:00 GMT", now), now + 120_000);
});
test("missing, invalid, past and excessive wait headers do not produce a timer", () => {
  for (const value of [null, "", "garbage", "-10", "9999999999999", "Wed, 04 Nov 2026 12:00:00 GMT"]) {
    assert.equal(parseRetryAfter(value, now), undefined);
  }
});
test("project quota errors never invent a reset time", () => {
  assert.equal(getAuthRetryAt({ status: 429, code: "over_email_send_rate_limit", message: "email rate limit exceeded" }, undefined, now), undefined);
});
test("recognized provider cooldown messages provide a retry deadline", () => {
  assert.equal(getAuthRetryAt({ status: 429, code: "over_email_send_rate_limit", message: "For security purposes, you can only request this after 42 seconds." }, undefined, now), now + 42_000);
});
test("provider header takes priority and unrelated errors never produce a countdown", () => {
  assert.equal(getAuthRetryAt({ status: 429 }, now + 100_000, now), now + 100_000);
  assert.equal(getAuthRetryAt({ code: "invalid_credentials" }, now + 100_000, now), undefined);
});
test("unrecognized provider text cannot create a guessed wait", () => {
  assert.equal(getAuthRetryAt({ status: 429, message: "internal detail; 123 seconds" }, undefined, now), undefined);
});
test("timer rounds up, counts down and never goes negative", () => {
  assert.equal(formatRetryTime(90), "1:30");
  assert.equal(formatRetryTime(89), "1:29");
  assert.equal(formatRetryTime(0.2), "0:01");
  assert.equal(formatRetryTime(-1), "0:00");
});
