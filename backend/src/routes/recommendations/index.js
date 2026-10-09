import { Router, query, ListRecommendationsResponse, authenticate, requireRole, resourceView, requestView } from "../route-common.js";

const router = Router();
router.get("/recommendations", authenticate, requireRole("ngo"), async (req, res) => {
  const ngoId = req.auth.ngoId;
  if (!ngoId) return res.json([]);
  const openRequests = await query(
    `SELECT to_jsonb(r) AS request, n.name AS requester_ngo_name
     FROM resource_requests r JOIN ngos n ON n.id = r.requester_ngo_id
     WHERE r.requester_ngo_id = $1 AND r.status = 'open' LIMIT 20`, [ngoId]);
  const resources = await query(
    `SELECT to_jsonb(r) AS resource, n.name AS owner_ngo_name, n.trust_score
     FROM resources r JOIN ngos n ON n.id = r.owner_ngo_id
     WHERE r.status = 'available' AND r.owner_ngo_id <> $1 LIMIT 100`, [ngoId]);
  const results = [];
  for (const reqRow of openRequests) {
    for (const resourceRow of resources) {
      if (resourceRow.resource.expiryDate && resourceRow.resource.expiryDate < new Date().toISOString().slice(0, 10)) continue;
      if (resourceRow.resource.quantity < reqRow.request.quantity) continue;
      let score = 0;
      const reasons = [];
      if (reqRow.request.category && reqRow.request.category === resourceRow.resource.category) {
        score += 40;
        reasons.push("Category matches the request.");
      } else if (reqRow.request.resourceType.toLowerCase() === resourceRow.resource.name.toLowerCase()) {
        score += 40;
        reasons.push("Resource type matches the request.");
      } else continue;
      score += 25;
      reasons.push("Available quantity covers the requested amount.");
      if (reqRow.request.location.toLowerCase() === resourceRow.resource.location.toLowerCase()) {
        score += 10;
        reasons.push("Locations match exactly; no distance was fabricated.");
      } else reasons.push("Distance is unavailable, so no distance points were added.");
      score += Math.min(20, Math.round((reqRow.request.quantity / resourceRow.resource.quantity) * 20));
      reasons.push("Quantity fit favors a focused allocation.");
      score += Math.round(Math.max(0, Math.min(5, resourceRow.trustScore / 20)));
      reasons.push(`Application-generated trust score contributed ${Math.round(resourceRow.trustScore / 20)} points.`);
      results.push({
        resource: resourceView(resourceRow.resource, resourceRow.ownerNgoName),
        request: requestView(reqRow.request, reqRow.requesterNgoName),
        score: Math.min(100, score), reasons,
      });
    }
  }
  results.sort((a, b) => b.score - a.score);
  res.json(ListRecommendationsResponse.parse(results.slice(0, 20)));
});
export default router;
