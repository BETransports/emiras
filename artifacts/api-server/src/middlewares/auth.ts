import { Request, Response, NextFunction } from "express";

export interface AuthenticatedRequest extends Request {
  userId?: string;
  isPlatformAdmin?: boolean;
}

export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  if (!(req as AuthenticatedRequest).userId) {
    res.status(401).json({ error: "Sessão não encontrada ou expirada" });
    return;
  }
  next();
};

// 1. Exportação necessária para o admin.ts
export const requirePlatformAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!(req as AuthenticatedRequest).isPlatformAdmin) {
    res.status(403).json({ error: "Acesso restrito ao administrador" });
    return;
  }
  next();
};

// 2. Exportação necessária para o index.ts
export const requireActiveCompany = (req: Request, res: Response, next: NextFunction) => {
  next();
};
