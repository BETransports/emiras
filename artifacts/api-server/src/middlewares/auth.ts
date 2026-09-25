import { getAuth } from "@clerk/express";
import { eq } from "drizzle-orm";
import type { NextFunction, Request, RequestHandler, Response } from "express";
import { db, companiesTable, usersTable } from "@workspace/db";

export type AuthenticatedRequest = Request & {
  userId: string;
  companyId: number;
  isPlatformAdmin: boolean;
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
    .select({ companyId: usersTable.companyId, isPlatformAdmin: usersTable.isPlatformAdmin })
    .from(usersTable)
    .where(eq(usersTable.clerkUserId, userId))
    .limit(1);

  let companyId = existing[0]?.companyId;
  let isPlatformAdmin = existing[0]?.isPlatformAdmin === 1;

  if (!companyId) {
    const [company] = await db
      .insert(companiesTable)
      .values({ name: "Minha empresa", currency: "AOA", status: "pending" })
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
  authenticated.isPlatformAdmin = isPlatformAdmin;
  next();
};

export const requireActiveCompany: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const companyId = getCompanyId(req);
  const [company] = await db
    .select({ status: companiesTable.status })
    .from(companiesTable)
    .where(eq(companiesTable.id, companyId))
    .limit(1);

  if (!company || company.status !== "active") {
    res.status(403).json({ error: "Conta pendente de aprovação ou bloqueada", status: company?.status ?? "pending" });
    return;
  }
  next();
};

export const requirePlatformAdmin: RequestHandler = (req, res, next) => {
  if (!(req as AuthenticatedRequest).isPlatformAdmin) {
    res.status(403).json({ error: "Acesso restrito ao administrador" });
    return;
  }
  next();
};

export function getCompanyId(req: Request): number {
  return (req as AuthenticatedRequest).companyId;
}