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

router.get("/resources", authenticate, async (req, res): Promise<void> => {
  const parsed = ListResourcesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    error(res, 400, parsed.error.message);
    return;
  }
  const { search, category, location, status, page, pageSize } = parsed.data;
  const conditions = [];
  if (search) conditions.push(or(ilike(resourcesTable.name, `%${search}%`), ilike(resourcesTable.description, `%${search}%`)));
  if (category) conditions.push(eq(resourcesTable.category, category));
  if (location) conditions.push(ilike(resourcesTable.location, `%${location}%`));
  if (status && ["available", "reserved", "depleted", "expired"].includes(status)) {
    conditions.push(eq(resourcesTable.status, status as "available" | "reserved" | "depleted" | "expired"));
  }
  const where = conditions.length ? and(...conditions) : undefined;
  const rows = await db
    .select({ resource: resourcesTable, ownerNgoName: ngosTable.name })
    .from(resourcesTable)
    .innerJoin(ngosTable, eq(resourcesTable.ownerNgoId, ngosTable.id))
    .where(where)
    .orderBy(desc(resourcesTable.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);
  const [{ total }] = await db
    .select({ total: count() })
    .from(resourcesTable)
    .where(where);
  const response = { items: rows.map((row) => resourceView(row.resource, row.ownerNgoName)), page, pageSize, total: Number(total) };
  res.json(ListResourcesResponse.parse(response));
});

router.post("/resources", authenticate, requireRole("ngo"), async (req, res): Promise<void> => {
  const parsed = CreateResourceBody.safeParse(req.body);
  if (!parsed.success) {
    error(res, 400, parsed.error.message);
    return;
  }
  const ngoId = req.auth!.ngoId;
  if (!ngoId) {
    error(res, 400, "An NGO profile is required to list resources");
    return;
  }
  const expiryDate = dateKey(parsed.data.expiryDate);
  if (expiryDate && expiryDate < new Date().toISOString().slice(0, 10)) {
    error(res, 400, "Expiry date cannot be in the past");
    return;
  }
  const [resource] = await db
    .insert(resourcesTable)
    .values({ ...parsed.data, expiryDate, ownerNgoId: ngoId })
    .returning();
  const response = resourceView(resource, await getNgoName(resource.ownerNgoId));
  res.status(201).json(CreateResourceResponse.parse(response));
});

router.get("/resources/:id", authenticate, async (req, res): Promise<void> => {
  const params = GetResourceParams.safeParse(req.params);
  if (!params.success) {
    error(res, 400, params.error.message);
    return;
  }
  const [row] = await db
    .select({ resource: resourcesTable, ownerNgoName: ngosTable.name })
    .from(resourcesTable)
    .innerJoin(ngosTable, eq(resourcesTable.ownerNgoId, ngosTable.id))
    .where(eq(resourcesTable.id, params.data.id));
  if (!row) {
    error(res, 404, "Resource not found");
    return;
  }
  res.json(GetResourceResponse.parse(resourceView(row.resource, row.ownerNgoName)));
});

router.patch("/resources/:id", authenticate, requireRole("ngo"), async (req, res): Promise<void> => {
  const params = UpdateResourceParams.safeParse(req.params);
  const parsed = UpdateResourceBody.safeParse(req.body);
  if (!params.success) {
    error(res, 400, params.error.message);
    return;
  }
  if (!parsed.success) {
    error(res, 400, parsed.error.message);
    return;
  }
  const [existing] = await db
    .select()
    .from(resourcesTable)
    .where(eq(resourcesTable.id, params.data.id));
  if (!existing || existing.ownerNgoId !== req.auth!.ngoId) {
    error(res, 404, "Resource not found");
    return;
  }
  const expiryDate = dateKey(parsed.data.expiryDate);
  if (expiryDate && expiryDate < new Date().toISOString().slice(0, 10)) {
    error(res, 400, "Expiry date cannot be in the past");
    return;
  }
  const [resource] = await db
    .update(resourcesTable)
    .set({ ...parsed.data, expiryDate, updatedAt: new Date() })
    .where(eq(resourcesTable.id, params.data.id))
    .returning();
  const response = resourceView(resource, await getNgoName(resource.ownerNgoId));
  res.json(UpdateResourceResponse.parse(response));
});

router.delete("/resources/:id", authenticate, requireRole("ngo"), async (req, res): Promise<void> => {
  const params = DeleteResourceParams.safeParse(req.params);
  if (!params.success) {
    error(res, 400, params.error.message);
    return;
  }
  const [existing] = await db
    .select()
    .from(resourcesTable)
    .where(eq(resourcesTable.id, params.data.id));
  if (!existing || existing.ownerNgoId !== req.auth!.ngoId) {
    error(res, 404, "Resource not found");
    return;
  }
  await db.delete(resourcesTable).where(eq(resourcesTable.id, params.data.id));
  res.sendStatus(204);
});

export default router;
