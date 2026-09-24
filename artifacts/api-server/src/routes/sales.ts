import { and, desc, eq, ilike, sql } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { db, customersTable, productsTable, saleItemsTable, salesTable, stockMovementsTable } from "@workspace/db";
import {
  CreateSaleBody,
  CreateSaleResponse,
  ListSalesQueryParams,
  ListSalesResponse,
} from "@workspace/api-zod";
import { getCompanyId } from "../middlewares/auth";
import { saleResponse } from "./helpers";

const router: IRouter = Router();

async function loadSale(id: number, companyId: number) {
  const [row] = await db.select({
    sale: salesTable,
    customerName: customersTable.name,
  }).from(salesTable).leftJoin(customersTable, eq(salesTable.customerId, customersTable.id))
    .where(and(eq(salesTable.id, id), eq(salesTable.companyId, companyId)));
  if (!row) return undefined;
  const items = await db.select({
    item: saleItemsTable,
    productName: productsTable.name,
  }).from(saleItemsTable).innerJoin(productsTable, eq(saleItemsTable.productId, productsTable.id))
    .where(eq(saleItemsTable.saleId, id));
  return saleResponse(row.sale, row.customerName, items.map((item) => ({ ...item.item, productName: item.productName })));
}

router.get("/sales", async (req, res): Promise<void> => {
  const parsed = ListSalesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Filtros de vendas inválidos" });
    return;
  }
  const { search, page, pageSize } = parsed.data;
  const conditions = [eq(salesTable.companyId, getCompanyId(req))];
  if (search) conditions.push(ilike(salesTable.number, `%${search}%`));
  const rows = await db.select({ sale: salesTable, customerName: customersTable.name })
    .from(salesTable).leftJoin(customersTable, eq(salesTable.customerId, customersTable.id))
    .where(and(...conditions)).orderBy(desc(salesTable.createdAt))
    .limit(pageSize).offset((page - 1) * pageSize);
  const items = await Promise.all(rows.map(async (row) => {
    const saleItems = await db.select({
      item: saleItemsTable,
      productName: productsTable.name,
    }).from(saleItemsTable).innerJoin(productsTable, eq(saleItemsTable.productId, productsTable.id))
      .where(eq(saleItemsTable.saleId, row.sale.id));
    return saleResponse(row.sale, row.customerName, saleItems.map((item) => ({ ...item.item, productName: item.productName })));
  }));
  const [{ total }] = await db.select({ total: sql<number>`count(*)` }).from(salesTable).where(and(...conditions));
  res.json(ListSalesResponse.parse({ items, total: Number(total), page, pageSize }));
});

router.post("/sales", async (req, res): Promise<void> => {
  const parsed = CreateSaleBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Dados da venda inválidos" });
    return;
  }
  const companyId = getCompanyId(req);
  const result = await db.transaction(async (tx) => {
    if (parsed.data.customerId !== null && parsed.data.customerId !== undefined) {
      const [customer] = await tx.select().from(customersTable).where(and(
        eq(customersTable.id, parsed.data.customerId),
        eq(customersTable.companyId, companyId),
      ));
      if (!customer) return { error: "Cliente não encontrado" as const };
    }
    const productIds = parsed.data.items.map((item) => item.productId);
    const products = await tx.select().from(productsTable).where(and(
      eq(productsTable.companyId, companyId),
      sql`${productsTable.id} in ${sql.raw(`(${productIds.join(",")})`)}`,
    ));
    if (products.length !== productIds.length) return { error: "Um ou mais produtos não foram encontrados" as const };
    const productMap = new Map(products.map((product) => [product.id, product]));
    let subtotal = 0;
    for (const item of parsed.data.items) {
      const product = productMap.get(item.productId)!;
      if (product.active !== 1) return { error: `${product.name} está inativo` as const };
      if (product.stock < item.quantity) return { error: `Stock insuficiente para ${product.name}. Disponível: ${product.stock}` as const };
      subtotal += Number(product.price) * item.quantity;
    }
    const total = subtotal - parsed.data.discount;
    if (total < 0) return { error: "O desconto não pode ser superior ao subtotal" as const };
    const [sale] = await tx.insert(salesTable).values({
      companyId,
      number: `PENDING-${Date.now()}`,
      customerId: parsed.data.customerId ?? null,
      subtotal: subtotal.toFixed(2),
      discount: parsed.data.discount.toFixed(2),
      total: total.toFixed(2),
      paymentMethod: parsed.data.paymentMethod,
    }).returning();
    const number = `EM-${new Date().getFullYear()}-${sale.id.toString().padStart(6, "0")}`;
    await tx.update(salesTable).set({ number }).where(eq(salesTable.id, sale.id));
    for (const item of parsed.data.items) {
      const product = productMap.get(item.productId)!;
      const itemTotal = Number(product.price) * item.quantity;
      await tx.insert(saleItemsTable).values({
        saleId: sale.id,
        productId: product.id,
        quantity: item.quantity,
        unitPrice: String(product.price),
        total: itemTotal.toFixed(2),
      });
      await tx.update(productsTable).set({ stock: product.stock - item.quantity, updatedAt: new Date() })
        .where(eq(productsTable.id, product.id));
      await tx.insert(stockMovementsTable).values({
        companyId,
        productId: product.id,
        type: "SAIDA",
        quantity: item.quantity,
        reason: `Venda ${number}`,
        previousStock: product.stock,
        resultingStock: product.stock - item.quantity,
      });
    }
    return { saleId: sale.id };
  });
  if ("error" in result) {
    res.status(400).json({ error: result.error });
    return;
  }
  res.status(201).json(CreateSaleResponse.parse(await loadSale(result.saleId, companyId)));
});

export default router;