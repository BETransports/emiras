import { and, asc, desc, eq, ilike, or, sql } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { db, categoriesTable, productsTable } from "@workspace/db";
import {
  CreateProductBody,
  CreateProductResponse,
  ListProductsQueryParams,
  ListProductsResponse,
  UpdateProductBody,
  UpdateProductParams,
  UpdateProductResponse,
} from "@workspace/api-zod";
import { getCompanyId } from "../middlewares/auth";
import { productResponse } from "./helpers";

const router: IRouter = Router();

async function findProduct(id: number, companyId: number) {
  const [row] = await db.select({
    product: productsTable,
    categoryName: categoriesTable.name,
  }).from(productsTable).leftJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id))
    .where(and(eq(productsTable.id, id), eq(productsTable.companyId, companyId)));
  return row ? productResponse(row.product, row.categoryName) : undefined;
}

router.get("/products", async (req, res): Promise<void> => {
  const parsed = ListProductsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Filtros de produtos inválidos" });
    return;
  }
  const { search, categoryId, lowStock, page, pageSize } = parsed.data;
  const companyId = getCompanyId(req);
  const conditions = [eq(productsTable.companyId, companyId)];
  if (search) {
    conditions.push(or(
      ilike(productsTable.name, `%${search}%`),
      ilike(productsTable.sku, `%${search}%`),
      ilike(productsTable.barcode, `%${search}%`),
    ) as typeof conditions[number]);
  }
  if (categoryId) conditions.push(eq(productsTable.categoryId, categoryId));
  if (lowStock) conditions.push(sql`${productsTable.stock} <= ${productsTable.minStock}`);
  const rows = await db.select({
    product: productsTable,
    categoryName: categoriesTable.name,
  }).from(productsTable).leftJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id))
    .where(and(...conditions)).orderBy(desc(productsTable.updatedAt))
    .limit(pageSize).offset((page - 1) * pageSize);
  const [{ total }] = await db.select({ total: sql<number>`count(*)` }).from(productsTable)
    .where(and(...conditions));
  res.json(ListProductsResponse.parse({
    items: rows.map((row) => productResponse(row.product, row.categoryName)),
    total: Number(total),
    page,
    pageSize,
  }));
});

router.post("/products", async (req, res): Promise<void> => {
  const parsed = CreateProductBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Dados do produto inválidos" });
    return;
  }
  const [row] = await db.insert(productsTable).values({
    companyId: getCompanyId(req),
    name: parsed.data.name,
    sku: parsed.data.sku,
    barcode: parsed.data.barcode ?? null,
    categoryId: parsed.data.categoryId ?? null,
    price: String(parsed.data.price),
    costPrice: String(parsed.data.costPrice),
    stock: parsed.data.stock,
    minStock: parsed.data.minStock,
    unit: parsed.data.unit ?? "un",
    active: 1,
    imageUrl: parsed.data.imageUrl ?? null,
  }).returning();
  res.status(201).json(CreateProductResponse.parse(await findProduct(row.id, getCompanyId(req))));
});

router.patch("/products/:id", async (req, res): Promise<void> => {
  const params = UpdateProductParams.safeParse(req.params);
  const parsed = UpdateProductBody.safeParse(req.body);
  if (!params.success || !parsed.success) {
    res.status(400).json({ error: "Dados do produto inválidos" });
    return;
  }
  const existing = await findProduct(params.data.id, getCompanyId(req));
  if (!existing) {
    res.status(404).json({ error: "Produto não encontrado" });
    return;
  }
  await db.update(productsTable).set({
    ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
    ...(parsed.data.barcode !== undefined ? { barcode: parsed.data.barcode } : {}),
    ...(parsed.data.categoryId !== undefined ? { categoryId: parsed.data.categoryId } : {}),
    ...(parsed.data.price !== undefined ? { price: String(parsed.data.price) } : {}),
    ...(parsed.data.costPrice !== undefined ? { costPrice: String(parsed.data.costPrice) } : {}),
    ...(parsed.data.minStock !== undefined ? { minStock: parsed.data.minStock } : {}),
    ...(parsed.data.unit !== undefined ? { unit: parsed.data.unit } : {}),
    ...(parsed.data.active !== undefined ? { active: parsed.data.active ? 1 : 0 } : {}),
    ...(parsed.data.imageUrl !== undefined ? { imageUrl: parsed.data.imageUrl } : {}),
    updatedAt: new Date(),
  }).where(and(eq(productsTable.id, params.data.id), eq(productsTable.companyId, getCompanyId(req))));
  res.json(UpdateProductResponse.parse(await findProduct(params.data.id, getCompanyId(req))));
});

export default router;