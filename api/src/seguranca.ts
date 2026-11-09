import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";
import helmet from "helmet";

import { NaoEncontrada } from "../../shared/avaliacoes/servico";
import { ErroSituacao } from "../../shared/avaliacoes/situacao";
import { ErroValidacao } from "../../shared/avaliacoes/validacao";
import { ErroLembrete } from "../../shared/avaliacoes/whatsapp";
import { ErroBackup } from "./backup/backup.service";

/**
 * A API não tem login: ela só deve responder para o próprio computador (ou para os
 * hosts liberados em HOSTS_PERMITIDOS). Conferir o Host bloqueia DNS rebinding,
 * em que um site externo resolve o próprio domínio para 127.0.0.1.
 */
export function protegerHost(permitidos: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const host = (req.headers.host ?? "").replace(/:\d+$/, "").toLowerCase();
    if (!permitidos.includes(host)) {
      res.status(403).json({ mensagem: "Host não permitido." });
      return;
    }
    next();
  };
}

export const cabecalhosDeSeguranca = helmet({
  contentSecurityPolicy: {
    useDefaults: false,
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:"],
      fontSrc: ["'self'", "data:"],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
    },
  },
  crossOriginResourcePolicy: { policy: "same-origin" },
});

const STATUS = new Map<Function, number>([
  [ErroValidacao, HttpStatus.BAD_REQUEST],
  [ErroLembrete, HttpStatus.UNPROCESSABLE_ENTITY],
  [ErroBackup, HttpStatus.UNPROCESSABLE_ENTITY],
  [ErroSituacao, HttpStatus.UNPROCESSABLE_ENTITY],
  [NaoEncontrada, HttpStatus.NOT_FOUND],
]);

/** Toda resposta de erro sai como { mensagem }, sem stack trace nem detalhes internos. */
@Catch()
export class FiltroDeErros implements ExceptionFilter {
  private readonly log = new Logger("API");

  catch(erro: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();

    if (erro instanceof HttpException) {
      const corpo = erro.getResponse();
      const mensagem = typeof corpo === "string" ? corpo : String((corpo as { message?: unknown }).message ?? erro.message);
      res.status(erro.getStatus()).json({ mensagem });
      return;
    }

    const status = erro instanceof Error ? STATUS.get(erro.constructor) : undefined;
    if (status && erro instanceof Error) {
      res.status(status).json({ mensagem: erro.message });
      return;
    }

    if ((erro as { type?: string })?.type === "entity.too.large") {
      res.status(413).json({ mensagem: "Arquivo ou requisição grande demais." });
      return;
    }

    this.log.error(erro instanceof Error ? (erro.stack ?? erro.message) : String(erro));
    res.status(500).json({ mensagem: "Erro interno. Tente novamente." });
  }
}
