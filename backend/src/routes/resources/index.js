import { Router, query, CreateResourceBody, CreateResourceResponse, DeleteResourceParams, GetResourceParams, GetResourceResponse, ListResourcesQueryParams, ListResourcesResponse, UpdateResourceBody, UpdateResourceParams, UpdateResourceResponse, authenticate, requireRole, error, dateKey, getNgoName, resourceView } from "../route-common.js";

const router = Router();

router.get("/resources", authenticate, async (req, res) => {
  const parsed = ListResourcesQueryParams.safeParse(req.query);
  if (!parsed.success) return error(res, 400, parsed.error.message);
  const { search, category, location, status, page, pageSize } = parsed.data;
  const conditions = [];
  const values = [];
  const add = (sql, value) => { values.push(value); conditions.push(sql.replace("?", `$${values.length}`)); };
  if (search) {
    values.push(`%${search}%`, `%${search}%`);
    const first = values.length - 1;
    conditions.push(`(r.name ILIKE $${first} OR r.description ILIKE $${first + 1})`);
  }
  if (category) add("r.category = ?", category);
  if (location) add("r.location ILIKE ?", `%${location}%`);
  if (status && ["available", "reserved", "depleted", "expired"].includes(status)) add("r.status = ?", status);
  const whereSql = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const limitIndex = values.length + 1;
  const offsetIndex = values.length + 2;
  const rows = await query(
    `SELECT to_jsonb(r) AS resource, n.name AS owner_ngo_name FROM resources r JOIN ngos n ON n.id = r.owner_ngo_id ${whereSql} ORDER BY r.created_at DESC LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
    [...values, pageSize, (page - 1) * pageSize],
  );
  const [countRow] = await query(`SELECT COUNT(*)::int AS total FROM resources r ${whereSql}`, values);
  res.json(ListResourcesResponse.parse({ items: rows.map((row) => resourceView(row.resource, row.ownerNgoName)), page, pageSize, total: Number(countRow.total) }));
});

router.post("/resources", authenticate, requireRole("ngo"), async (req, res) => {
  const parsed = CreateResourceBody.safeParse(req.body);
  if (!parsed.success) return error(res, 400, parsed.error.message);
  const ngoId = req.auth.ngoId;
  if (!ngoId) return error(res, 400, "An NGO profile is required to list resources");
  const data = parsed.data;
  const expiryDate = dateKey(data.expiryDate);
  if (expiryDate && expiryDate < new Date().toISOString().slice(0, 10)) return error(res, 400, "Expiry date cannot be in the past");
  const [resource] = await query(
    `INSERT INTO resources (owner_ngo_id, name, category, description, quantity, unit, location, expiry_date, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [ngoId, data.name, data.category, data.description ?? "", data.quantity, data.unit, data.location, expiryDate, data.status ?? "available"],
  );
  res.status(201).json(CreateResourceResponse.parse(resourceView(resource, await getNgoName(resource.ownerNgoId))));
});

router.get("/resources/:id", authenticate, async (req, res) => {
  const params = GetResourceParams.safeParse(req.params);
  if (!params.success) return error(res, 400, params.error.message);
  const [row] = await query("SELECT to_jsonb(r) AS resource, n.name AS owner_ngo_name FROM resources r JOIN ngos n ON n.id = r.owner_ngo_id WHERE r.id = $1", [params.data.id]);
  if (!row) return error(res, 404, "Resource not found");
  res.json(GetResourceResponse.parse(resourceView(row.resource, row.ownerNgoName)));
});

router.patch("/resources/:id", authenticate, requireRole("ngo"), async (req, res) => {
  const params = UpdateResourceParams.safeParse(req.params);
  const parsed = UpdateResourceBody.safeParse(req.body);
  if (!params.success) return error(res, 400, params.error.message);
  if (!parsed.success) return error(res, 400, parsed.error.message);
  const [existing] = await query("SELECT * FROM resources WHERE id = $1", [params.data.id]);
  if (!existing || existing.ownerNgoId !== req.auth.ngoId) return error(res, 404, "Resource not found");
  const expiryDate = dateKey(parsed.data.expiryDate);
  if (expiryDate && expiryDate < new Date().toISOString().slice(0, 10)) return error(res, 400, "Expiry date cannot be in the past");
  const allowed = { name: "name", category: "category", description: "description", quantity: "quantity", unit: "unit", location: "location", expiryDate: "expiry_date", status: "status" };
  const values = [];
  const sets = [];
  for (const [key, column] of Object.entries(allowed)) {
    if (Object.hasOwn(parsed.data, key)) {
      values.push(key === "expiryDate" ? expiryDate : parsed.data[key]);
      sets.push(`${column} = $${values.length}`);
    }
  }
  if (!sets.length) return res.json(UpdateResourceResponse.parse(resourceView(existing, await getNgoName(existing.ownerNgoId))));
  values.push(new Date()); sets.push(`updated_at = $${values.length}`);
  values.push(params.data.id); const idIndex = values.length;
  const [resource] = await query(`UPDATE resources SET ${sets.join(", ")} WHERE id = $${idIndex} RETURNING *`, values);
  res.json(UpdateResourceResponse.parse(resourceView(resource, await getNgoName(resource.ownerNgoId))));
});

router.delete("/resources/:id", authenticate, requireRole("ngo"), async (req, res) => {
  const params = DeleteResourceParams.safeParse(req.params);
  if (!params.success) return error(res, 400, params.error.message);
  const [existing] = await query("SELECT * FROM resources WHERE id = $1", [params.data.id]);
  if (!existing || existing.ownerNgoId !== req.auth.ngoId) return error(res, 404, "Resource not found");
  await query("DELETE FROM resources WHERE id = $1", [params.data.id]);
  res.sendStatus(204);
});

export default router;
