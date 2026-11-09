import { createReadStream } from "node:fs";
import path from "node:path";

import { Controller, Get, Header, Inject, StreamableFile } from "@nestjs/common";

import { cssDaMarca } from "../../../scripts/cliente-config.mjs";
import { CONFIG, type Configuracao } from "../config";

const TIPOS: Record<string, string> = {
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

function imagem(caminho: string): StreamableFile {
  return new StreamableFile(createReadStream(caminho), {
    type: TIPOS[path.extname(caminho).toLowerCase()] ?? "application/octet-stream",
  });
}

/** Marca da academia (white label): nome, mensagens, cores, logo e ícone. */
@Controller("cliente")
export class ClienteController {
  constructor(@Inject(CONFIG) private readonly config: Configuracao) {}

  @Get()
  dados() {
    const { id, nome, nomeCurto, produto, versao } = this.config.cliente;
    return { id, nome, nomeCurto, produto, versao };
  }

  @Get("marca.css")
  @Header("Content-Type", "text/css; charset=utf-8")
  marca() {
    return cssDaMarca(this.config.cliente);
  }

  @Get("logo")
  logo() {
    return imagem(this.config.cliente.caminhoLogo);
  }

  @Get("icone")
  icone() {
    return imagem(this.config.cliente.caminhoIcone);
  }
}
