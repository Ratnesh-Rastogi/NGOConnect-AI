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

router.get("/recommendations", authenticate, requireRole("ngo"), async (req, res): Promise<void> => {
  const ngoId = req.auth!.ngoId;
  if (!ngoId) {
    res.json([]);
    return;
  }
  const openRequests = await db.select({ request: requestsTable, requesterNgoName: ngosTable.name }).from(requestsTable).innerJoin(ngosTable, eq(requestsTable.requesterNgoId, ngosTable.id)).where(and(eq(requestsTable.requesterNgoId, ngoId), eq(requestsTable.status, "open"))).limit(20);
  const resources = await db.select({ resource: resourcesTable, ownerNgoName: ngosTable.name, trustScore: ngosTable.trustScore }).from(resourcesTable).innerJoin(ngosTable, eq(resourcesTable.ownerNgoId, ngosTable.id)).where(and(eq(resourcesTable.status, "available"), ne(resourcesTable.ownerNgoId, ngoId))).limit(100);
  const results = [];
  for (const reqRow of openRequests) {
    for (const resourceRow of resources) {
      if (resourceRow.resource.expiryDate && resourceRow.resource.expiryDate < new Date().toISOString().slice(0, 10)) continue;
      if (resourceRow.resource.quantity < reqRow.request.quantity) continue;
      let score = 0;
      const reasons: string[] = [];
      if (reqRow.request.category && reqRow.request.category === resourceRow.resource.category) {
        score += 40;
        reasons.push("Category matches the request.");
      } else if (reqRow.request.resourceType.toLowerCase() === resourceRow.resource.name.toLowerCase()) {
        score += 40;
        reasons.push("Resource type matches the request.");
      } else {
        continue;
      }
      score += 25;
      reasons.push("Available quantity covers the requested amount.");
      if (reqRow.request.location.toLowerCase() === resourceRow.resource.location.toLowerCase()) {
        score += 10;
        reasons.push("Locations match exactly; no distance was fabricated.");
      } else {
        reasons.push("Distance is unavailable, so no distance points were added.");
      }
      score += Math.min(20, Math.round((reqRow.request.quantity / resourceRow.resource.quantity) * 20));
      reasons.push("Quantity fit favors a focused allocation.");
      score += Math.round(Math.max(0, Math.min(5, resourceRow.trustScore / 20)));
      reasons.push(`Application-generated trust score contributed ${Math.round(resourceRow.trustScore / 20)} points.`);
      results.push({
        resource: resourceView(resourceRow.resource, resourceRow.ownerNgoName),
        request: requestView(reqRow.request, reqRow.requesterNgoName),
        score: Math.min(100, score),
        reasons,
      });
    }
  }
  results.sort((a, b) => b.score - a.score);
  res.json(ListRecommendationsResponse.parse(results.slice(0, 20)));
});

export default router;
