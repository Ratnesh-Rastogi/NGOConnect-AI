import { Router, query, ListTransactionsQueryParams, ListTransactionsResponse, authenticate, error, transactionView } from "../route-common.js";

const router = Router();
router.get("/transactions", authenticate, async (req, res) => {
  const parsed = ListTransactionsQueryParams.safeParse(req.query);
  if (!parsed.success) return error(res, 400, parsed.error.message);
  const { status, page, pageSize } = parsed.data;
  const conditions = [];
  const values = [];
  if (status && ["pending", "accepted", "completed", "cancelled"].includes(status)) {
    values.push(status);
    conditions.push(`t.status = $${values.length}`);
  }
  if (req.auth.role === "ngo" && req.auth.ngoId) {
    values.push(req.auth.ngoId);
    const idx = values.length;
    conditions.push(`(r.owner_ngo_id = $${idx} OR q.requester_ngo_id = $${idx})`);
  }
  const whereSql = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const limitIndex = values.length + 1;
  const offsetIndex = values.length + 2;
  const rows = await query(
    `SELECT to_jsonb(t) AS transaction FROM transactions t
     JOIN resources r ON r.id = t.resource_id
     JOIN resource_requests q ON q.id = t.request_id
     ${whereSql} ORDER BY t.created_at DESC LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
    [...values, pageSize, (page - 1) * pageSize],
  );
  const [countRow] = await query(
    `SELECT COUNT(*)::int AS total FROM transactions t
     JOIN resources r ON r.id = t.resource_id
     JOIN resource_requests q ON q.id = t.request_id ${whereSql}`,
    values,
  );
  res.json(ListTransactionsResponse.parse({ items: rows.map((row) => transactionView(row.transaction)), page, pageSize, total: Number(countRow.total) }));
});
export default router;
