import { Router } from "express";

import authRouter from "./auth";
import resourcesRouter from "./resources";
import requestsRouter from "./requests";
import transactionsRouter from "./transactions";
import notificationsRouter from "./notifications";
import recommendationsRouter from "./recommendations";
import dashboardRouter from "./dashboard";
import adminRouter from "./admin";

const router = Router();

router.use(authRouter);
router.use(resourcesRouter);
router.use(requestsRouter);
router.use(transactionsRouter);
router.use(notificationsRouter);
router.use(recommendationsRouter);
router.use(dashboardRouter);
router.use(adminRouter);

export default router;
