import { db } from "@ngoconnect/db";
import {
  ngosTable,
  notificationsTable,
  requestsTable,
  resourcesTable,
  transactionsTable,
  usersTable,
} from "@ngoconnect/db";
import { hashPassword } from "./lib/auth";
import { and, eq } from "drizzle-orm";

async function ensureUser(input: {
  email: string;
  passwordHash: string;
  name: string;
  role: "ngo" | "donor" | "admin";
  ngoId: number | null;
}) {
  const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, input.email));
  if (existing) return existing;
  const [created] = await db.insert(usersTable).values(input).returning();
  return created;
}

async function ensureResource(input: typeof resourcesTable.$inferInsert) {
  const [existing] = await db
    .select()
    .from(resourcesTable)
    .where(and(eq(resourcesTable.ownerNgoId, input.ownerNgoId), eq(resourcesTable.name, input.name)));
  if (existing) return existing;
  const [created] = await db.insert(resourcesTable).values(input).returning();
  return created;
}

async function ensureRequest(input: typeof requestsTable.$inferInsert) {
  const [existing] = await db
    .select()
    .from(requestsTable)
    .where(and(eq(requestsTable.requesterNgoId, input.requesterNgoId), eq(requestsTable.resourceType, input.resourceType)));
  if (existing) return existing;
  const [created] = await db.insert(requestsTable).values(input).returning();
  return created;
}

async function main(): Promise<void> {
  const passwordHash = await hashPassword("DemoPass123!");

  const ngoSeeds = [
    {
      name: "Sahaara Community Relief",
      contactEmail: "hello@sahaara.demo",
      phone: "+91 98765 10001",
      location: "Bengaluru",
      description: "Community-led food and essential supplies distribution across Bengaluru.",
      verificationStatus: "verified" as const,
      trustScore: 86,
    },
    {
      name: "Nayi Disha Health Collective",
      contactEmail: "connect@nayidisha.demo",
      phone: "+91 98765 10002",
      location: "Pune",
      description: "Primary healthcare and medicine access for low-income neighbourhoods.",
      verificationStatus: "verified" as const,
      trustScore: 78,
    },
    {
      name: "Udaan Women & Children",
      contactEmail: "team@udaan.demo",
      phone: "+91 98765 10003",
      location: "Jaipur",
      description: "A field network supporting women, children, and families during crisis.",
      verificationStatus: "pending" as const,
      trustScore: 52,
    },
  ];

  const ngos = [];
  for (const ngoSeed of ngoSeeds) {
    const [existing] = await db.select().from(ngosTable).where(eq(ngosTable.name, ngoSeed.name));
    ngos.push(existing ?? (await db.insert(ngosTable).values(ngoSeed).returning())[0]);
  }

  const admin = await ensureUser({
    email: "admin@ngoconnect.demo",
    passwordHash,
    name: "NGOConnect Administrator",
    role: "admin",
    ngoId: null,
  });
  const ngoUsers = await Promise.all(
    ngos.map((ngo, index) =>
      ensureUser({
        email: `ngo${index + 1}@ngoconnect.demo`,
        passwordHash,
        name: ngo.name,
        role: "ngo",
        ngoId: ngo.id,
      }),
    ),
  );
  const donors = await Promise.all([
    ensureUser({
      email: "donor1@ngoconnect.demo",
      passwordHash,
      name: "Ananya Mehta",
      role: "donor",
      ngoId: null,
    }),
    ensureUser({
      email: "donor2@ngoconnect.demo",
      passwordHash,
      name: "Rohan Kapoor",
      role: "donor",
      ngoId: null,
    }),
  ]);

  const flour = await ensureResource({
    ownerNgoId: ngos[0].id,
    name: "Fortified wheat flour",
    category: "food",
    description: "Sealed 10kg food-grade sacks for family ration kits.",
    quantity: 240,
    unit: "kg",
    location: "Bengaluru",
    expiryDate: "2026-12-20",
    status: "available",
  });
  const firstAid = await ensureResource({
    ownerNgoId: ngos[1].id,
    name: "First-aid kits",
    category: "healthcare_supplies",
    description: "Ready-to-use first-aid kits for outreach camps.",
    quantity: 48,
    unit: "kits",
    location: "Pune",
    expiryDate: "2027-04-30",
    status: "available",
  });
  const blankets = await ensureResource({
    ownerNgoId: ngos[2].id,
    name: "Winter blankets",
    category: "clothing",
    description: "Clean, packed blankets for emergency family shelters.",
    quantity: 120,
    unit: "blankets",
    location: "Jaipur",
    expiryDate: null,
    status: "available",
  });

  const foodRequest = await ensureRequest({
    requesterNgoId: ngos[2].id,
    resourceType: "Fortified wheat flour",
    category: "food",
    quantity: 80,
    urgency: "high",
    location: "Bengaluru",
    requiredDate: "2026-10-15",
    status: "open",
  });
  const kitRequest = await ensureRequest({
    requesterNgoId: ngos[0].id,
    resourceType: "First-aid kits",
    category: "healthcare_supplies",
    quantity: 12,
    urgency: "critical",
    location: "Pune",
    requiredDate: "2026-10-08",
    status: "accepted",
  });

  const [existingTransaction] = await db
    .select()
    .from(transactionsTable)
    .where(eq(transactionsTable.requestId, kitRequest.id));
  if (!existingTransaction) {
    await db.insert(transactionsTable).values({
      requestId: kitRequest.id,
      resourceId: firstAid.id,
      quantity: kitRequest.quantity,
      status: "accepted",
    });
    await db
      .update(resourcesTable)
      .set({ quantity: firstAid.quantity - kitRequest.quantity, status: "reserved" })
      .where(eq(resourcesTable.id, firstAid.id));
  }

  const notificationSeeds = [
    {
      userId: ngoUsers[0].id,
      title: "Welcome to NGOConnect AI",
      message: "Your verified profile is ready. Add surplus resources to help nearby teams.",
      type: "system" as const,
    },
    {
      userId: ngoUsers[0].id,
      title: "Critical request nearby",
      message: "Nayi Disha Health Collective needs first-aid kits before 8 October.",
      type: "request_created" as const,
    },
    {
      userId: donors[0].id,
      title: "New community need",
      message: "Udaan Women & Children is looking for fortified wheat flour.",
      type: "system" as const,
    },
    {
      userId: admin.id,
      title: "Verification review needed",
      message: "Udaan Women & Children is awaiting verification.",
      type: "system" as const,
    },
  ];
  for (const notification of notificationSeeds) {
    const [existing] = await db
      .select()
      .from(notificationsTable)
      .where(and(eq(notificationsTable.userId, notification.userId), eq(notificationsTable.title, notification.title)));
    if (!existing) await db.insert(notificationsTable).values(notification);
  }

  process.stdout.write(
    `Seeded NGOConnect AI demo data: ${ngos.length} NGOs, ${ngoUsers.length + donors.length + 1} users, resources, requests, transactions, and notifications.\n`,
  );
  void flour;
  void blankets;
  void foodRequest;
}

main().catch((cause) => {
  process.stderr.write(`${cause instanceof Error ? cause.stack ?? cause.message : String(cause)}\n`);
  process.exitCode = 1;
});