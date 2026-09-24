import { and, desc, eq, inArray } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { db, productsTable, stockMovementsTable } from "@workspace/db";
import {
  CreateStockMovementBody,
  CreateStockMovementResponse,
  ListStockMovementsQueryParams,
  ListStockMovementsResponse,
} from "@workspace/api-zod";
import { getCompanyId } from "../middlewares/auth";
import { movementResponse } from "./helpers";

const router: IRouter = Router();

router.get("/stock/movements", async (req, res): Promise<void> => {
  const parsed = ListStockMovementsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Filtros de stock inválidos" });
    return;
  }
  const rows = await db.select({
    movement: stockMovementsTable,
    productName: productsTable.name,
  }).from(stockMovementsTable).innerJoin(productsTable, eq(stockMovementsTable.productId, productsTable.id))
    .where(eq(stockMovementsTable.companyId, getCompanyId(req)))
    .orderBy(desc(stockMovementsTable.createdAt)).limit(parsed.data.limit);
  res.json(ListStockMovementsResponse.parse(rows.map((row) => movementResponse(row.movement, row.productName))));
});

router.post("/stock/movements", async (req, res): Promise<void> => {
  const parsed = CreateStockMovementBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Dados do movimento inválidos" });
    return;
  }
  const companyId = getCompanyId(req);
  const result = await db.transaction(async (tx) => {
    const [product] = await tx.select().from(productsTable).where(and(
      eq(productsTable.id, parsed.data.productId),
      eq(productsTable.companyId, companyId),
    ));
    if (!product) return { error: "Produto não encontrado" as const };
    const adds = parsed.data.type === "ENTRADA" || parsed.data.type === "DEVOLUCAO";
    const nextStock = parsed.data.type === "AJUSTE"
      ? product.stock + parsed.data.quantity
      : product.stock + (adds ? parsed.data.quantity : -parsed.data.quantity);
    if (nextStock < 0) return { error: `Stock insuficiente. Disponível: ${product.stock}` as const };
    await tx.update(productsTable).set({ stock: nextStock, updatedAt: new Date() })
      .where(eq(productsTable.id, product.id));
    const [movement] = await tx.insert(stockMovementsTable).values({
      companyId,
      productId: product.id,
      type: parsed.data.type,
      quantity: parsed.data.quantity,
      reason: parsed.data.reason,
      previousStock: product.stock,
      resultingStock: nextStock,
    }).returning();
    return { movement, productName: product.name };
  });
  if ("error" in result) {
    res.status(400).json({ error: result.error });
    return;
  }
  res.status(201).json(CreateStockMovementResponse.parse(movementResponse(result.movement, result.productName)));
});

export default router;