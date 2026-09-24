import { getAuth } from "@clerk/express";
import { eq } from "drizzle-orm";
import type { NextFunction, Request, RequestHandler, Response } from "express";
import { db, companiesTable, usersTable } from "@workspace/db";

export type AuthenticatedRequest = Request & {
  userId: string;
  companyId: number;
};

export const requireAuth: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const auth = getAuth(req);
  const userId = auth.userId;
  if (!userId) {
    res.status(401).json({ error: "Autenticação necessária" });
    return;
  }

  const existing = await db
    .select({ companyId: usersTable.companyId })
    .from(usersTable)
    .where(eq(usersTable.clerkUserId, userId))
    .limit(1);

  let companyId = existing[0]?.companyId;
  if (!companyId) {
    const [company] = await db
      .insert(companiesTable)
      .values({ name: "Minha empresa", currency: "AOA" })
      .returning({ id: companiesTable.id });
    companyId = company.id;
    await db.insert(usersTable).values({
      clerkUserId: userId,
      companyId,
      name: "Administrador",
      role: "ADMIN",
    });
  }

  const authenticated = req as AuthenticatedRequest;
  authenticated.userId = userId;
  authenticated.companyId = companyId;
  next();
};

export function getCompanyId(req: Request): number {
  return (req as AuthenticatedRequest).companyId;
}