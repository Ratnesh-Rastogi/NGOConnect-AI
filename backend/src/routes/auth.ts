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

router.post("/auth/register", async (req, res): Promise<void> => {
  const parsed = RegisterBody.safeParse(req.body);
  if (!parsed.success) {
    error(res, 400, parsed.error.message);
    return;
  }
  const data = parsed.data;
  const email = data.email.trim().toLowerCase();
  const [existing] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.email, email));
  if (existing) {
    error(res, 409, "An account with that email already exists");
    return;
  }

  const passwordHash = await hashPassword(data.password);
  const result = await db.transaction(async (tx) => {
    let ngoId: number | null = null;
    if (data.role === "ngo") {
      const [ngo] = await tx
        .insert(ngosTable)
        .values({
          name: data.ngoName?.trim() || data.name.trim(),
          contactEmail: email,
          phone: data.phone ?? null,
          location: "Location to be confirmed",
          description: "New NGO profile awaiting verification.",
        })
        .returning({ id: ngosTable.id });
      ngoId = ngo.id;
    }
    const [user] = await tx
      .insert(usersTable)
      .values({
        email,
        passwordHash,
        name: data.name.trim(),
        role: data.role,
        ngoId,
        phone: data.phone ?? null,
      })
      .returning();
    return user;
  });
  const response = { token: signToken({ sub: result.id, role: result.role, ngoId: result.ngoId }), user: publicUser(result) };
  res.status(201).json(RegisterResponse.parse(response));
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    error(res, 400, parsed.error.message);
    return;
  }
  const email = parsed.data.email.trim().toLowerCase();
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email));
  if (!user || !(await comparePassword(parsed.data.password, user.passwordHash))) {
    error(res, 401, "Email or password is incorrect");
    return;
  }
  const response = {
    token: signToken({ sub: user.id, role: user.role, ngoId: user.ngoId }),
    user: publicUser(user),
  };
  res.json(LoginResponse.parse(response));
});

router.post("/auth/logout", authenticate, (_req, res): void => {
  res.sendStatus(204);
});

router.get("/auth/me", authenticate, async (req, res): Promise<void> => {
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, req.auth!.sub));
  if (!user) {
    error(res, 401, "User account no longer exists");
    return;
  }
  res.json(GetMeResponse.parse(publicUser(user)));
});

export default router;
