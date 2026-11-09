import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from "@nestjs/common";

import { dataValida } from "../../../shared/avaliacoes/formato";
import { SITUACOES, situacaoValida } from "../../../shared/avaliacoes/situacao";
import type { AvaliacaoInput } from "../../../shared/avaliacoes/tipos";
import { NOME_MAX } from "../../../shared/avaliacoes/validacao";
import { AvaliacoesService } from "./avaliacoes.service";

const ID = /^[A-Za-z0-9-]{1,64}$/;

function exigirData(valor: unknown, campo: string): string {
  if (typeof valor !== "string" || !dataValida(valor)) {
    throw new BadRequestException(`"${campo}" deve ser uma data AAAA-MM-DD.`);
  }
  return valor;
}

function exigirId(id: string): string {
  if (!ID.test(id)) throw new BadRequestException("Identificador inválido.");
  return id;
}

/** Só os quatro campos, sempre como texto. A validação de conteúdo fica nas regras de negócio. */
function lerAvaliacao(corpo: unknown): AvaliacaoInput {
  const c = (corpo ?? {}) as Record<string, unknown>;
  const texto = (v: unknown) => (typeof v === "string" ? v : "");
  return { nome: texto(c.nome), data: texto(c.data), horario: texto(c.horario), whatsapp: texto(c.whatsapp) };
}

@Controller("avaliacoes")
export class AvaliacoesController {
  constructor(@Inject(AvaliacoesService) private readonly avaliacoes: AvaliacoesService) {}

  @Get()
  listar(@Query("data") data?: string, @Query("busca") busca?: string) {
    if (typeof busca === "string") {
      if (busca.length > NOME_MAX) throw new BadRequestException("Busca muito longa.");
      return this.avaliacoes.pesquisar(busca);
    }
    return this.avaliacoes.listarPorData(exigirData(data, "data"));
  }

  @Get("contadores")
  contadores(@Query("hoje") hoje?: string) {
    return this.avaliacoes.contadores(exigirData(hoje, "hoje"));
  }

  @Post()
  criar(@Body() corpo: unknown) {
    return this.avaliacoes.criar(lerAvaliacao(corpo));
  }

  @Put(":id")
  @HttpCode(204)
  async atualizar(@Param("id") id: string, @Body() corpo: unknown) {
    await this.avaliacoes.atualizar(exigirId(id), lerAvaliacao(corpo));
  }

  @Delete(":id")
  @HttpCode(204)
  async excluir(@Param("id") id: string) {
    await this.avaliacoes.excluir(exigirId(id));
  }

  @Patch(":id/situacao")
  @HttpCode(204)
  async situacao(@Param("id") id: string, @Body() corpo: { situacao?: unknown; hoje?: unknown } | undefined) {
    if (!situacaoValida(corpo?.situacao)) {
      throw new BadRequestException(`"situacao" deve ser: ${SITUACOES.join(", ")}.`);
    }
    await this.avaliacoes.marcarSituacao(exigirId(id), corpo.situacao, exigirData(corpo.hoje, "hoje"));
  }

  @Post(":id/remarcar")
  @HttpCode(200)
  remarcar(@Param("id") id: string, @Body() corpo: { data?: unknown; horario?: unknown; hoje?: unknown } | undefined) {
    const horario = typeof corpo?.horario === "string" ? corpo.horario : "";
    return this.avaliacoes.remarcar(
      exigirId(id),
      { data: exigirData(corpo?.data, "data"), horario },
      exigirData(corpo?.hoje, "hoje"),
    );
  }

  @Post(":id/lembrete")
  @HttpCode(200)
  async lembrete(@Param("id") id: string, @Body() corpo: { hoje?: unknown } | undefined) {
    const link = await this.avaliacoes.gerarLembrete(exigirId(id), exigirData(corpo?.hoje, "hoje"));
    return { link };
  }
}
