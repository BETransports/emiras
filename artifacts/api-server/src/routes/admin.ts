import { and, count, desc, eq, lte, sql } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  db,
  companiesTable,
  usersTable,
  paymentLogsTable,
  productsTable,
  salesTable,
  notificationsTable,
} from "@workspace/db";
import { requirePlatformAdmin, type AuthenticatedRequest } from "../middlewares/auth";

const router: IRouter = Router();

router.use(requirePlatformAdmin);

// GET /api/admin/companies?status=pending|active|blocked (omitido = todas)
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

// GET /api/admin/companies/:id — detalhe de uma empresa (nº de utilizadores, etc.)
router.get("/companies/:id", async (req, res) => {
  try {
    const companyId = Number(req.params.id);
    const [company] = await db.select().from(companiesTable).where(eq(companiesTable.id, companyId)).limit(1);
    if (!company) {
      res.status(404).json({ error: "Empresa não encontrada" });
      return;
    }
    const [userCount] = await db.select({ total: count() }).from(usersTable).where(eq(usersTable.companyId, companyId));
    const [productCount] = await db.select({ total: count() }).from(productsTable).where(eq(productsTable.companyId, companyId));
    const [salesStats] = await db
      .select({ total: sql<number>`coalesce(sum(${salesTable.total}), 0)`, count: count() })
      .from(salesTable)
      .where(eq(salesTable.companyId, companyId));

    res.json({
      ...company,
      userCount: userCount?.total ?? 0,
      productCount: productCount?.total ?? 0,
      totalSales: salesStats?.total ?? 0,
      salesCount: salesStats?.count ?? 0,
    });
  } catch (error) {
    res.status(500).json({ error: "Erro ao obter detalhe da empresa" });
  }
});

// POST /api/admin/companies/:id/approve
router.post("/companies/:id/approve", async (req, res) => {
  try {
    const companyId = Number(req.params.id);
    const { contractType } = req.body as { contractType: "mensal" | "semestral" };
    const adminUserId = (req as unknown as AuthenticatedRequest).userId;

    if (!adminUserId) {
      res.status(401).json({ error: "Utilizador não autenticado" });
      return;
    }

    if (contractType !== "mensal" && contractType !== "semestral") {
      res.status(400).json({ error: "contractType deve ser 'mensal' ou 'semestral'" });
      return;
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

    await db
      .update(companiesTable)
      .set({ status: "active", contractType, contractStartDate: periodStart, contractEndDate: periodEnd })
      .where(eq(companiesTable.id, companyId));

    await db.insert(paymentLogsTable).values({
      companyId,
      registeredByUserId: adminUser.id,
      contractType,
      periodStart,
      periodEnd,
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
    await db.update(companiesTable).set({ status: "blocked" }).where(eq(companiesTable.id, companyId));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Erro ao bloquear empresa" });
  }
});

// POST /api/admin/companies/:id/pending
router.post("/companies/:id/pending", async (req, res) => {
  try {
    const companyId = Number(req.params.id);
    await db.update(companiesTable).set({ status: "pending" }).where(eq(companiesTable.id, companyId));
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

// GET /api/admin/companies/:id/products — moderação de produtos
router.get("/companies/:id/products", async (req, res) => {
  try {
    const companyId = Number(req.params.id);
    const rows = await db
      .select()
      .from(productsTable)
      .where(eq(productsTable.companyId, companyId))
      .orderBy(desc(productsTable.createdAt));
    res.json({ items: rows });
  } catch (error) {
    res.status(500).json({ error: "Erro ao listar produtos" });
  }
});

// POST /api/admin/products/:productId/block — bloqueia e desactiva o produto
router.post("/products/:productId/block", async (req, res) => {
  try {
    const productId = Number(req.params.productId);
    await db.update(productsTable).set({ blockedByAdmin: 1, active: 0 }).where(eq(productsTable.id, productId));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Erro ao bloquear produto" });
  }
});

// POST /api/admin/products/:productId/unblock
router.post("/products/:productId/unblock", async (req, res) => {
  try {
    const productId = Number(req.params.productId);
    await db.update(productsTable).set({ blockedByAdmin: 0 }).where(eq(productsTable.id, productId));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Erro ao desbloquear produto" });
  }
});

// DELETE /api/admin/products/:productId — remoção definitiva (venda ilícita, etc.)
router.delete("/products/:productId", async (req, res) => {
  try {
    const productId = Number(req.params.productId);
    await db.delete(productsTable).where(eq(productsTable.id, productId));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Erro ao remover produto" });
  }
});

// POST /api/admin/notifications — notificar uma empresa (companyId) ou todas (companyId: null)
router.post("/notifications", async (req, res) => {
  try {
    const { companyId, title, message } = req.body as {
      companyId: number | null;
      title: string;
      message: string;
    };
    if (!title?.trim() || !message?.trim()) {
      res.status(400).json({ error: "Título e mensagem são obrigatórios" });
      return;
    }
    await db.insert(notificationsTable).values({
      companyId: companyId ?? null,
      title: title.trim(),
      message: message.trim(),
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Erro ao enviar notificação" });
  }
});

// GET /api/admin/dashboard — métricas gerais + top vendedores
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

    const [userTotal] = await db.select({ total: count() }).from(usersTable);

    const in2days = new Date();
    in2days.setDate(in2days.getDate() + 2);

    const expiringSoon = await db
      .select({ id: companiesTable.id, name: companiesTable.name, contractEndDate: companiesTable.contractEndDate })
      .from(companiesTable)
      .where(and(eq(companiesTable.status, "active"), lte(companiesTable.contractEndDate, in2days)));

    const topSellers = await db
      .select({
        companyId: salesTable.companyId,
        companyName: companiesTable.name,
        total: sql<number>`sum(${salesTable.total})`,
        salesCount: count(salesTable.id),
      })
      .from(salesTable)
      .innerJoin(companiesTable, eq(salesTable.companyId, companiesTable.id))
      .groupBy(salesTable.companyId, companiesTable.name)
      .orderBy(desc(sql`sum(${salesTable.total})`))
      .limit(5);

    res.json({
      totalCompanies: stats?.totalCompanies ?? 0,
      totalUsers: userTotal?.total ?? 0,
      active: stats?.active ?? 0,
      pending: stats?.pending ?? 0,
      blocked: stats?.blocked ?? 0,
      expiringSoon,
      topSellers,
    });
  } catch (error) {
    res.status(500).json({ error: "Erro ao carregar dados do dashboard" });
  }
});

export default router;