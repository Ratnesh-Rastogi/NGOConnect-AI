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

router.get("/requests", authenticate, async (req, res): Promise<void> => {
  const parsed = ListRequestsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    error(res, 400, parsed.error.message);
    return;
  }
  const { direction, status, page, pageSize } = parsed.data;
  const ngoId = req.auth!.ngoId;
  const conditions = [];
  if (req.auth!.role === "ngo" && ngoId) {
    if (direction === "outgoing") conditions.push(eq(requestsTable.requesterNgoId, ngoId));
    if (direction === "incoming") conditions.push(ne(requestsTable.requesterNgoId, ngoId));
  }
  if (status && ["open", "accepted", "rejected", "completed", "cancelled"].includes(status)) {
    conditions.push(eq(requestsTable.status, status as "open" | "accepted" | "rejected" | "completed" | "cancelled"));
  }
  const where = conditions.length ? and(...conditions) : undefined;
  const rows = await db
    .select({ request: requestsTable, requesterNgoName: ngosTable.name })
    .from(requestsTable)
    .innerJoin(ngosTable, eq(requestsTable.requesterNgoId, ngosTable.id))
    .where(where)
    .orderBy(desc(requestsTable.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);
  const [{ total }] = await db.select({ total: count() }).from(requestsTable).where(where);
  const response = { items: rows.map((row) => requestView(row.request, row.requesterNgoName)), page, pageSize, total: Number(total) };
  res.json(ListRequestsResponse.parse(response));
});

router.post("/requests", authenticate, requireRole("ngo"), async (req, res): Promise<void> => {
  const parsed = CreateRequestBody.safeParse(req.body);
  if (!parsed.success) {
    error(res, 400, parsed.error.message);
    return;
  }
  const ngoId = req.auth!.ngoId;
  if (!ngoId) {
    error(res, 400, "An NGO profile is required to create requests");
    return;
  }
  const requiredDate = dateKey(parsed.data.requiredDate);
  if (!requiredDate || requiredDate < new Date().toISOString().slice(0, 10)) {
    error(res, 400, "Required date cannot be in the past");
    return;
  }
  const [request] = await db
    .insert(requestsTable)
    .values({ ...parsed.data, requiredDate, requesterNgoId: ngoId })
    .returning();
  const ngoUsers = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(and(eq(usersTable.role, "ngo"), ne(usersTable.ngoId, ngoId)));
  await Promise.all(
    ngoUsers.map((user) =>
      notify(user.id, "New resource request", `${parsed.data.resourceType} is needed by an NGO in ${parsed.data.location}.`, "request_created"),
    ),
  );
  const response = requestView(request, await getNgoName(request.requesterNgoId));
  res.status(201).json(CreateRequestResponse.parse(response));
});

router.get("/requests/:id", authenticate, async (req, res): Promise<void> => {
  const params = GetRequestParams.safeParse(req.params);
  if (!params.success) {
    error(res, 400, params.error.message);
    return;
  }
  const [row] = await db
    .select({ request: requestsTable, requesterNgoName: ngosTable.name })
    .from(requestsTable)
    .innerJoin(ngosTable, eq(requestsTable.requesterNgoId, ngosTable.id))
    .where(eq(requestsTable.id, params.data.id));
  if (!row) {
    error(res, 404, "Request not found");
    return;
  }
  res.json(GetRequestResponse.parse(requestView(row.request, row.requesterNgoName)));
});

