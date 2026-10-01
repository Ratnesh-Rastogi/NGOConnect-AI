import {
  AnyPgColumn,
  boolean,
  date,
  integer,
  pgEnum,
  pgTable,
  real,
  serial,
  text,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const userRoleEnum = pgEnum("user_role", ["ngo", "donor", "admin"]);
export const verificationStatusEnum = pgEnum("verification_status", [
  "pending",
  "verified",
  "rejected",
]);
export const resourceCategoryEnum = pgEnum("resource_category", [
  "food",
  "medicines",
  "healthcare_supplies",
  "clothing",
  "other",
]);
export const resourceStatusEnum = pgEnum("resource_status", [
  "available",
  "reserved",
  "depleted",
  "expired",
]);
export const urgencyEnum = pgEnum("urgency", [
  "low",
  "medium",
  "high",
  "critical",
]);
export const requestStatusEnum = pgEnum("request_status", [
  "open",
  "accepted",
  "rejected",
  "completed",
  "cancelled",
]);
export const transactionStatusEnum = pgEnum("transaction_status", [
  "pending",
  "accepted",
  "completed",
  "cancelled",
]);
export const notificationTypeEnum = pgEnum("notification_type", [
  "request_created",
  "request_accepted",
  "request_rejected",
  "transaction_completed",
  "system",
]);

export const ngosTable = pgTable(
  "ngos",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    contactEmail: text("contact_email"),
    phone: text("phone"),
    location: text("location").notNull(),
    description: text("description").notNull().default(""),
    verificationStatus: verificationStatusEnum("verification_status")
      .notNull()
      .default("pending"),
    trustScore: real("trust_score").notNull().default(40),
    // Organisational detail (required semantically, default '' for backward compat)
    address: text("address").notNull().default(""),
    state: text("state").notNull().default(""),
    city: text("city").notNull().default(""),
    pincode: text("pincode").notNull().default(""),
    registrationNumber: text("registration_number").notNull().default(""),
    panTaxId: text("pan_tax_id").notNull().default(""),
    legalDescription: text("legal_description").notNull().default(""),
    // Optional organisational detail
    website: text("website"),
    taxExemptionDetails: text("tax_exemption_details"),
    // Verification metadata (all nullable)
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    verifiedBy: integer("verified_by").references((): AnyPgColumn => usersTable.id, {
      onDelete: "set null",
    }),
    rejectionReason: text("rejection_reason"),
    adminNotes: text("admin_notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("ngos_location_idx").on(table.location),
    index("ngos_verification_idx").on(table.verificationStatus),
  ],
);

export const usersTable = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    name: text("name").notNull(),
    role: userRoleEnum("role").notNull(),
    ngoId: integer("ngo_id").references((): AnyPgColumn => ngosTable.id, {
      onDelete: "set null",
    }),
    phone: text("phone"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [uniqueIndex("users_email_unique").on(table.email)],
);

export const resourcesTable = pgTable(
  "resources",
  {
    id: serial("id").primaryKey(),
    ownerNgoId: integer("owner_ngo_id")
      .notNull()
      .references(() => ngosTable.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    category: resourceCategoryEnum("category").notNull(),
    description: text("description").notNull().default(""),
    quantity: real("quantity").notNull(),
    unit: text("unit").notNull(),
    location: text("location").notNull(),
    expiryDate: date("expiry_date", { mode: "string" }),
    status: resourceStatusEnum("status").notNull().default("available"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("resources_owner_idx").on(table.ownerNgoId),
    index("resources_category_idx").on(table.category),
    index("resources_status_idx").on(table.status),
    index("resources_location_idx").on(table.location),
  ],
);

export const requestsTable = pgTable(
  "resource_requests",
  {
    id: serial("id").primaryKey(),
    requesterNgoId: integer("requester_ngo_id")
      .notNull()
      .references(() => ngosTable.id, { onDelete: "cascade" }),
    resourceType: text("resource_type").notNull(),
    category: resourceCategoryEnum("category"),
    quantity: real("quantity").notNull(),
    urgency: urgencyEnum("urgency").notNull(),
    location: text("location").notNull(),
    requiredDate: date("required_date", { mode: "string" }).notNull(),
    status: requestStatusEnum("status").notNull().default("open"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("requests_requester_idx").on(table.requesterNgoId),
    index("requests_status_idx").on(table.status),
    index("requests_urgency_idx").on(table.urgency),
  ],
);

export const transactionsTable = pgTable(
  "transactions",
  {
    id: serial("id").primaryKey(),
    requestId: integer("request_id")
      .notNull()
      .references(() => requestsTable.id, { onDelete: "cascade" }),
    resourceId: integer("resource_id")
      .notNull()
      .references(() => resourcesTable.id, { onDelete: "cascade" }),
    quantity: real("quantity").notNull(),
    status: transactionStatusEnum("status").notNull().default("accepted"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("transactions_request_idx").on(table.requestId),
    index("transactions_resource_idx").on(table.resourceId),
    index("transactions_status_idx").on(table.status),
  ],
);

export const notificationsTable = pgTable(
  "notifications",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    message: text("message").notNull(),
    type: notificationTypeEnum("type").notNull(),
    read: boolean("read").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("notifications_user_idx").on(table.userId),
    index("notifications_read_idx").on(table.userId, table.read),
  ],
);

export const insertNgoSchema = createInsertSchema(ngosTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertUserSchema = createInsertSchema(usersTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertResourceSchema = createInsertSchema(resourcesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertRequestSchema = createInsertSchema(requestsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertTransactionSchema = createInsertSchema(transactionsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertNotificationSchema = createInsertSchema(
  notificationsTable,
).omit({ id: true, createdAt: true });

export type Ngo = typeof ngosTable.$inferSelect;
export type User = typeof usersTable.$inferSelect;
export type Resource = typeof resourcesTable.$inferSelect;
export type ResourceRequest = typeof requestsTable.$inferSelect;
export type Transaction = typeof transactionsTable.$inferSelect;
export type Notification = typeof notificationsTable.$inferSelect;
export type InsertNgo = z.infer<typeof insertNgoSchema>;
export type InsertUser = z.infer<typeof insertUserSchema>;