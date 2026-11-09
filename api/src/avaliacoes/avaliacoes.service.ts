import { Inject, Injectable } from "@nestjs/common";

import { criarRepositorioAvaliacoes } from "../../../shared/avaliacoes/repositorio";
import { criarServicoAvaliacoes, type ServicoAvaliacoes } from "../../../shared/avaliacoes/servico";
import { BancoService } from "../banco/banco.service";
import { CONFIG, type Configuracao } from "../config";

/** Adapta as regras de negócio de shared/ para a injeção de dependências do Nest. */
@Injectable()
export class AvaliacoesService {
  private readonly regras: ServicoAvaliacoes;

  constructor(@Inject(BancoService) banco: BancoService, @Inject(CONFIG) config: Configuracao) {
    this.regras = criarServicoAvaliacoes({
      repo: criarRepositorioAvaliacoes(banco),
      mensagens: config.cliente.mensagens,
    });
  }

  listarPorData = (data: string) => this.regras.listarPorData(data);
  pesquisar = (termo: string) => this.regras.pesquisar(termo);
  contadores = (hoje: string) => this.regras.contadores(hoje);
  criar: ServicoAvaliacoes["criar"] = (dados) => this.regras.criar(dados);
  atualizar: ServicoAvaliacoes["atualizar"] = (id, dados) => this.regras.atualizar(id, dados);
  excluir = (id: string) => this.regras.excluir(id);
  marcarSituacao: ServicoAvaliacoes["marcarSituacao"] = (id, situacao, hoje) =>
    this.regras.marcarSituacao(id, situacao, hoje);
  remarcar: ServicoAvaliacoes["remarcar"] = (id, nova, hoje) => this.regras.remarcar(id, nova, hoje);
  gerarLembrete = (id: string, hoje: string) => this.regras.gerarLembrete(id, hoje);
}
