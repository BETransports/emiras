import { desc, eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { db, productsTable, saleItemsTable, salesTable, stockMovementsTable } from "@workspace/db";
import { ListActivityQueryParams, ListActivityResponse } from "@workspace/api-zod";
import { getCompanyId } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/activity", async (req, res): Promise<void> => {
  const parsed = ListActivityQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Parâmetros de atividade inválidos" });
    return;
  }
  const companyId = getCompanyId(req);
  const [sales, movements, products] = await Promise.all([
    db.select().from(salesTable).where(eq(salesTable.companyId, companyId)).orderBy(desc(salesTable.createdAt)).limit(parsed.data.limit),
    db.select({ movement: stockMovementsTable, productName: productsTable.name })
      .from(stockMovementsTable).innerJoin(productsTable, eq(stockMovementsTable.productId, productsTable.id))
      .where(eq(stockMovementsTable.companyId, companyId)).orderBy(desc(stockMovementsTable.createdAt)).limit(parsed.data.limit),
    db.select().from(productsTable).where(eq(productsTable.companyId, companyId)).orderBy(desc(productsTable.createdAt)).limit(parsed.data.limit),
  ]);
  const items = [
    ...sales.map((sale) => ({
      id: sale.id,
      type: "sale",
      title: `Venda ${sale.number}`,
      detail: `${Number(sale.total).toLocaleString("pt-AO", { style: "currency", currency: "AOA" })}`,
      createdAt: sale.createdAt,
    })),
    ...movements.map(({ movement, productName }) => ({
      id: 100000 + movement.id,
      type: movement.type.toLowerCase(),
      title: `${movement.type === "SAIDA" ? "Saída" : "Movimento"} de stock`,
      detail: `${productName} · ${movement.quantity} ${movement.reason}`,
      createdAt: movement.createdAt,
    })),
    ...products.map((product) => ({
      id: 200000 + product.id,
      type: "product",
      title: "Produto adicionado",
      detail: product.name,
      createdAt: product.createdAt,
    })),
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, parsed.data.limit);
  res.json(ListActivityResponse.parse(items));
});

export default router;