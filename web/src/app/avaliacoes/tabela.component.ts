import { ChangeDetectionStrategy, Component, computed, input, output } from "@angular/core";
import { LucidePencil, LucideTrash } from "@lucide/angular";

import { diaDaSemana, formatarData, formatarTelefone, somarDias } from "../../../../shared/avaliacoes/formato";
import { pendente, situacaoValida } from "../../../../shared/avaliacoes/situacao";
import type { Avaliacao, Situacao } from "../../../../shared/avaliacoes/tipos";
import { IconeWhatsappComponent } from "./icone-whatsapp.component";

/** Cor do select de acordo com a situação. */
const ESTILOS: Record<Situacao | "pendente", string> = {
  agendada: "border-sky-200 bg-sky-50 text-sky-800",
  compareceu: "border-green-200 bg-green-50 text-green-800",
  faltou: "border-red-200 bg-red-50 text-red-700",
  cancelada: "border-input bg-muted text-muted-foreground",
  pendente: "border-amber-300 bg-amber-50 text-amber-800",
};

export interface MudancaSituacao {
  avaliacao: Avaliacao;
  situacao: Situacao;
}

interface Linha {
  a: Avaliacao;
  /** Na busca os resultados podem ser de dias diferentes: abre um grupo por data. */
  grupo: string | null;
  data: string;
  semana: string;
  telefone: string;
  dia: "hoje" | "amanha" | null;
  passou: boolean;
  futura: boolean;
  /** Passou e continua agendada: falta marcar se o aluno veio. */
  pendente: boolean;
  estilo: string;
  remarcada: string | null;
  /** Motivo para o lembrete estar desabilitado, ou null. */
  semLembrete: string | null;
}

@Component({
  selector: "app-tabela",
  imports: [IconeWhatsappComponent, LucidePencil, LucideTrash],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./tabela.component.html",
})
export class TabelaComponent {
  readonly itens = input.required<Avaliacao[]>();
  readonly hoje = input.required<string>();
  readonly agruparPorData = input(false);
  readonly lembrete = output<Avaliacao>();
  readonly editar = output<Avaliacao>();
  readonly excluir = output<Avaliacao>();
  readonly situacao = output<MudancaSituacao>();
  readonly remarcar = output<Avaliacao>();

  protected readonly linhas = computed<Linha[]>(() => {
    const hoje = this.hoje();
    const amanha = somarDias(hoje, 1);
    return this.itens().map((a, i, todos) => {
      const passou = a.data < hoje;
      return {
        a,
        grupo:
          this.agruparPorData() && todos[i - 1]?.data !== a.data
            ? `${diaDaSemana(a.data)}, ${formatarData(a.data)}`
            : null,
        data: formatarData(a.data),
        semana: diaDaSemana(a.data),
        telefone: formatarTelefone(a.whatsapp),
        dia: a.data === hoje ? "hoje" : a.data === amanha ? "amanha" : null,
        passou,
        futura: a.data > hoje,
        pendente: pendente(a, hoje),
        estilo: ESTILOS[pendente(a, hoje) ? "pendente" : a.situacao],
        remarcada: a.remarcadaDe ? this.textoRemarcada(a) : null,
        semLembrete: passou
          ? "Esta avaliação já passou. Não há lembrete a enviar."
          : a.situacao !== "agendada"
            ? "Só avaliações agendadas recebem lembrete."
            : null,
      };
    });
  });

  /**
   * O select volta para a situação gravada na hora; a nova só aparece quando o
   * servidor confirmar (a lista é recarregada). "Remarcar…" abre a janela de remarcação.
   */
  protected escolher(a: Avaliacao, campo: HTMLSelectElement) {
    const escolhida = campo.value;
    campo.value = a.situacao;
    if (escolhida === "remarcar") this.remarcar.emit(a);
    else if (situacaoValida(escolhida) && escolhida !== a.situacao) {
      this.situacao.emit({ avaliacao: a, situacao: escolhida });
    }
  }

  private textoRemarcada(a: Avaliacao): string {
    const [data = "", horario = ""] = (a.remarcadaDe ?? "").split(" ");
    const vezes = a.remarcacoes > 1 ? ` ${a.remarcacoes}x` : "";
    return `Remarcada${vezes} · era ${formatarData(data).slice(0, 5)} às ${horario}`;
  }
}
