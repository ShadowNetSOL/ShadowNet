import { Router, type IRouter } from "express";
import healthRouter from "./health";
import walletRouter from "./wallet";
import relayRouter from "./relay";
import sessionRouter from "./session";
import intelligenceRouter from "./intelligence";
import proxyRouter from "./proxy";

const router: IRouter = Router();

router.use(healthRouter);
router.use(walletRouter);
router.use(relayRouter);
router.use(sessionRouter);
router.use(intelligenceRouter);
router.use(proxyRouter);

export default router;
