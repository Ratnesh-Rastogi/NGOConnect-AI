import { Router, query, withTransaction, AcceptRequestParams, AcceptRequestResponse, CompleteRequestParams, CompleteRequestResponse, CreateRequestBody, CreateRequestResponse, GetRequestParams, GetRequestResponse, ListRequestsQueryParams, ListRequestsResponse, RejectRequestParams, RejectRequestResponse, authenticate, requireRole, error, dateKey, getNgoName, requestView, transactionView, notify } from "../route-common.js";

const router = Router();

router.get("/requests", authenticate, async (req, res) => {
  const parsed = ListRequestsQueryParams.safeParse(req.query);
  if (!parsed.success) return error(res, 400, parsed.error.message);
  const { direction, status, page, pageSize } = parsed.data;
  const conditions = [];
  const values = [];
  if (req.auth.role === "ngo" && req.auth.ngoId) {
    if (direction === "outgoing") { values.push(req.auth.ngoId); conditions.push(`r.requester_ngo_id = $${values.length}`); }
    if (direction === "incoming") { values.push(req.auth.ngoId); conditions.push(`r.requester_ngo_id <> $${values.length}`); }
  }
  if (status && ["open", "accepted", "rejected", "completed", "cancelled"].includes(status)) { values.push(status); conditions.push(`r.status = $${values.length}`); }
  const whereSql = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const limitIndex = values.length + 1;
  const offsetIndex = values.length + 2;
  const rows = await query(
    `SELECT to_jsonb(r) AS request, n.name AS requester_ngo_name FROM resource_requests r JOIN ngos n ON n.id = r.requester_ngo_id ${whereSql} ORDER BY r.created_at DESC LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
    [...values, pageSize, (page - 1) * pageSize],
  );
  const [countRow] = await query(`SELECT COUNT(*)::int AS total FROM resource_requests r ${whereSql}`, values);
  res.json(ListRequestsResponse.parse({ items: rows.map((row) => requestView(row.request, row.requesterNgoName)), page, pageSize, total: Number(countRow.total) }));
});

router.post("/requests", authenticate, requireRole("ngo"), async (req, res) => {
  const parsed = CreateRequestBody.safeParse(req.body);
  if (!parsed.success) return error(res, 400, parsed.error.message);
  const ngoId = req.auth.ngoId;
  if (!ngoId) return error(res, 400, "An NGO profile is required to create requests");
  const data = parsed.data;
  const requiredDate = dateKey(data.requiredDate);
  if (!requiredDate || requiredDate < new Date().toISOString().slice(0, 10)) return error(res, 400, "Required date cannot be in the past");
  const [request] = await query(
    `INSERT INTO resource_requests (requester_ngo_id, resource_type, category, quantity, urgency, location, required_date, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'open') RETURNING *`,
    [ngoId, data.resourceType, data.category ?? null, data.quantity, data.urgency, data.location, requiredDate],
  );
  const ngoUsers = await query("SELECT id FROM users WHERE role = 'ngo' AND ngo_id <> $1", [ngoId]);
  await Promise.all(ngoUsers.map((user) => notify(user.id, "New resource request", `${data.resourceType} is needed by an NGO in ${data.location}.`, "request_created")));
  res.status(201).json(CreateRequestResponse.parse(requestView(request, await getNgoName(request.requesterNgoId))));
});

router.get("/requests/:id", authenticate, async (req, res) => {
  const params = GetRequestParams.safeParse(req.params);
  if (!params.success) return error(res, 400, params.error.message);
  const [row] = await query("SELECT to_jsonb(r) AS request, n.name AS requester_ngo_name FROM resource_requests r JOIN ngos n ON n.id = r.requester_ngo_id WHERE r.id = $1", [params.data.id]);
  if (!row) return error(res, 404, "Request not found");
  res.json(GetRequestResponse.parse(requestView(row.request, row.requesterNgoName)));
});

router.post("/requests/:id/accept", authenticate, requireRole("ngo", "admin"), async (req, res) => {
  const params = AcceptRequestParams.safeParse(req.params);
  if (!params.success) return error(res, 400, params.error.message);
  try {
    const transaction = await withTransaction(async (tx) => {
      const [request] = await tx("SELECT * FROM resource_requests WHERE id = $1 FOR UPDATE", [params.data.id]);
      if (!request || request.status !== "open") throw new Error("This request is no longer open");
      const resourceValues = [request.requesterNgoId, request.quantity];
      let categorySql = "";
      if (request.category) { resourceValues.push(request.category); categorySql = ` AND category = $${resourceValues.length}`; }
      const [resource] = await tx(
        `SELECT * FROM resources WHERE status = 'available' AND owner_ngo_id <> $1 AND quantity >= $2${categorySql}
         ORDER BY expiry_date ASC NULLS LAST, created_at ASC LIMIT 1 FOR UPDATE`, resourceValues,
      );
      if (!resource) throw new Error("No available resource can fulfill this quantity");
      const remaining = resource.quantity - request.quantity;
      await tx("UPDATE resources SET quantity = $1, status = $2, updated_at = NOW() WHERE id = $3", [remaining, remaining <= 0 ? "depleted" : "reserved", resource.id]);
      const [updatedRequest] = await tx("UPDATE resource_requests SET status = 'accepted', updated_at = NOW() WHERE id = $1 RETURNING *", [request.id]);
      const [createdTransaction] = await tx("INSERT INTO transactions (request_id, resource_id, quantity, status) VALUES ($1,$2,$3,'accepted') RETURNING *", [request.id, resource.id, request.quantity]);
      const [requester] = await tx("SELECT id FROM users WHERE ngo_id = $1 ORDER BY id LIMIT 1", [request.requesterNgoId]);
      if (requester) await tx("INSERT INTO notifications (user_id, title, message, type) VALUES ($1,$2,$3,$4)", [requester.id, "Request accepted", `Your ${request.resourceType} request has been matched to an available resource.`, "request_accepted"]);
      return createdTransaction;
    });
    res.json(AcceptRequestResponse.parse(transactionView(transaction)));
  } catch (cause) {
    error(res, 409, cause instanceof Error ? cause.message : "Request could not be accepted");
  }
});

router.post("/requests/:id/reject", authenticate, requireRole("ngo", "admin"), async (req, res) => {
  const params = RejectRequestParams.safeParse(req.params);
  if (!params.success) return error(res, 400, params.error.message);
  const [request] = await query("UPDATE resource_requests SET status = 'rejected', updated_at = NOW() WHERE id = $1 AND status = 'open' RETURNING *", [params.data.id]);
  if (!request) return error(res, 409, "Only open requests can be rejected");
  const [requester] = await query("SELECT id FROM users WHERE ngo_id = $1 ORDER BY id LIMIT 1", [request.requesterNgoId]);
  if (requester) await notify(requester.id, "Request declined", `Your ${request.resourceType} request was declined.`, "request_rejected");
  res.json(RejectRequestResponse.parse(requestView(request, await getNgoName(request.requesterNgoId))));
});

router.post("/requests/:id/complete", authenticate, requireRole("ngo", "admin"), async (req, res) => {
  const params = CompleteRequestParams.safeParse(req.params);
  if (!params.success) return error(res, 400, params.error.message);
  const transaction = await withTransaction(async (tx) => {
    const [current] = await tx("SELECT * FROM transactions WHERE request_id = $1 FOR UPDATE", [params.data.id]);
    if (!current || current.status !== "accepted") return null;
    const [updated] = await tx("UPDATE transactions SET status = 'completed', updated_at = NOW() WHERE id = $1 RETURNING *", [current.id]);
    const [request] = await tx("UPDATE resource_requests SET status = 'completed', updated_at = NOW() WHERE id = $1 RETURNING *", [params.data.id]);
    const [requester] = await tx("SELECT id FROM users WHERE ngo_id = $1 ORDER BY id LIMIT 1", [request.requesterNgoId]);
    if (requester) await tx("INSERT INTO notifications (user_id, title, message, type) VALUES ($1,$2,$3,$4)", [requester.id, "Transfer completed", "Your requested resources were marked as received.", "transaction_completed"]);
    return updated;
  });
  if (!transaction) return error(res, 409, "Only accepted transactions can be completed");
  res.json(CompleteRequestResponse.parse(transactionView(transaction)));
});

export default router;
