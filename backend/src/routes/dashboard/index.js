import { Router, query, GetDashboardResponse, authenticate, resourceView, requestView, transactionView } from "../route-common.js";

const router = Router();
router.get("/dashboard", authenticate, async (req, res) => {
  const userNgoId = req.auth.ngoId;
  const isAdmin = req.auth.role === "admin";
  const [resourceCount] = await query(isAdmin ? "SELECT COUNT(*)::int AS count FROM resources" : "SELECT COUNT(*)::int AS count FROM resources WHERE owner_ngo_id = $1", isAdmin ? [] : [userNgoId]);
  const [requestCount] = await query(isAdmin ? "SELECT COUNT(*)::int AS count FROM resource_requests" : "SELECT COUNT(*)::int AS count FROM resource_requests WHERE requester_ngo_id = $1", isAdmin ? [] : [userNgoId]);
  const [transactionCount] = await query("SELECT COUNT(*)::int AS count FROM transactions");
  const [unreadCount] = await query("SELECT COUNT(*)::int AS count FROM notifications WHERE user_id = $1 AND read = FALSE", [req.auth.sub]);
  const recentResources = await query(
    `SELECT to_jsonb(r) AS resource, n.name AS owner_ngo_name
     FROM resources r JOIN ngos n ON n.id = r.owner_ngo_id
     ${req.auth.role === "ngo" ? "WHERE r.owner_ngo_id = $1" : ""}
     ORDER BY r.created_at DESC LIMIT 5`,
    req.auth.role === "ngo" ? [userNgoId] : [],
  );
  const recentRequests = await query(
    `SELECT to_jsonb(r) AS request, n.name AS requester_ngo_name
     FROM resource_requests r JOIN ngos n ON n.id = r.requester_ngo_id
     ${req.auth.role === "ngo" ? "WHERE r.requester_ngo_id = $1" : ""}
     ORDER BY r.created_at DESC LIMIT 5`,
    req.auth.role === "ngo" ? [userNgoId] : [],
  );
  const recentTransactions = await query("SELECT * FROM transactions ORDER BY created_at DESC LIMIT 5");
  res.json(GetDashboardResponse.parse({
    role: req.auth.role,
    counts: { resources: Number(resourceCount.count), requests: Number(requestCount.count), transactions: Number(transactionCount.count) },
    recentResources: recentResources.map((row) => resourceView(row.resource, row.ownerNgoName)),
    recentRequests: recentRequests.map((row) => requestView(row.request, row.requesterNgoName)),
    recentTransactions: recentTransactions.map(transactionView),
    unreadNotifications: Number(unreadCount.count),
  }));
});
export default router;
