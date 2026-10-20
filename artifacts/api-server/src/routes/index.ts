import { Router, type IRouter } from "express";
import healthRouter from "./health";
import dashboardRouter from "./dashboard";
import staffRouter from "./staff";
import clientsRouter from "./clients";
import engagementsRouter from "./engagements";
import anomaliesRouter from "./anomalies";
import findingsRouter from "./findings";
import workingPapersRouter from "./working-papers";
import dataRoomRouter from "./data-room";
import ledgerUploadsRouter from "./ledger-uploads";
import portalAuthRouter from "./portal-auth";
import auditBinderRouter from "./audit-binder";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/dashboard/summary", dashboardRouter);
router.use("/staff", staffRouter);
router.use("/clients", clientsRouter);
router.use("/engagements", engagementsRouter);
router.use("/anomalies", anomaliesRouter);
router.use("/findings", findingsRouter);
router.use("/working-papers", workingPapersRouter);
router.use("/data-room", dataRoomRouter);
router.use(ledgerUploadsRouter);
router.use(portalAuthRouter);
router.use(auditBinderRouter);

export default router;
