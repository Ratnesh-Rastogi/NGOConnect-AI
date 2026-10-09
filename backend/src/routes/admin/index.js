import { Router, query, GetAdminStatsResponse, ListNgosResponse, VerifyNgoBody, VerifyNgoParams, VerifyNgoResponse, authenticate, requireRole, error } from "../route-common.js";

const router = Router();

router.get("/admin/stats", authenticate, requireRole("admin"), async (_req, res) => {
  const [users] = await query("SELECT COUNT(*)::int AS value FROM users");
  const [ngos] = await query("SELECT COUNT(*)::int AS value FROM ngos");
  const [verifiedNgos] = await query("SELECT COUNT(*)::int AS value FROM ngos WHERE verification_status = 'verified'");
  const [resources] = await query("SELECT COUNT(*)::int AS value FROM resources");
  const [openRequests] = await query("SELECT COUNT(*)::int AS value FROM resource_requests WHERE status = 'open'");
  const [activeTransactions] = await query("SELECT COUNT(*)::int AS value FROM transactions WHERE status = ANY($1::transaction_status[])", [["pending", "accepted"]]);
  res.json(GetAdminStatsResponse.parse({ users: users.value, ngos: ngos.value, verifiedNgos: verifiedNgos.value, resources: resources.value, openRequests: openRequests.value, activeTransactions: activeTransactions.value }));
});

router.get("/admin/ngos", authenticate, requireRole("admin"), async (_req, res) => {
  const rows = await query("SELECT n.*, verifier.name AS verifier_name FROM ngos n LEFT JOIN users verifier ON verifier.id = n.verified_by ORDER BY n.created_at DESC");
  res.json(ListNgosResponse.parse(rows));
});

router.post("/admin/ngos/:id/verify", authenticate, requireRole("admin"), async (req, res) => {
  const params = VerifyNgoParams.safeParse(req.params);
  const parsed = VerifyNgoBody.safeParse(req.body);
  if (!params.success) return error(res, 400, params.error.message);
  if (!parsed.success) return error(res, 400, parsed.error.message);
  const [ngo] = await query(
    "UPDATE ngos SET verification_status = $1, updated_at = NOW() WHERE id = $2 RETURNING *",
    [parsed.data.status, params.data.id],
  );
  if (!ngo) return error(res, 404, "NGO not found");
  const [result] = await query("SELECT n.*, verifier.name AS verifier_name FROM ngos n LEFT JOIN users verifier ON verifier.id = n.verified_by WHERE n.id = $1", [ngo.id]);
  res.json(VerifyNgoResponse.parse(result));
});

export default router;
