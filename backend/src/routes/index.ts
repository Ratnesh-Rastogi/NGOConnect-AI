import { Router, type IRouter } from "express";
import healthRouter from "./health";
import ngoRouter from "./ngo";

const router: IRouter = Router();

router.use(healthRouter);
router.use(ngoRouter);

export default router;
