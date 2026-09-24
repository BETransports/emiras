import { and, asc, eq, sql } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { db, categoriesTable, productsTable } from "@workspace/db";
import {
  CreateCategoryBody,
  CreateCategoryResponse,
  ListCategoriesResponse,
  UpdateCategoryBody,
  UpdateCategoryParams,
  UpdateCategoryResponse,
} from "@workspace/api-zod";
import { getCompanyId } from "../middlewares/auth";
import { categoryResponse } from "./helpers";

const router: IRouter = Router();

router.get("/categories", async (req, res): Promise<void> => {
  const companyId = getCompanyId(req);
  const rows = await db.select().from(categoriesTable)
    .where(eq(categoriesTable.companyId, companyId)).orderBy(asc(categoriesTable.name));
  const counts = await db.select({
    categoryId: productsTable.categoryId,
    count: sql<number>`count(*)`,
  }).from(productsTable).where(eq(productsTable.companyId, companyId))
    .groupBy(productsTable.categoryId);
  const countByCategory = new Map(counts.map((row) => [row.categoryId, Number(row.count)]));
  res.json(ListCategoriesResponse.parse(rows.map((row) => categoryResponse(row, countByCategory.get(row.id) ?? 0))));
});

router.post("/categories", async (req, res): Promise<void> => {
  const parsed = CreateCategoryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Dados da categoria inválidos" });
    return;
  }
  const [row] = await db.insert(categoriesTable).values({
    companyId: getCompanyId(req),
    name: parsed.data.name,
    color: parsed.data.color ?? "#2563EB",
    active: 1,
  }).returning();
  res.status(201).json(CreateCategoryResponse.parse(categoryResponse(row)));
});

router.patch("/categories/:id", async (req, res): Promise<void> => {
  const params = UpdateCategoryParams.safeParse(req.params);
  const parsed = UpdateCategoryBody.safeParse(req.body);
  if (!params.success || !parsed.success) {
    res.status(400).json({ error: "Dados da categoria inválidos" });
    return;
  }
  const [existing] = await db.select().from(categoriesTable).where(and(
    eq(categoriesTable.id, params.data.id),
    eq(categoriesTable.companyId, getCompanyId(req)),
  ));
  if (!existing) {
    res.status(404).json({ error: "Categoria não encontrada" });
    return;
  }
  const [row] = await db.update(categoriesTable).set({
    ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
    ...(parsed.data.color !== undefined ? { color: parsed.data.color } : {}),
    ...(parsed.data.active !== undefined ? { active: parsed.data.active ? 1 : 0 } : {}),
  }).where(eq(categoriesTable.id, existing.id)).returning();
  res.json(UpdateCategoryResponse.parse(categoryResponse(row)));
});

export default router;