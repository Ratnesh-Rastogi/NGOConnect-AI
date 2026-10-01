import { Router, type IRouter, type Request } from "express";
import {
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  inArray,
  ne,
  or,
  sql,
  gte,
} from "drizzle-orm";
import { db } from "@ngoconnect/db";
import {
  ngosTable,
  notificationsTable,
  requestsTable,
  resourcesTable,
  transactionsTable,
  usersTable,
} from "@ngoconnect/db";
import {
  AcceptRequestParams,
  AcceptRequestResponse,
  CompleteRequestParams,
  CompleteRequestResponse,
  CreateRequestBody,
  CreateRequestResponse,
  CreateResourceBody,
  CreateResourceResponse,
  DeleteResourceParams,
  GetAdminStatsResponse,
  GetDashboardResponse,
  GetMeResponse,
  GetRequestParams,
  GetRequestResponse,
  GetResourceParams,
  GetResourceResponse,
  ListNgosResponse,
  ListNotificationsQueryParams,
  ListNotificationsResponse,
  ListRecommendationsResponse,
  ListRequestsQueryParams,
  ListRequestsResponse,
  ListResourcesQueryParams,
  ListResourcesResponse,
  ListTransactionsQueryParams,
  ListTransactionsResponse,
  LoginBody,
  LoginResponse,
  MarkNotificationReadParams,
  MarkNotificationReadResponse,
  RegisterBody,
  RegisterResponse,
  RejectRequestParams,
  RejectRequestResponse,
  UpdateResourceBody,
  UpdateResourceParams,
  UpdateResourceResponse,
  VerifyNgoBody,
  VerifyNgoParams,
  VerifyNgoResponse,
} from "@ngoconnect/api-zod";
import { comparePassword, hashPassword, signToken } from "../lib/auth";
import { authenticate, requireRole } from "../middlewares/auth";

const error = (res: Parameters<Parameters<IRouter["get"]>[1]>[1], status: number, message: string): void => {
  res.status(status).json({ error: message });
};

function dateKey(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString().slice(0, 10) : value;
}

function idFrom(req: Request): number | null {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const value = Number(raw);
  return Number.isInteger(value) && value > 0 ? value : null;
}

function publicUser(user: typeof usersTable.$inferSelect) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    ngoId: user.ngoId,
  };
}

async function getNgoName(id: number): Promise<string> {
  const [ngo] = await db
    .select({ name: ngosTable.name })
    .from(ngosTable)
    .where(eq(ngosTable.id, id));
  return ngo?.name ?? "Community NGO";
}

function resourceView(
  row: typeof resourcesTable.$inferSelect,
  ownerNgoName: string,
) {
  return {
    id: row.id,
    ownerNgoId: row.ownerNgoId,
    ownerNgoName,
    name: row.name,
    category: row.category,
    description: row.description,
    quantity: row.quantity,
    unit: row.unit,
    location: row.location,
    expiryDate: row.expiryDate,
    status:
      row.expiryDate && row.expiryDate < new Date().toISOString().slice(0, 10)
        ? "expired"
        : row.status,
    createdAt: row.createdAt,
  };
}

function requestView(
  row: typeof requestsTable.$inferSelect,
  requesterNgoName: string,
) {
  return {
    id: row.id,
    requesterNgoId: row.requesterNgoId,
    requesterNgoName,
    resourceType: row.resourceType,
    category: row.category,
    quantity: row.quantity,
    urgency: row.urgency,
    location: row.location,
    requiredDate: row.requiredDate,
    status: row.status,
    createdAt: row.createdAt,
  };
}

function transactionView(row: typeof transactionsTable.$inferSelect) {
  return {
    id: row.id,
    requestId: row.requestId,
    resourceId: row.resourceId,
    quantity: row.quantity,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function notify(
  userId: number,
  title: string,
  message: string,
  type:
    | "request_created"
    | "request_accepted"
    | "request_rejected"
    | "transaction_completed"
    | "system",
): Promise<void> {
  await db.insert(notificationsTable).values({ userId, title, message, type });
}

export {
  error,
  dateKey,
  idFrom,
  publicUser,
  getNgoName,
  resourceView,
  requestView,
  transactionView,
  notify,
};

export {
  Router,
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  ne,
  or,
  sql,
  db,
  ngosTable,
  notificationsTable,
  requestsTable,
  resourcesTable,
  transactionsTable,
  usersTable,
  AcceptRequestParams,
  AcceptRequestResponse,
  CompleteRequestParams,
  CompleteRequestResponse,
  CreateRequestBody,
  CreateRequestResponse,
  CreateResourceBody,
  CreateResourceResponse,
  DeleteResourceParams,
  GetAdminStatsResponse,
  GetDashboardResponse,
  GetMeResponse,
  GetRequestParams,
  GetRequestResponse,
  GetResourceParams,
  GetResourceResponse,
  ListNgosResponse,
  ListNotificationsQueryParams,
  ListNotificationsResponse,
  ListRecommendationsResponse,
  ListRequestsQueryParams,
  ListRequestsResponse,
  ListResourcesQueryParams,
  ListResourcesResponse,
  ListTransactionsQueryParams,
  ListTransactionsResponse,
  LoginBody,
  LoginResponse,
  MarkNotificationReadParams,
  MarkNotificationReadResponse,
  RegisterBody,
  RegisterResponse,
  RejectRequestParams,
  RejectRequestResponse,
  UpdateResourceBody,
  UpdateResourceParams,
  UpdateResourceResponse,
  VerifyNgoBody,
  VerifyNgoParams,
  VerifyNgoResponse,
  comparePassword,
  hashPassword,
  signToken,
  authenticate,
  requireRole,
};
