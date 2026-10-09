import { Router } from "express";
import healthRouter from "./health.js";
import ngoRouter from "./ngo.js";
const router = Router();
router.use(healthRouter);
router.use(ngoRouter);
export default router;
