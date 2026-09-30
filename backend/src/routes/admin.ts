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

router.get("/admin/stats", authenticate, requireRole("admin"), async (_req, res): Promise<void> => {
  const [[users], [ngos], [verifiedNgos], [resources], [openRequests], [activeTransactions]] = await Promise.all([
    db.select({ value: count() }).from(usersTable),
    db.select({ value: count() }).from(ngosTable),
    db.select({ value: count() }).from(ngosTable).where(eq(ngosTable.verificationStatus, "verified")),
    db.select({ value: count() }).from(resourcesTable),
    db.select({ value: count() }).from(requestsTable).where(eq(requestsTable.status, "open")),
    db.select({ value: count() }).from(transactionsTable).where(inArray(transactionsTable.status, ["pending", "accepted"])),
  ]);
  res.json(GetAdminStatsResponse.parse({ users: Number(users.value), ngos: Number(ngos.value), verifiedNgos: Number(verifiedNgos.value), resources: Number(resources.value), openRequests: Number(openRequests.value), activeTransactions: Number(activeTransactions.value) }));
});

router.get("/admin/ngos", authenticate, requireRole("admin"), async (_req, res): Promise<void> => {
  const rows = await db.select().from(ngosTable).orderBy(desc(ngosTable.createdAt));
  res.json(ListNgosResponse.parse(rows));
});

router.post("/admin/ngos/:id/verify", authenticate, requireRole("admin"), async (req, res): Promise<void> => {
  const params = VerifyNgoParams.safeParse(req.params);
  const parsed = VerifyNgoBody.safeParse(req.body);
  if (!params.success) {
    error(res, 400, params.error.message);
    return;
  }
  if (!parsed.success) {
    error(res, 400, parsed.error.message);
    return;
  }
  const [ngo] = await db.update(ngosTable).set({ verificationStatus: parsed.data.status, updatedAt: new Date() }).where(eq(ngosTable.id, params.data.id)).returning();
  if (!ngo) {
    error(res, 404, "NGO not found");
    return;
  }
  res.json(VerifyNgoResponse.parse(ngo));
});

export default router;
