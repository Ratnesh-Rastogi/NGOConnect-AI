import {
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
  error,
  dateKey,
  idFrom,
  publicUser,
  getNgoName,
  resourceView,
  requestView,
  transactionView,
  notify,
} from "./route-common";

const router = Router();

router.get("/transactions", authenticate, async (req, res): Promise<void> => {
  const parsed = ListTransactionsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    error(res, 400, parsed.error.message);
    return;
  }
  const { status, page, pageSize } = parsed.data;
  let where =
    status && ["pending", "accepted", "completed", "cancelled"].includes(status)
      ? eq(transactionsTable.status, status as "pending" | "accepted" | "completed" | "cancelled")
      : undefined;
  const ngoId = req.auth!.ngoId;
  if (req.auth!.role === "ngo" && ngoId) {
    const ngoFilter = or(eq(resourcesTable.ownerNgoId, ngoId), eq(requestsTable.requesterNgoId, ngoId));
    where = where ? and(where, ngoFilter) : ngoFilter;
  }
  const rows = await db.select({ transaction: transactionsTable }).from(transactionsTable).innerJoin(resourcesTable, eq(transactionsTable.resourceId, resourcesTable.id)).innerJoin(requestsTable, eq(transactionsTable.requestId, requestsTable.id)).where(where).orderBy(desc(transactionsTable.createdAt)).limit(pageSize).offset((page - 1) * pageSize);
  const [{ total }] = await db.select({ total: count() }).from(transactionsTable);
  res.json(ListTransactionsResponse.parse({ items: rows.map((row) => transactionView(row.transaction)), page, pageSize, total: Number(total) }));
});

export default router;
