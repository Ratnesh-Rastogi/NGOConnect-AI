import { query, withTransaction, closeDatabase } from "@ngoconnect/db";
import { hashPassword } from "./utils/auth.js";

async function ensureUser(input) {
  const [existing] = await query("SELECT * FROM users WHERE email = $1", [input.email]);
  if (existing) return existing;
  const [created] = await query(
    "INSERT INTO users (email, password_hash, name, role, ngo_id, phone) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *",
    [input.email, input.passwordHash, input.name, input.role, input.ngoId ?? null, input.phone ?? null],
  );
  return created;
}

async function ensureResource(input) {
  const [existing] = await query("SELECT * FROM resources WHERE owner_ngo_id = $1 AND name = $2", [input.ownerNgoId, input.name]);
  if (existing) return existing;
  const [created] = await query(
    `INSERT INTO resources (owner_ngo_id, name, category, description, quantity, unit, location, expiry_date, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [input.ownerNgoId, input.name, input.category, input.description ?? "", input.quantity, input.unit, input.location, input.expiryDate ?? null, input.status ?? "available"],
  );
  return created;
}

async function ensureRequest(input) {
  const [existing] = await query("SELECT * FROM resource_requests WHERE requester_ngo_id = $1 AND resource_type = $2", [input.requesterNgoId, input.resourceType]);
  if (existing) return existing;
  const [created] = await query(
    `INSERT INTO resource_requests (requester_ngo_id, resource_type, category, quantity, urgency, location, required_date, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [input.requesterNgoId, input.resourceType, input.category ?? null, input.quantity, input.urgency, input.location, input.requiredDate, input.status ?? "open"],
  );
  return created;
}

async function main() {
  const passwordHash = await hashPassword("DemoPass123!");
  const ngoSeeds = [
    { name: "Sahaara Community Relief", contactEmail: "hello@sahaara.demo", phone: "+91 98765 10001", location: "Bengaluru", description: "Community-led food and essential supplies distribution across Bengaluru.", verificationStatus: "verified", trustScore: 86 },
    { name: "Nayi Disha Health Collective", contactEmail: "connect@nayidisha.demo", phone: "+91 98765 10002", location: "Pune", description: "Primary healthcare and medicine access for low-income neighbourhoods.", verificationStatus: "verified", trustScore: 78 },
    { name: "Udaan Women & Children", contactEmail: "team@udaan.demo", phone: "+91 98765 10003", location: "Jaipur", description: "A field network supporting women, children, and families during crisis.", verificationStatus: "pending", trustScore: 52 },
  ];
  const ngos = [];
  for (const ngo of ngoSeeds) {
    const [existing] = await query("SELECT * FROM ngos WHERE name = $1", [ngo.name]);
    if (existing) ngos.push(existing);
    else {
      const [created] = await query(
        `INSERT INTO ngos (name, contact_email, phone, location, description, verification_status, trust_score)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [ngo.name, ngo.contactEmail, ngo.phone, ngo.location, ngo.description, ngo.verificationStatus, ngo.trustScore],
      );
      ngos.push(created);
    }
  }

  const admin = await ensureUser({ email: "admin@ngoconnect.demo", passwordHash, name: "NGOConnect Administrator", role: "admin", ngoId: null });
  const ngoUsers = await Promise.all(ngos.map((ngo, index) => ensureUser({ email: `ngo${index + 1}@ngoconnect.demo`, passwordHash, name: ngo.name, role: "ngo", ngoId: ngo.id })));
  const donors = await Promise.all([
    ensureUser({ email: "donor1@ngoconnect.demo", passwordHash, name: "Ananya Mehta", role: "donor", ngoId: null }),
    ensureUser({ email: "donor2@ngoconnect.demo", passwordHash, name: "Rohan Kapoor", role: "donor", ngoId: null }),
  ]);

  await ensureResource({ ownerNgoId: ngos[0].id, name: "Fortified wheat flour", category: "food", description: "Sealed 10kg food-grade sacks for family ration kits.", quantity: 240, unit: "kg", location: "Bengaluru", expiryDate: "2026-12-20", status: "available" });
  const firstAid = await ensureResource({ ownerNgoId: ngos[1].id, name: "First-aid kits", category: "healthcare_supplies", description: "Ready-to-use first-aid kits for outreach camps.", quantity: 48, unit: "kits", location: "Pune", expiryDate: "2027-04-30", status: "available" });
  await ensureResource({ ownerNgoId: ngos[2].id, name: "Winter blankets", category: "clothing", description: "Clean, packed blankets for emergency family shelters.", quantity: 120, unit: "blankets", location: "Jaipur", expiryDate: null, status: "available" });

  const foodRequest = await ensureRequest({ requesterNgoId: ngos[2].id, resourceType: "Fortified wheat flour", category: "food", quantity: 80, urgency: "high", location: "Bengaluru", requiredDate: "2026-12-15", status: "open" });
  const kitRequest = await ensureRequest({ requesterNgoId: ngos[0].id, resourceType: "First-aid kits", category: "healthcare_supplies", quantity: 12, urgency: "critical", location: "Pune", requiredDate: "2026-12-20", status: "accepted" });
  const [existingTransaction] = await query("SELECT * FROM transactions WHERE request_id = $1", [kitRequest.id]);
  if (!existingTransaction) {
    await withTransaction(async (tx) => {
      await tx("INSERT INTO transactions (request_id, resource_id, quantity, status) VALUES ($1,$2,$3,'accepted')", [kitRequest.id, firstAid.id, kitRequest.quantity]);
      await tx("UPDATE resources SET quantity = $1, status = 'reserved', updated_at = NOW() WHERE id = $2", [firstAid.quantity - kitRequest.quantity, firstAid.id]);
    });
  }

  const notificationSeeds = [
    { userId: ngoUsers[0].id, title: "Welcome to NGOConnect AI", message: "Your verified profile is ready. Add surplus resources to help nearby teams.", type: "system" },
    { userId: ngoUsers[0].id, title: "Critical request nearby", message: "Nayi Disha Health Collective needs first-aid kits before 20 December.", type: "request_created" },
    { userId: donors[0].id, title: "New community need", message: "Udaan Women & Children is looking for fortified wheat flour.", type: "system" },
    { userId: admin.id, title: "Verification review needed", message: "Udaan Women & Children is awaiting verification.", type: "system" },
  ];
  for (const notification of notificationSeeds) {
    const [existing] = await query("SELECT id FROM notifications WHERE user_id = $1 AND title = $2", [notification.userId, notification.title]);
    if (!existing) await query("INSERT INTO notifications (user_id, title, message, type) VALUES ($1,$2,$3,$4)", [notification.userId, notification.title, notification.message, notification.type]);
  }
  process.stdout.write(`Seeded NGOConnect AI demo data: ${ngos.length} NGOs, ${ngoUsers.length + donors.length + 1} users, resources, requests, transactions, and notifications.\n`);
  void foodRequest;
}

main().catch((cause) => {
  process.stderr.write(`${cause instanceof Error ? cause.stack ?? cause.message : String(cause)}\n`);
  process.exitCode = 1;
}).finally(async () => {
  await closeDatabase();
});
