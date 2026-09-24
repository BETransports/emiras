import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { db, customersTable, salesTable } from "@workspace/db";
import {
  CreateCustomerBody,
  CreateCustomerResponse,
  ListCustomersQueryParams,
  ListCustomersResponse,
} from "@workspace/api-zod";
import { getCompanyId } from "../middlewares/auth";
import { customerResponse } from "./helpers";

const router: IRouter = Router();

router.get("/customers", async (req, res): Promise<void> => {
  const parsed = ListCustomersQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Filtros de clientes inválidos" });
    return;
  }
  const { search, page, pageSize } = parsed.data;
  const companyId = getCompanyId(req);
  const conditions = [eq(customersTable.companyId, companyId)];
  if (search) conditions.push(or(
    ilike(customersTable.name, `%${search}%`),
    ilike(customersTable.phone, `%${search}%`),
    ilike(customersTable.email, `%${search}%`),
  ) as typeof conditions[number]);
  const rows = await db.select().from(customersTable).where(and(...conditions))
    .orderBy(desc(customersTable.createdAt)).limit(pageSize).offset((page - 1) * pageSize);
  const sales = await db.select().from(salesTable).where(eq(salesTable.companyId, companyId));
  const byCustomer = new Map<number, { count: number; total: number }>();
  for (const sale of sales) {
    if (sale.customerId === null) continue;
    const current = byCustomer.get(sale.customerId) ?? { count: 0, total: 0 };
    current.count += 1;
    current.total += Number(sale.total);
    byCustomer.set(sale.customerId, current);
  }
  const [{ total }] = await db.select({ total: sql<number>`count(*)` }).from(customersTable).where(and(...conditions));
  res.json(ListCustomersResponse.parse({
    items: rows.map((row) => customerResponse(row, byCustomer.get(row.id)?.count ?? 0, byCustomer.get(row.id)?.total ?? 0)),
    total: Number(total),
    page,
    pageSize,
  }));
});

router.post("/customers", async (req, res): Promise<void> => {
  const parsed = CreateCustomerBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Dados do cliente inválidos" });
    return;
  }
  const [row] = await db.insert(customersTable).values({
    companyId: getCompanyId(req),
    name: parsed.data.name,
    phone: parsed.data.phone ?? null,
    email: parsed.data.email ?? null,
    address: parsed.data.address ?? null,
  }).returning();
  res.status(201).json(CreateCustomerResponse.parse(customerResponse(row)));
});

export default router;