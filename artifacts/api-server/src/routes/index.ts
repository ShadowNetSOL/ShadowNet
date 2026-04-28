import { Router, type IRouter } from "express";
import healthRouter from "./health";
import relayRouter from "./relay";
import sessionRouter from "./session";
import intelligenceRouter from "./intelligence";
import proxyRouter from "./proxy";
import relayVerifyRouter from "./relayVerify";
import pumpTokensRouter from "./pumpTokens";

const router: IRouter = Router();

router.use(healthRouter);
router.use(relayRouter);
router.use(sessionRouter);
router.use(intelligenceRouter);
router.use(proxyRouter);
router.use(relayVerifyRouter);
router.use(pumpTokensRouter);

export default router;