router.post("/requests/:id/accept", authenticate, requireRole("ngo", "admin"), async (req, res): Promise<void> => {
  const params = AcceptRequestParams.safeParse(req.params);
  if (!params.success) {
    error(res, 400, params.error.message);
    return;
  }
  try {
    const transaction = await db.transaction(async (tx) => {
      const [request] = await tx
        .select()
        .from(requestsTable)
        .where(eq(requestsTable.id, params.data.id))
        .for("update");
      if (!request || request.status !== "open") throw new Error("This request is no longer open");
      const conditions = [
        eq(resourcesTable.status, "available"),
        ne(resourcesTable.ownerNgoId, request.requesterNgoId),
        sql`${resourcesTable.quantity} >= ${request.quantity}`,
      ];
      if (request.category) conditions.push(eq(resourcesTable.category, request.category));
      const [resource] = await tx
        .select()
        .from(resourcesTable)
        .where(and(...conditions))
        .orderBy(asc(resourcesTable.expiryDate), asc(resourcesTable.createdAt))
        .limit(1)
        .for("update");
      if (!resource) throw new Error("No available resource can fulfill this quantity");
      const remaining = resource.quantity - request.quantity;
      await tx
        .update(resourcesTable)
        .set({ quantity: remaining, status: remaining <= 0 ? "depleted" : "reserved", updatedAt: new Date() })
        .where(eq(resourcesTable.id, resource.id));
      const [updatedRequest] = await tx
        .update(requestsTable)
        .set({ status: "accepted", updatedAt: new Date() })
        .where(eq(requestsTable.id, request.id))
        .returning();
      const [createdTransaction] = await tx
        .insert(transactionsTable)
        .values({ requestId: request.id, resourceId: resource.id, quantity: request.quantity, status: "accepted" })
        .returning();
      const [requester] = await tx
        .select({ userId: usersTable.id })
        .from(usersTable)
        .where(eq(usersTable.ngoId, request.requesterNgoId));
      if (requester) {
        await tx.insert(notificationsTable).values({
          userId: requester.userId,
          title: "Request accepted",
          message: `Your ${request.resourceType} request has been matched to an available resource.`,
          type: "request_accepted",
        });
      }
      return createdTransaction;
    });
    res.json(AcceptRequestResponse.parse(transactionView(transaction)));
  } catch (cause) {
    error(res, 409, cause instanceof Error ? cause.message : "Request could not be accepted");
  }
});

router.post("/requests/:id/reject", authenticate, requireRole("ngo", "admin"), async (req, res): Promise<void> => {
  const params = RejectRequestParams.safeParse(req.params);
  if (!params.success) {
    error(res, 400, params.error.message);
    return;
  }
  const [request] = await db
    .update(requestsTable)
    .set({ status: "rejected", updatedAt: new Date() })
    .where(and(eq(requestsTable.id, params.data.id), eq(requestsTable.status, "open")))
    .returning();
  if (!request) {
    error(res, 409, "Only open requests can be rejected");
    return;
  }
  const [requester] = await db.select().from(usersTable).where(eq(usersTable.ngoId, request.requesterNgoId));
  if (requester) await notify(requester.id, "Request declined", `Your ${request.resourceType} request was declined.`, "request_rejected");
  res.json(RejectRequestResponse.parse(requestView(request, await getNgoName(request.requesterNgoId))));
});

router.post("/requests/:id/complete", authenticate, requireRole("ngo", "admin"), async (req, res): Promise<void> => {
  const params = CompleteRequestParams.safeParse(req.params);
  if (!params.success) {
    error(res, 400, params.error.message);
    return;
  }
  const transaction = await db.transaction(async (tx) => {
    const [current] = await tx.select().from(transactionsTable).where(eq(transactionsTable.requestId, params.data.id)).for("update");
    if (!current || current.status !== "accepted") return null;
    const [updated] = await tx.update(transactionsTable).set({ status: "completed", updatedAt: new Date() }).where(eq(transactionsTable.id, current.id)).returning();
    const [request] = await tx.update(requestsTable).set({ status: "completed", updatedAt: new Date() }).where(eq(requestsTable.id, params.data.id)).returning();
    const [requester] = await tx.select({ userId: usersTable.id }).from(usersTable).where(eq(usersTable.ngoId, request.requesterNgoId));
    if (requester) await tx.insert(notificationsTable).values({ userId: requester.userId, title: "Transfer completed", message: "Your requested resources were marked as received.", type: "transaction_completed" });
    return updated;
  });
  if (!transaction) {
    error(res, 409, "Only accepted transactions can be completed");
    return;
  }
  res.json(CompleteRequestResponse.parse(transactionView(transaction)));
});

export default router;
