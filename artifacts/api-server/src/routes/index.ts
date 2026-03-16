import { Router, type IRouter } from "express";
import healthRouter from "./health";
import walletRouter from "./wallet";
import relayRouter from "./relay";
import sessionRouter from "./session";

const router: IRouter = Router();

router.use(healthRouter);
router.use(walletRouter);
router.use(relayRouter);
router.use(sessionRouter);

export default router;
