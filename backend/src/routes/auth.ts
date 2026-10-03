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
import { alias } from "drizzle-orm/pg-core";

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

  // For NGO registrations, validate the 7 required organisational fields before
  // hashing the password or writing anything to the database.
  if (data.role === "ngo") {
    const ngoRequired: Record<string, string> = {
      address:            String(req.body.address            ?? "").trim(),
      state:              String(req.body.state              ?? "").trim(),
      city:               String(req.body.city               ?? "").trim(),
      pincode:            String(req.body.pincode            ?? "").trim(),
      registrationNumber: String(req.body.registrationNumber ?? "").trim(),
      panTaxId:           String(req.body.panTaxId           ?? "").trim(),
      legalDescription:   String(req.body.legalDescription   ?? "").trim(),
    };
    const missing = Object.entries(ngoRequired)
      .filter(([, v]) => v === "")
      .map(([k]) => k);
    if (missing.length > 0) {
      error(res, 400, `Missing required NGO fields: ${missing.join(", ")}`);
      return;
    }
  }

  const passwordHash = await hashPassword(data.password);
  const result = await db.transaction(async (tx) => {
    let ngoId: number | null = null;
    if (data.role === "ngo") {
      const address            = String(req.body.address            ?? "").trim();
      const state              = String(req.body.state              ?? "").trim();
      const city               = String(req.body.city               ?? "").trim();
      const pincode            = String(req.body.pincode            ?? "").trim();
      const registrationNumber = String(req.body.registrationNumber ?? "").trim();
      const panTaxId           = String(req.body.panTaxId           ?? "").trim();
      const legalDescription   = String(req.body.legalDescription   ?? "").trim();
      const [ngo] = await tx
        .insert(ngosTable)
        .values({
          name: data.ngoName?.trim() || data.name.trim(),
          contactEmail: email,
          phone: data.phone ?? null,
          location: city ? `${city}, ${state}` : "Location to be confirmed",
          description: "New NGO profile awaiting verification.",
          address,
          state,
          city,
          pincode,
          registrationNumber,
          panTaxId,
          legalDescription,
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

  if (user.role === "ngo" && user.ngoId != null) {
    const verifierAlias = alias(usersTable, "verifier");
    const [row] = await db
      .select({
        id:                   ngosTable.id,
        name:                 ngosTable.name,
        contactEmail:         ngosTable.contactEmail,
        phone:                ngosTable.phone,
        address:              ngosTable.address,
        state:                ngosTable.state,
        city:                 ngosTable.city,
        pincode:              ngosTable.pincode,
        registrationNumber:   ngosTable.registrationNumber,
        panTaxId:             ngosTable.panTaxId,
        legalDescription:     ngosTable.legalDescription,
        website:              ngosTable.website,
        taxExemptionDetails:  ngosTable.taxExemptionDetails,
        verificationStatus:   ngosTable.verificationStatus,
        trustScore:           ngosTable.trustScore,
        verifiedAt:           ngosTable.verifiedAt,
        verifiedBy:           ngosTable.verifiedBy,
        verifierName:         verifierAlias.name,
        rejectionReason:      ngosTable.rejectionReason,
        adminNotes:           ngosTable.adminNotes,
      })
      .from(ngosTable)
      .leftJoin(verifierAlias, eq(verifierAlias.id, ngosTable.verifiedBy))
      .where(eq(ngosTable.id, user.ngoId));

    res.json({ ...publicUser(user), ngo: row ?? null });
    return;
  }

  res.json(GetMeResponse.parse(publicUser(user)));
});

export default router;