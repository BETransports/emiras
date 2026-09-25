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
import storageRouter from "./storage";
import { requireAuth, requireActiveCompany } from "../middlewares/auth";

const router: IRouter = Router();

// 1. Rotas públicas / utilitárias
router.use(healthRouter);
router.use(storageRouter);

// 2. Middleware de Autenticação Obrigatória para as rotas abaixo
router.use(requireAuth);

// 3. Rotas de Admin (não exigem empresa ativa, mas estão sob /api/admin)
router.use("/api/admin", adminRouter);

// 4. Rotas do Cliente/Empresa (exigem empresa ativa)
router.use(requireActiveCompany);
router.use(dashboardRouter);
router.use(productsRouter);
router.use(categoriesRouter);
router.use(stockRouter);
router.use(customersRouter);
router.use(salesRouter);
router.use(activityRouter);

export default router;