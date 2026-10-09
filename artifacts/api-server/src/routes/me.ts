import { desc, eq, isNull, or } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { db, companiesTable, usersTable, paymentLogsTable, notificationsTable } from "@workspace/db";
import { getCompanyId, type AuthenticatedRequest } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/me", async (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const companyId = getCompanyId(req);

  const [company] = await db
    .select()
    .from(companiesTable)
    .where(eq(companiesTable.id, companyId))
    .limit(1);

  const [user] = await db
    .select({ name: usersTable.name, role: usersTable.role })
    .from(usersTable)
    .where(eq(usersTable.clerkUserId, authReq.userId))
    .limit(1);

  res.json({
    userId: authReq.userId,
    name: user?.name ?? "",
    role: user?.role ?? "ADMIN",
    isPlatformAdmin: authReq.isPlatformAdmin,
    company: company
      ? {
          id: company.id,
          name: company.name,
          currency: company.currency,
          status: company.status,
          contractType: company.contractType,
          contractStartDate: company.contractStartDate,
          contractEndDate: company.contractEndDate,
        }
      : null,
  });
});

router.patch("/company", async (req, res) => {
  const companyId = getCompanyId(req);
  const { name, currency } = req.body as { name?: string; currency?: string };

  await db
    .update(companiesTable)
    .set({
      ...(name ? { name } : {}),
      ...(currency ? { currency } : {}),
    })
    .where(eq(companiesTable.id, companyId));

  res.json({ success: true });
});

// Histórico de pagamentos da própria empresa
router.get("/payments", async (req, res) => {
  const companyId = getCompanyId(req);
  const rows = await db
    .select()
    .from(paymentLogsTable)
    .where(eq(paymentLogsTable.companyId, companyId))
    .orderBy(desc(paymentLogsTable.createdAt));
  res.json({ items: rows });
});

// Notificações da própria empresa + comunicados gerais (companyId null)
router.get("/notifications", async (req, res) => {
  const companyId = getCompanyId(req);
  const rows = await db
    .select()
    .from(notificationsTable)
    .where(or(eq(notificationsTable.companyId, companyId), isNull(notificationsTable.companyId)))
    .orderBy(desc(notificationsTable.createdAt))
    .limit(20);
  res.json({ items: rows });
});

export default router;