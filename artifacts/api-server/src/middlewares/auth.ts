import { Request, Response, NextFunction } from "express";

export interface AuthenticatedRequest extends Request {
  userId?: string;
  companyId?: number;
  isPlatformAdmin?: boolean;
}

// Função utilitária exigida no activity.ts
export const getCompanyId = (req: Request): number | null => {
  const authReq = req as AuthenticatedRequest;
  if (authReq.companyId) return authReq.companyId;
  
  const headerId = req.headers["x-company-id"];
  if (headerId) return Number(headerId);
  
  return null;
};

export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  if (!(req as AuthenticatedRequest).userId) {
    res.status(401).json({ error: "Sessão não encontrada ou expirada" });
    return;
  }
  next();
};

export const requirePlatformAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!(req as AuthenticatedRequest).isPlatformAdmin) {
    res.status(403).json({ error: "Acesso restrito ao administrador" });
    return;
  }
  next();
};

export const requireActiveCompany = (req: Request, res: Response, next: NextFunction) => {
  next();
};