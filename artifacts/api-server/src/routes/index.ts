import { Router, type IRouter } from "express";
import healthRouter from "./health";
import dashboardRouter from "./dashboard";
import productsRouter from "./products";
import categoriesRouter from "./categories";
import stockRouter from "./stock";
import customersRouter from "./customers";
import salesRouter from "./sales";
import activityRouter from "./activity";
import adminRouter from "./admin";
import { requireAuth, requireActiveCompany } from "../middlewares/auth";
import storageRouter from "./storage";

const router: IRouter = Router();

router.use(healthRouter);
router.use(storageRouter);
router.use(requireAuth);

// Rotas do admin: não exigem empresa activa (o próprio admin aprova empresas)
router.use(adminRouter);

// Rotas normais: só liberadas se a empresa estiver activa
router.use(requireActiveCompany);
router.use(dashboardRouter);
router.use(productsRouter);
router.use(categoriesRouter);
router.use(stockRouter);
router.use(customersRouter);
router.use(salesRouter);
router.use(activityRouter);

export default router;
