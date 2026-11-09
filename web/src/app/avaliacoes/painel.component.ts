import { ChangeDetectionStrategy, Component, computed, inject, signal } from "@angular/core";
import {
  LucideCalendarCheck,
  LucideCalendarClock,
  LucideChartPie,
  LucideClipboardList,
  LucidePlus,
  LucideSearch,
  LucideSearchX,
  LucideX,
} from "@lucide/angular";

import { formatarData, paraDate } from "../../../../shared/avaliacoes/formato";
import { mensagemDiaVazio } from "../../../../shared/avaliacoes/mensagens-vazias";
import { DIAS_COMPARECIMENTO } from "../../../../shared/avaliacoes/situacao";
import type { Avaliacao, AvaliacaoInput, Situacao } from "../../../../shared/avaliacoes/tipos";
import { ConfirmarComponent } from "../componentes/confirmar.component";
import { ApiService, mensagemDaApi } from "../nucleo/api.service";
import { AvaliacoesStore } from "../nucleo/avaliacoes.store";
import { Avisos } from "../nucleo/avisos";
import { BackupComponent } from "./backup.component";
import { FormularioComponent } from "./formulario.component";
import { RemarcarComponent } from "./remarcar.component";
import { SeletorDataComponent } from "./seletor-data.component";
import { StatCardComponent } from "./stat-card.component";
import { type MudancaSituacao, TabelaComponent } from "./tabela.component";

const formatoExtenso = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

@Component({
  selector: "app-painel",
  imports: [
    BackupComponent,
    ConfirmarComponent,
    FormularioComponent,
    RemarcarComponent,
    LucideCalendarCheck,
    LucideCalendarClock,
  LucideChartPie,
    LucideClipboardList,
    LucidePlus,
    LucideSearch,
    LucideSearchX,
    LucideX,
    SeletorDataComponent,
    StatCardComponent,
    TabelaComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./painel.component.html",
})
export class PainelComponent {
  protected readonly store = inject(AvaliacoesStore);
  private readonly api = inject(ApiService);
  private readonly avisos = inject(Avisos);

  protected readonly formAberto = signal(false);
  protected readonly emEdicao = signal<Avaliacao | null>(null);
  protected readonly paraExcluir = signal<Avaliacao | null>(null);
  protected readonly paraRemarcar = signal<Avaliacao | null>(null);

  /** "85%" e "17 de 20 · 2 para marcar" a partir dos contadores. */
  protected readonly comparecimento = computed(() => {
    const c = this.store.contadores();
    if (!c) return { valor: null, detalhe: `Últimos ${DIAS_COMPARECIMENTO} dias` };
    const marcadas = c.compareceram + c.faltaram;
    const pendentes = c.pendentes ? ` · ${c.pendentes} para marcar` : "";
    return marcadas
      ? {
          valor: `${Math.round((c.compareceram / marcadas) * 100)}%`,
          detalhe: `${c.compareceram} de ${marcadas} nos últimos ${DIAS_COMPARECIMENTO} dias${pendentes}`,
        }
      : { valor: "–", detalhe: `Nenhuma presença marcada nos últimos ${DIAS_COMPARECIMENTO} dias${pendentes}` };
  });

  protected readonly hojeExtenso = computed(() => formatoExtenso.format(paraDate(this.store.hoje())));
  protected readonly dataPadrao = computed(() => {
    const [data, hoje] = [this.store.dataSelecionada(), this.store.hoje()];
    return data >= hoje ? data : hoje;
  });
  protected readonly titulo = computed(() => {
    const visao = this.store.visao();
    if (visao.tipo === "busca") return `Resultados para “${visao.termo}”`;
    return visao.data === this.store.hoje() ? "Avaliações de hoje" : `Avaliações de ${formatarData(visao.data)}`;
  });
  protected readonly vazio = computed(() => {
    const visao = this.store.visao();
    return visao.tipo === "dia" ? mensagemDiaVazio(visao.data, this.store.hoje()) : null;
  });
  protected readonly podeCadastrarNoDia = computed(() => this.store.dataSelecionada() >= this.store.hoje());

  protected readonly formatarData = formatarData;

  protected abrirNova() {
    this.emEdicao.set(null);
    this.formAberto.set(true);
  }

  protected abrirEdicao(a: Avaliacao) {
    this.emEdicao.set(a);
    this.formAberto.set(true);
  }

  protected fecharFormulario() {
    this.formAberto.set(false);
    this.emEdicao.set(null);
  }

  protected readonly salvar = async (dados: AvaliacaoInput): Promise<boolean> => {
    const editando = this.emEdicao();
    try {
      await this.store.salvar(dados, editando?.id);
    } catch (e) {
      this.avisos.erro("Não foi possível salvar a avaliação.", mensagemDaApi(e));
      return false;
    }
    this.avisos.sucesso(
      editando ? "Avaliação atualizada!" : "Avaliação cadastrada!",
      `${dados.nome} — ${formatarData(dados.data)} às ${dados.horario}`,
    );
    return true;
  };

  protected async enviarLembrete(a: Avaliacao) {
    try {
      const { link } = await this.api.lembrete(a.id, this.store.hoje());
      if (!link.startsWith("https://wa.me/")) throw new Error("Link inesperado recebido do servidor.");
      window.open(link, "_blank", "noopener,noreferrer");
      this.avisos.sucesso("Abrindo o WhatsApp…", `Revise a mensagem para ${a.nome} e clique em enviar no WhatsApp.`);
    } catch (e) {
      this.avisos.erro("Não foi possível preparar o lembrete.", mensagemDaApi(e));
    }
  }

  protected async mudarSituacao({ avaliacao, situacao }: MudancaSituacao) {
    const textos: Record<Situacao, string> = {
      agendada: "voltou para agendada",
      compareceu: "marcada como compareceu",
      faltou: "marcada como falta",
      cancelada: "cancelada",
    };
    try {
      await this.store.marcarSituacao(avaliacao.id, situacao);
      this.avisos.sucesso(`Avaliação de ${avaliacao.nome} ${textos[situacao]}.`);
    } catch (e) {
      this.avisos.erro("Não foi possível mudar a situação.", mensagemDaApi(e));
    }
  }

  protected readonly confirmarRemarcacao = async (nova: { data: string; horario: string }): Promise<string | null> => {
    const alvo = this.paraRemarcar();
    if (!alvo) return null;
    try {
      await this.store.remarcar(alvo.id, nova);
    } catch (e) {
      return mensagemDaApi(e);
    }
    this.avisos.sucesso("Avaliação remarcada!", `${alvo.nome} — ${formatarData(nova.data)} às ${nova.horario}`);
    return null;
  };

  protected async confirmarExclusao() {
    const alvo = this.paraExcluir();
    this.paraExcluir.set(null);
    if (!alvo) return;
    try {
      await this.store.excluir(alvo.id);
      this.avisos.sucesso(`Avaliação de ${alvo.nome} excluída.`);
    } catch (e) {
      this.avisos.erro("Não foi possível excluir a avaliação.", mensagemDaApi(e));
    }
  }

  protected aoRestaurar() {
    this.store.escolherData(this.store.hoje());
    void this.store.recarregar();
  }
}
