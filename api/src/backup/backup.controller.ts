import { BadRequestException, Body, Controller, Get, HttpCode, Inject, Post, Res, StreamableFile } from "@nestjs/common";
import type { Response } from "express";

import { CONFIG, type Configuracao } from "../config";
import { BackupService } from "./backup.service";

function exigirArquivo(corpo: unknown): Buffer {
  if (!Buffer.isBuffer(corpo) || corpo.length === 0) {
    throw new BadRequestException("Envie o arquivo de backup (.db) no corpo da requisição.");
  }
  return corpo;
}

@Controller("backup")
export class BackupController {
  constructor(
    @Inject(BackupService) private readonly backup: BackupService,
    @Inject(CONFIG) private readonly config: Configuracao,
  ) {}

  @Get()
  exportar(@Res({ passthrough: true }) res: Response) {
    const { nome, conteudo } = this.backup.exportar();
    res.set({
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="${nome}"`,
    });
    return new StreamableFile(conteudo);
  }

  @Post("inspecionar")
  @HttpCode(200)
  inspecionar(@Body() corpo: unknown) {
    return this.backup.inspecionar(exigirArquivo(corpo));
  }

  @Post("restaurar")
  @HttpCode(200)
  restaurar(@Body() corpo: unknown) {
    return this.backup.restaurar(exigirArquivo(corpo));
  }

  @Get("local")
  local() {
    return { arquivo: this.config.arquivoBanco };
  }
}
