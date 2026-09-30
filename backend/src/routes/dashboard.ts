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

router.get("/dashboard", authenticate, async (req, res): Promise<void> => {
  const userNgoId = req.auth!.ngoId;
  const resourceBase = userNgoId ? eq(resourcesTable.ownerNgoId, userNgoId) : undefined;
  const requestBase = userNgoId ? eq(requestsTable.requesterNgoId, userNgoId) : undefined;
  const [{ resourceCount }] = await db.select({ resourceCount: count() }).from(resourcesTable).where(req.auth!.role === "admin" ? undefined : resourceBase);
  const [{ requestCount }] = await db.select({ requestCount: count() }).from(requestsTable).where(req.auth!.role === "admin" ? undefined : requestBase);
  const [{ transactionCount }] = await db.select({ transactionCount: count() }).from(transactionsTable);
  const [{ unreadCount }] = await db.select({ unreadCount: count() }).from(notificationsTable).where(and(eq(notificationsTable.userId, req.auth!.sub), eq(notificationsTable.read, false)));
  const recentResources = await db.select({ resource: resourcesTable, ownerNgoName: ngosTable.name }).from(resourcesTable).innerJoin(ngosTable, eq(resourcesTable.ownerNgoId, ngosTable.id)).where(req.auth!.role === "ngo" ? resourceBase : undefined).orderBy(desc(resourcesTable.createdAt)).limit(5);
  const recentRequests = await db.select({ request: requestsTable, requesterNgoName: ngosTable.name }).from(requestsTable).innerJoin(ngosTable, eq(requestsTable.requesterNgoId, ngosTable.id)).where(req.auth!.role === "ngo" ? requestBase : undefined).orderBy(desc(requestsTable.createdAt)).limit(5);
  const recentTransactions = await db.select().from(transactionsTable).orderBy(desc(transactionsTable.createdAt)).limit(5);
  const dashboard = {
    role: req.auth!.role,
    counts: { resources: Number(resourceCount), requests: Number(requestCount), transactions: Number(transactionCount) },
    recentResources: recentResources.map((row) => resourceView(row.resource, row.ownerNgoName)),
    recentRequests: recentRequests.map((row) => requestView(row.request, row.requesterNgoName)),
    recentTransactions: recentTransactions.map(transactionView),
    unreadNotifications: Number(unreadCount),
  };
  res.json(GetDashboardResponse.parse(dashboard));
});

export default router;
