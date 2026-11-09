import { ChangeDetectionStrategy, Component, effect, input, output, signal, untracked } from "@angular/core";

import { formatarData } from "../../../../shared/avaliacoes/formato";
import type { Avaliacao } from "../../../../shared/avaliacoes/tipos";
import { DialogoComponent } from "../componentes/dialogo.component";

@Component({
  selector: "app-remarcar",
  imports: [DialogoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-dialogo [aberto]="!!avaliacao()" idTitulo="remarcar-titulo" (fechar)="fechar.emit()">
      @if (avaliacao(); as a) {
        <h2 id="remarcar-titulo" class="text-xl font-semibold">Remarcar avaliação</h2>
        <p class="mt-1 text-sm text-muted-foreground">
          {{ a.nome }} — hoje marcada para {{ formatarData(a.data) }} às {{ a.horario }}.
        </p>

        <form class="mt-5 space-y-5" novalidate (submit)="$event.preventDefault(); enviar()">
          <div class="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div class="space-y-2">
              <label for="remarcar-data" class="text-sm font-semibold">Nova data</label>
              <input id="remarcar-data" type="date" class="campo" [min]="hoje()" [value]="data()" (input)="data.set($any($event.target).value)" />
            </div>
            <div class="space-y-2">
              <label for="remarcar-horario" class="text-sm font-semibold">Novo horário</label>
              <input id="remarcar-horario" type="time" class="campo" [value]="horario()" (input)="horario.set($any($event.target).value)" />
            </div>
          </div>
          @if (erro()) {
            <p role="alert" class="text-sm font-medium text-destructive">{{ erro() }}</p>
          }
          <div class="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <button type="button" class="btn btn-lg btn-contorno" (click)="fechar.emit()">Cancelar</button>
            <button type="submit" class="btn btn-lg btn-primario" [disabled]="salvando()">
              {{ salvando() ? "Remarcando…" : "Remarcar" }}
            </button>
          </div>
        </form>
      }
    </app-dialogo>
  `,
})
export class RemarcarComponent {
  readonly avaliacao = input<Avaliacao | null>(null);
  readonly hoje = input.required<string>();
  /** Retorna a mensagem de erro, ou null quando deu certo. */
  readonly remarcar = input.required<(nova: { data: string; horario: string }) => Promise<string | null>>();
  readonly fechar = output<void>();

  protected readonly data = signal("");
  protected readonly horario = signal("");
  protected readonly erro = signal<string | null>(null);
  protected readonly salvando = signal(false);
  protected readonly formatarData = formatarData;

  constructor() {
    effect(() => {
      const a = this.avaliacao();
      if (!a) return;
      untracked(() => {
        const hoje = this.hoje();
        this.data.set(a.data >= hoje ? a.data : hoje);
        this.horario.set(a.horario);
        this.erro.set(null);
        this.salvando.set(false);
      });
    });
  }

  protected async enviar() {
    if (this.salvando()) return;
    if (!this.data() || !this.horario()) {
      this.erro.set("Escolha a nova data e o novo horário.");
      return;
    }
    this.salvando.set(true);
    try {
      const erro = await this.remarcar()({ data: this.data(), horario: this.horario() });
      if (erro) this.erro.set(erro);
      else this.fechar.emit();
    } finally {
      this.salvando.set(false);
    }
  }
}
