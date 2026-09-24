import { and, count, desc, eq, gte, lte, sql } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { db, companiesTable, usersTable, paymentLogsTable, salesTable, productsTable } from "@workspace/db";
import { requirePlatformAdmin, type AuthenticatedRequest } from "../middlewares/auth";

const router: IRouter = Router();

router.use(requirePlatformAdmin);

// Lista empresas, filtrável por status: /api/admin/companies?status=pending
router.get("/api/admin/companies", async (req, res) => {
  const status = req.query.status as string | undefined;
  const rows = await db
    .select()
    .from(companiesTable)
    .where(status ? eq(companiesTable.status, status) : undefined)
    .orderBy(desc(companiesTable.createdAt));
  res.json({ items: rows });
});

// Aprovar e marcar como paga, definindo o contrato
router.post("/api/admin/companies/:id/approve", async (req, res) => {
  const companyId = Number(req.params.id);
  const { contractType } = req.body as { contractType: "mensal" | "semestral" };
  const adminUserId = (req as AuthenticatedRequest).userId;

  if (contractType !== "mensal" && contractType !== "semestral") {
    res.status(400).json({ error: "contractType deve ser 'mensal' ou 'semestral'" });
    return;
  }

  const periodStart = new Date();
  const periodEnd = new Date(periodStart);
  if (contractType === "mensal") periodEnd.setMonth(periodEnd.getMonth() + 1);
  else periodEnd.setMonth(periodEnd.getMonth() + 6);

  const [adminUser] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.clerkUserId, adminUserId))
    .limit(1);

  await db
    .update(companiesTable)
    .set({
      status: "active",
      contractType,
      contractStartDate: periodStart,
      contractEndDate: periodEnd,
    })
    .where(eq(companiesTable.id, companyId));

  await db.insert(paymentLogsTable).values({
    companyId,
    registeredByUserId: adminUser.id,
    contractType,
    periodStart,
    periodEnd,
  });

  res.json({ success: true });
});

// Bloquear (nega ou revoga acesso)
router.post("/api/admin/companies/:id/block", async (req, res) => {
  const companyId = Number(req.params.id);
  await db.update(companiesTable).set({ status: "blocked" }).where(eq(companiesTable.id, companyId));
  res.json({ success: true });
});

// Deixar em espera de novo (ex.: desfazer bloqueio sem aprovar)
router.post("/api/admin/companies/:id/pending", async (req, res) => {
  const companyId = Number(req.params.id);
  await db.update(companiesTable).set({ status: "pending" }).where(eq(companiesTable.id, companyId));
  res.json({ success: true });
});

// Histórico de pagamentos de uma empresa
router.get("/api/admin/companies/:id/payments", async (req, res) => {
  const companyId = Number(req.params.id);
  const rows = await db
    .select()
    .from(paymentLogsTable)
    .where(eq(paymentLogsTable.companyId, companyId))
    .orderBy(desc(paymentLogsTable.createdAt));
  res.json({ items: rows });
});

// Métricas gerais do admin
router.get("/api/admin/dashboard", async (_req, res) => {
  const [totals] = await db
    .select({
      total: count(),
    })
    .from(companiesTable);

  const [activeCount] = await db
    .select({ total: count() })
    .from(companiesTable)
    .where(eq(companiesTable.status, "active"));

  const [pendingCount] = await db
    .select({ total: count() })
    .from(companiesTable)
    .where(eq(companiesTable.status, "pending"));

  const [blockedCount] = await db
    .select({ total: count() })
    .from(companiesTable)
    .where(eq(companiesTable.status, "blocked"));

  const in2days = new Date();
  in2days.setDate(in2days.getDate() + 2);

  const expiringSoon = await db
    .select({ id: companiesTable.id, name: companiesTable.name, contractEndDate: companiesTable.contractEndDate })
    .from(companiesTable)
    .where(and(eq(companiesTable.status, "active"), lte(companiesTable.contractEndDate, in2days)));

  res.json({
    totalCompanies: totals.total,
    active: activeCount.total,
    pending: pendingCount.total,
    blocked: blockedCount.total,
    expiringSoon,
  });
});

export default router;
