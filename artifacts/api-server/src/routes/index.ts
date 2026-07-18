import { Router, type IRouter } from "express";
import healthRouter from "./health";
import profilesRouter from "./profiles";
import sessionsRouter from "./sessions";
import attemptsRouter from "./attempts";
import adminRouter from "./admin";
import seedRouter from "./seed";
import ttsRouter from "./tts";

const router: IRouter = Router();

router.use(healthRouter);
router.use(profilesRouter);
router.use(sessionsRouter);
router.use(attemptsRouter);
router.use(adminRouter);
router.use(seedRouter);
router.use(ttsRouter);

export default router;
