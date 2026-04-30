import { Router, type IRouter } from "express";
import healthRouter from "./health";
import relayRouter from "./relay";
import sessionRouter from "./session";
import intelligenceRouter from "./intelligence";
import relayVerifyRouter from "./relayVerify";
import pumpTokensRouter from "./pumpTokens";
import orchestratorRouter from "./orchestrator";
import stallReportRouter from "./stallReport";
import authRouter from "./auth";
import adminRouter from "./admin";
import tradingRouter from "./trading";

const router: IRouter = Router();

router.use(healthRouter);
router.use(relayRouter);
router.use(sessionRouter);
router.use(orchestratorRouter);
router.use(stallReportRouter);
router.use(authRouter);
router.use(adminRouter);
router.use(intelligenceRouter);
router.use(relayVerifyRouter);
router.use(pumpTokensRouter);
router.use(tradingRouter);

export default router;
