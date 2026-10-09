import { Router } from "express";
import { query, withTransaction } from "@ngoconnect/db";
import {
  AcceptRequestParams, AcceptRequestResponse, CompleteRequestParams, CompleteRequestResponse,
  CreateRequestBody, CreateRequestResponse, CreateResourceBody, CreateResourceResponse,
  DeleteResourceParams, GetAdminStatsResponse, GetDashboardResponse, GetMeResponse,
  GetRequestParams, GetRequestResponse, GetResourceParams, GetResourceResponse,
  ListNgosResponse, ListNotificationsQueryParams, ListNotificationsResponse,
  ListRecommendationsResponse, ListRequestsQueryParams, ListRequestsResponse,
  ListResourcesQueryParams, ListResourcesResponse, ListTransactionsQueryParams,
  ListTransactionsResponse, LoginBody, LoginResponse, MarkNotificationReadParams,
  MarkNotificationReadResponse, RegisterBody, RegisterResponse, RejectRequestParams,
  RejectRequestResponse, UpdateResourceBody, UpdateResourceParams, UpdateResourceResponse,
  VerifyNgoBody, VerifyNgoParams, VerifyNgoResponse,
} from "@ngoconnect/api-zod";
import { comparePassword, hashPassword, signToken } from "../utils/auth.js";
import { authenticate, requireRole } from "../middleware/auth.js";

const error = (res, status, message) => res.status(status).json({ error: message });
function dateKey(value) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString().slice(0, 10) : value;
}
function idFrom(req) {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const value = Number(raw);
  return Number.isInteger(value) && value > 0 ? value : null;
}
function publicUser(user) {
  return { id: user.id, email: user.email, name: user.name, role: user.role, ngoId: user.ngoId };
}
async function getNgoName(id) {
  const [ngo] = await query("SELECT name FROM ngos WHERE id = $1", [id]);
  return ngo?.name ?? "Community NGO";
}
function resourceView(row, ownerNgoName) {
  return {
    id: row.id, ownerNgoId: row.ownerNgoId, ownerNgoName, name: row.name, category: row.category,
    description: row.description, quantity: row.quantity, unit: row.unit, location: row.location,
    expiryDate: row.expiryDate,
    status: row.expiryDate && row.expiryDate < new Date().toISOString().slice(0, 10) ? "expired" : row.status,
    createdAt: row.createdAt,
  };
}
function requestView(row, requesterNgoName) {
  return {
    id: row.id, requesterNgoId: row.requesterNgoId, requesterNgoName, resourceType: row.resourceType,
    category: row.category, quantity: row.quantity, urgency: row.urgency, location: row.location,
    requiredDate: row.requiredDate, status: row.status, createdAt: row.createdAt,
  };
}
function transactionView(row) {
  return {
    id: row.id, requestId: row.requestId, resourceId: row.resourceId, quantity: row.quantity,
    status: row.status, createdAt: row.createdAt, updatedAt: row.updatedAt,
  };
}
async function notify(userId, title, message, type, executor = query) {
  await executor(
    "INSERT INTO notifications (user_id, title, message, type) VALUES ($1, $2, $3, $4)",
    [userId, title, message, type],
  );
}

export {
  Router, query, withTransaction, error, dateKey, idFrom, publicUser, getNgoName, resourceView,
  requestView, transactionView, notify, AcceptRequestParams, AcceptRequestResponse,
  CompleteRequestParams, CompleteRequestResponse, CreateRequestBody, CreateRequestResponse,
  CreateResourceBody, CreateResourceResponse, DeleteResourceParams, GetAdminStatsResponse,
  GetDashboardResponse, GetMeResponse, GetRequestParams, GetRequestResponse, GetResourceParams,
  GetResourceResponse, ListNgosResponse, ListNotificationsQueryParams, ListNotificationsResponse,
  ListRecommendationsResponse, ListRequestsQueryParams, ListRequestsResponse,
  ListResourcesQueryParams, ListResourcesResponse, ListTransactionsQueryParams,
  ListTransactionsResponse, LoginBody, LoginResponse, MarkNotificationReadParams,
  MarkNotificationReadResponse, RegisterBody, RegisterResponse, RejectRequestParams,
  RejectRequestResponse, UpdateResourceBody, UpdateResourceParams, UpdateResourceResponse,
  VerifyNgoBody, VerifyNgoParams, VerifyNgoResponse, comparePassword, hashPassword, signToken,
  authenticate, requireRole,
};
