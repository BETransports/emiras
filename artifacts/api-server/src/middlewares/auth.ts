import { Request, Response, NextFunction } from "express";

// Declaração global para estender o Request do Express
declare global {
  namespace Express {
    interface Request {
      userId?: string;
      isPlatformAdmin?: boolean;
    }
  }
}

// Interface exportada explicitamente para evitar erros de tipo em outros ficheiros
export interface AuthenticatedRequest extends Request {
  userId?: string;
  isPlatformAdmin?: boolean;
}

// Middleware para verificar se o utilizador está autenticado
export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  if (!req.userId) {
    res.status(401).json({ error: "Sessão não encontrada ou expirada" });
    return;
  }
  next();
};

// Middleware para verificar se o utilizador é administrador da plataforma
export const requirePlatformAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!req.isPlatformAdmin) {
    res.status(403).json({ error: "Acesso restrito ao administrador" });
    return;
  }
  next();
};

// Middleware para verificar se a empresa está ativa
export const requireActiveCompany = (req: Request, res: Response, next: NextFunction) => {
  // Adicione a sua lógica de validação da empresa ativa aqui
  next();
};