import { and, count, desc, eq, lte, sql } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { db, companiesTable, usersTable, paymentLogsTable } from "@workspace/db";
import { requirePlatformAdmin, type AuthenticatedRequest } from "../middlewares/auth";

const router: IRouter = Router();

// Aplica o middleware de verificação de administrador
router.use(requirePlatformAdmin);

// GET /api/admin/companies
router.get("/companies", async (req, res) => {
  try {
    const status = req.query.status as string | undefined;
    const rows = await db
      .select()
      .from(companiesTable)
      .where(status ? eq(companiesTable.status, status) : undefined)
      .orderBy(desc(companiesTable.createdAt));
    
    res.json({ items: rows });
  } catch (error) {
    res.status(500).json({ error: "Erro ao listar empresas" });
  }
});

// POST /api/admin/companies/:id/approve
router.post("/companies/:id/approve", async (req, res) => {
  try {
    const companyId = Number(req.params.id);
    const { contractType } = req.body as { contractType: "mensal" | "semestral" };
    const adminUserId = (req as AuthenticatedRequest).userId;

    if (!adminUserId) {
      res.status(401).json({ error: "Utilizador não autenticado" });
      return;
    }

if (contractType !== "mensal" && contractType !== "semestral") {
      res.status(400).json({ error: "contractType deve ser 'mensal' ou 'semestral'" });
      return; // O return deve ficar sozinho numa linha
    }

    const [adminUser] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.clerkUserId, adminUserId))
      .limit(1);

    if (!adminUser) {
      res.status(404).json({ error: "Utilizador administrador não encontrado" });
      return;
    }

    const periodStart = new Date();
    const periodEnd = new Date(periodStart);
    if (contractType === "mensal") {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    } else {
      periodEnd.setMonth(periodEnd.getMonth() + 6);
    }

    await db.transaction(async (tx) => {
      await tx
        .update(companiesTable)
        .set({
          status: "active",
          contractType,
          contractStartDate: periodStart,
          contractEndDate: periodEnd,
        })
        .where(eq(companiesTable.id, companyId));

      await tx.insert(paymentLogsTable).values({
        companyId,
        registeredByUserId: adminUser.id,
        contractType,
        periodStart,
        periodEnd,
      });
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Erro ao aprovar empresa" });
  }
});

// POST /api/admin/companies/:id/block
router.post("/companies/:id/block", async (req, res) => {
  try {
    const companyId = Number(req.params.id);
    await db
      .update(companiesTable)
      .set({ status: "blocked" })
      .where(eq(companiesTable.id, companyId));
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Erro ao bloquear empresa" });
  }
});

// POST /api/admin/companies/:id/pending
router.post("/companies/:id/pending", async (req, res) => {
  try {
    const companyId = Number(req.params.id);
    await db
      .update(companiesTable)
      .set({ status: "pending" })
      .where(eq(companiesTable.id, companyId));
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Erro ao alterar status da empresa para pendente" });
  }
});

// GET /api/admin/companies/:id/payments
router.get("/companies/:id/payments", async (req, res) => {
  try {
    const companyId = Number(req.params.id);
    const rows = await db
      .select()
      .from(paymentLogsTable)
      .where(eq(paymentLogsTable.companyId, companyId))
      .orderBy(desc(paymentLogsTable.createdAt));
    
    res.json({ items: rows });
  } catch (error) {
    res.status(500).json({ error: "Erro ao buscar histórico de pagamentos" });
  }
});

// GET /api/admin/dashboard
router.get("/dashboard", async (_req, res) => {
  try {
    const [stats] = await db
      .select({
        totalCompanies: count(),
        active: count(sql`CASE WHEN ${companiesTable.status} = 'active' THEN 1 END`),
        pending: count(sql`CASE WHEN ${companiesTable.status} = 'pending' THEN 1 END`),
        blocked: count(sql`CASE WHEN ${companiesTable.status} = 'blocked' THEN 1 END`),
      })
      .from(companiesTable);

    const in2days = new Date();
    in2days.setDate(in2days.getDate() + 2);

    const expiringSoon = await db
      .select({
        id: companiesTable.id,
        name: companiesTable.name,
        contractEndDate: companiesTable.contractEndDate,
      })
      .from(companiesTable)
      .where(
        and(
          eq(companiesTable.status, "active"),
          lte(companiesTable.contractEndDate, in2days)
        )
      );

    res.json({
      totalCompanies: stats?.totalCompanies ?? 0,
      active: stats?.active ?? 0,
      pending: stats?.pending ?? 0,
      blocked: stats?.blocked ?? 0,
      expiringSoon,
    });
  } catch (error) {
    res.status(500).json({ error: "Erro ao carregar dados do dashboard" });
  }
});

export default router;