import { Router, query, ListNotificationsQueryParams, ListNotificationsResponse, MarkNotificationReadParams, MarkNotificationReadResponse, authenticate, error } from "../route-common.js";

const router = Router();
router.get("/notifications", authenticate, async (req, res) => {
  const parsed = ListNotificationsQueryParams.safeParse(req.query);
  if (!parsed.success) return error(res, 400, parsed.error.message);
  const rows = await query(
    `SELECT * FROM notifications WHERE user_id = $1 ${parsed.data.unreadOnly ? "AND read = FALSE" : ""} ORDER BY created_at DESC LIMIT 50`,
    [req.auth.sub],
  );
  res.json(ListNotificationsResponse.parse(rows));
});
router.post("/notifications/:id/read", authenticate, async (req, res) => {
  const params = MarkNotificationReadParams.safeParse(req.params);
  if (!params.success) return error(res, 400, params.error.message);
  const [notification] = await query("UPDATE notifications SET read = TRUE WHERE id = $1 AND user_id = $2 RETURNING *", [params.data.id, req.auth.sub]);
  if (!notification) return error(res, 404, "Notification not found");
  res.json(MarkNotificationReadResponse.parse(notification));
});
export default router;
