import { Router, query, withTransaction, publicUser, GetMeResponse, LoginBody, LoginResponse, RegisterBody, RegisterResponse, comparePassword, hashPassword, signToken, authenticate, error } from "../route-common.js";

const router = Router();

router.post("/auth/register", async (req, res) => {
  const parsed = RegisterBody.safeParse(req.body);
  if (!parsed.success) return error(res, 400, parsed.error.message);

  const data = parsed.data;
  const email = data.email.trim().toLowerCase();
  const [existing] = await query("SELECT id FROM users WHERE email = $1", [email]);
  if (existing) return error(res, 409, "An account with that email already exists");

  let ngoFields = null;
  if (data.role === "ngo") {
    ngoFields = {
      address: String(req.body.address ?? "").trim(),
      state: String(req.body.state ?? "").trim(),
      city: String(req.body.city ?? "").trim(),
      pincode: String(req.body.pincode ?? "").trim(),
      registrationNumber: String(req.body.registrationNumber ?? "").trim(),
      panTaxId: String(req.body.panTaxId ?? "").trim(),
      legalDescription: String(req.body.legalDescription ?? "").trim(),
    };
    const missing = Object.entries(ngoFields).filter(([, value]) => value === "").map(([key]) => key);
    if (missing.length) return error(res, 400, `Missing required NGO fields: ${missing.join(", ")}`);
  }

  const passwordHash = await hashPassword(data.password);
  const user = await withTransaction(async (tx) => {
    let ngoId = null;
    if (ngoFields) {
      const [ngo] = await tx(
        `INSERT INTO ngos (name, contact_email, phone, location, description, address, state, city, pincode, registration_number, pan_tax_id, legal_description)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id`,
        [data.ngoName?.trim() || data.name.trim(), email, data.phone ?? null, `${ngoFields.city}, ${ngoFields.state}`, "New NGO profile awaiting verification.", ngoFields.address, ngoFields.state, ngoFields.city, ngoFields.pincode, ngoFields.registrationNumber, ngoFields.panTaxId, ngoFields.legalDescription],
      );
      ngoId = ngo.id;
    }
    const [createdUser] = await tx(
      `INSERT INTO users (email, password_hash, name, role, ngo_id, phone)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [email, passwordHash, data.name.trim(), data.role, ngoId, data.phone ?? null],
    );
    return createdUser;
  });

  res.status(201).json(RegisterResponse.parse({
    token: signToken({ sub: user.id, role: user.role, ngoId: user.ngoId }),
    user: publicUser(user),
  }));
});

router.post("/auth/login", async (req, res) => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) return error(res, 400, parsed.error.message);
  const email = parsed.data.email.trim().toLowerCase();
  const [user] = await query("SELECT * FROM users WHERE email = $1", [email]);
  if (!user || !(await comparePassword(parsed.data.password, user.passwordHash))) {
    return error(res, 401, "Email or password is incorrect");
  }
  res.json(LoginResponse.parse({
    token: signToken({ sub: user.id, role: user.role, ngoId: user.ngoId }),
    user: publicUser(user),
  }));
});

router.post("/auth/logout", authenticate, (_req, res) => res.sendStatus(204));

router.get("/auth/me", authenticate, async (req, res) => {
  const [user] = await query("SELECT * FROM users WHERE id = $1", [req.auth.sub]);
  if (!user) return error(res, 401, "User account no longer exists");

  if (user.role === "ngo" && user.ngoId != null) {
    const [ngo] = await query(
      `SELECT n.id, n.name, n.contact_email, n.phone, n.address, n.state, n.city, n.pincode,
              n.registration_number, n.pan_tax_id, n.legal_description, n.website, n.tax_exemption_details,
              n.verification_status, n.trust_score, n.verified_at, n.verified_by, verifier.name AS verifier_name,
              n.rejection_reason, n.admin_notes
       FROM ngos n LEFT JOIN users verifier ON verifier.id = n.verified_by WHERE n.id = $1`,
      [user.ngoId],
    );
    res.json({ ...publicUser(user), ngo: ngo ?? null });
    return;
  }
  res.json(GetMeResponse.parse(publicUser(user)));
});

export default router;
