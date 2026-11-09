import { computed, DestroyRef, effect, inject, Injectable, signal, untracked } from "@angular/core";

import { hojeISO } from "../../../../shared/avaliacoes/formato";
import type { Avaliacao, AvaliacaoInput, Contadores, Situacao } from "../../../../shared/avaliacoes/tipos";
import { ApiService, mensagemDaApi, type Visao } from "./api.service";

/** Estado do painel: dia selecionado, busca, lista e contadores. */
@Injectable({ providedIn: "root" })
export class AvaliacoesStore {
  private readonly api = inject(ApiService);

  /** Data do computador; muda sozinha quando vira o dia. */
  readonly hoje = signal(hojeISO());
  readonly dataSelecionada = signal(this.hoje());
  readonly busca = signal("");

  readonly visao = computed<Visao>(() => {
    const termo = this.busca().trim();
    return termo ? { tipo: "busca", termo } : { tipo: "dia", data: this.dataSelecionada() };
  });

  readonly itens = signal<Avaliacao[]>([]);
  readonly contadores = signal<Contadores | null>(null);
  readonly carregado = signal(false);
  readonly atualizando = signal(false);
  readonly erro = signal<string | null>(null);

  private pedido = 0;

  constructor() {
    effect(() => {
      const visao = this.visao();
      const hoje = this.hoje();
      untracked(() => void this.recarregar(visao, hoje));
    });

    const relogio = setInterval(() => this.hoje.set(hojeISO()), 60_000);
    inject(DestroyRef).onDestroy(() => clearInterval(relogio));
  }

  /** Respostas que chegam fora de ordem (busca digitada rápido) são descartadas. */
  async recarregar(visao = this.visao(), hoje = this.hoje()): Promise<void> {
    const numero = ++this.pedido;
    this.atualizando.set(true);
    try {
      const [itens, contadores] = await Promise.all([this.api.listar(visao), this.api.contadores(hoje)]);
      if (numero !== this.pedido) return;
      this.itens.set(itens);
      this.contadores.set(contadores);
      this.erro.set(null);
    } catch (e) {
      if (numero === this.pedido) this.erro.set(mensagemDaApi(e));
    } finally {
      if (numero === this.pedido) {
        this.atualizando.set(false);
        this.carregado.set(true);
      }
    }
  }

  escolherData(data: string) {
    this.busca.set("");
    this.dataSelecionada.set(data);
  }

  async salvar(dados: AvaliacaoInput, id?: string): Promise<void> {
    if (id) await this.api.atualizar(id, dados);
    else await this.api.criar(dados);
    // Depois de salvar, mostra o dia da avaliação.
    this.busca.set("");
    if (this.dataSelecionada() === dados.data) await this.recarregar();
    else this.dataSelecionada.set(dados.data);
  }

  async marcarSituacao(id: string, situacao: Situacao): Promise<void> {
    await this.api.marcarSituacao(id, situacao, this.hoje());
    await this.recarregar();
  }

  /** Depois de remarcar, mostra o novo dia. */
  async remarcar(id: string, nova: { data: string; horario: string }): Promise<void> {
    await this.api.remarcar(id, nova, this.hoje());
    this.busca.set("");
    if (this.dataSelecionada() === nova.data) await this.recarregar();
    else this.dataSelecionada.set(nova.data);
  }

  async excluir(id: string): Promise<void> {
    await this.api.excluir(id);
    await this.recarregar();
  }
}
