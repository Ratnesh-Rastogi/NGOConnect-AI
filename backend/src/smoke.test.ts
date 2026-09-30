import { test } from "node:test";
import assert from "node:assert/strict";

const api = "http://localhost:80/api";

async function login(email: string) {
  const response = await fetch(`${api}/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password: "DemoPass123!" }),
  });
  assert.equal(response.status, 200);
  return (await response.json()) as { token: string; user: { role: string } };
}

test("protected routes enforce authentication and admin authorization", async () => {
  const unauthenticated = await fetch(`${api}/resources`);
  assert.equal(unauthenticated.status, 401);

  const ngo = await login("ngo1@ngoconnect.demo");
  const adminStats = await fetch(`${api}/admin/stats`, {
    headers: { authorization: `Bearer ${ngo.token}` },
  });
  assert.equal(adminStats.status, 403);
});

test("resource creation rejects invalid quantities and persists valid listings", async () => {
  const ngo = await login("ngo1@ngoconnect.demo");
  const headers = {
    authorization: `Bearer ${ngo.token}`,
    "content-type": "application/json",
  };
  const invalid = await fetch(`${api}/resources`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: "Invalid stock",
      category: "food",
      quantity: 0,
      unit: "kg",
      location: "Bengaluru",
      expiryDate: null,
    }),
  });
  assert.equal(invalid.status, 400);

  const created = await fetch(`${api}/resources`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: "Smoke test supplies",
      category: "other",
      description: "Created by the executable smoke test.",
      quantity: 4,
      unit: "boxes",
      location: "Bengaluru",
      expiryDate: null,
    }),
  });
  assert.equal(created.status, 201);
  const resource = (await created.json()) as { id: number; quantity: number };
  assert.equal(resource.quantity, 4);

  const deleted = await fetch(`${api}/resources/${resource.id}`, {
    method: "DELETE",
    headers,
  });
  assert.equal(deleted.status, 204);
});

test("recommendations expose deterministic score explanations", async () => {
  const ngo = await login("ngo3@ngoconnect.demo");
  const response = await fetch(`${api}/recommendations`, {
    headers: { authorization: `Bearer ${ngo.token}` },
  });
  assert.equal(response.status, 200);
  const matches = (await response.json()) as Array<{ score: number; reasons: string[] }>;
  assert.ok(matches.length > 0);
  assert.ok(matches[0].score > 0 && matches[0].score <= 100);
  assert.ok(matches[0].reasons.some((reason) => reason.includes("quantity")));
});

test("request acceptance creates a transaction and prevents over-allocation", async () => {
  const requester = await login("ngo3@ngoconnect.demo");
  const requesterHeaders = {
    authorization: `Bearer ${requester.token}`,
    "content-type": "application/json",
  };
  const created = await fetch(`${api}/requests`, {
    method: "POST",
    headers: requesterHeaders,
    body: JSON.stringify({
      resourceType: "Fortified wheat flour",
      category: "food",
      quantity: 1,
      urgency: "medium",
      location: "Bengaluru",
      requiredDate: "2026-10-20",
    }),
  });
  assert.equal(created.status, 201);
  const request = (await created.json()) as { id: number };

  const owner = await login("ngo1@ngoconnect.demo");
  const accepted = await fetch(`${api}/requests/${request.id}/accept`, {
    method: "POST",
    headers: { authorization: `Bearer ${owner.token}` },
  });
  assert.equal(accepted.status, 200);
  const transaction = (await accepted.json()) as { requestId: number; status: string };
  assert.equal(transaction.requestId, request.id);
  assert.equal(transaction.status, "accepted");

  const secondAttempt = await fetch(`${api}/requests/${request.id}/accept`, {
    method: "POST",
    headers: { authorization: `Bearer ${owner.token}` },
  });
  assert.equal(secondAttempt.status, 409);
});