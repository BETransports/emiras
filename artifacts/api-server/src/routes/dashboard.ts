import { and, desc, eq, gte, sql } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { db, productsTable, saleItemsTable, salesTable } from "@workspace/db";
import { GetDashboardSummaryResponse } from "@workspace/api-zod";
import { getCompanyId } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/dashboard/summary", async (req, res): Promise<void> => {
  const companyId = getCompanyId(req);
  const products = await db.select().from(productsTable).where(eq(productsTable.companyId, companyId));
  const sales = await db.select().from(salesTable).where(eq(salesTable.companyId, companyId));
  const items = await db.select({
    productId: saleItemsTable.productId,
    quantity: saleItemsTable.quantity,
    total: saleItemsTable.total,
  }).from(saleItemsTable).innerJoin(salesTable, eq(saleItemsTable.saleId, salesTable.id))
    .where(eq(salesTable.companyId, companyId));
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const todaySales = sales.filter((sale) => sale.createdAt >= todayStart);
  const monthSales = sales.filter((sale) => sale.createdAt >= monthStart);
  const top = new Map<number, { quantity: number; value: number }>();
  for (const item of items) {
    const current = top.get(item.productId) ?? { quantity: 0, value: 0 };
    current.quantity += item.quantity;
    current.value += Number(item.total);
    top.set(item.productId, current);
  }
  const topProducts = [...top.entries()]
    .sort(([, a], [, b]) => b.quantity - a.quantity)
    .slice(0, 5)
    .map(([productId, data]) => ({
      name: products.find((product) => product.id === productId)?.name ?? "Produto",
      ...data,
    }));
  const salesByDay = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(todayStart);
    day.setDate(todayStart.getDate() - (6 - index));
    const next = new Date(day);
    next.setDate(day.getDate() + 1);
    return {
      label: day.toLocaleDateString("pt-AO", { weekday: "short" }).replace(".", ""),
      value: sales.filter((sale) => sale.createdAt >= day && sale.createdAt < next)
        .reduce((sum, sale) => sum + Number(sale.total), 0),
    };
  });
  res.json(GetDashboardSummaryResponse.parse({
    todaySales: todaySales.reduce((sum, sale) => sum + Number(sale.total), 0),
    monthSales: monthSales.reduce((sum, sale) => sum + Number(sale.total), 0),
    todayOrders: todaySales.length,
    productCount: products.filter((product) => product.active === 1).length,
    stockValue: products.reduce((sum, product) => sum + Number(product.costPrice) * product.stock, 0),
    lowStockCount: products.filter((product) => product.active === 1 && product.stock > 0 && product.stock <= product.minStock).length,
    outOfStockCount: products.filter((product) => product.active === 1 && product.stock === 0).length,
    topProducts,
    salesByDay,
  }));
});

export default router;