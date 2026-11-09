import { ChangeDetectionStrategy, Component, computed, input, linkedSignal, output } from "@angular/core";
import { LucideChevronLeft, LucideChevronRight } from "@lucide/angular";

import { hojeISO, paraDate } from "../../../../shared/avaliacoes/formato";

const SEMANA = ["D", "S", "T", "Q", "Q", "S", "S"];
const formatoMes = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" });
const formatoDia = new Intl.DateTimeFormat("pt-BR", { dateStyle: "full" });

@Component({
  selector: "app-calendario",
  imports: [LucideChevronLeft, LucideChevronRight],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="w-[19rem] p-3">
      <div class="mb-2 flex items-center justify-between">
        <button type="button" class="btn btn-icone btn-fantasma" aria-label="Mês anterior" (click)="mudarMes(-1)">
          <svg lucideChevronLeft></svg>
        </button>
        <span class="text-sm font-semibold capitalize">{{ tituloMes() }}</span>
        <button type="button" class="btn btn-icone btn-fantasma" aria-label="Próximo mês" (click)="mudarMes(1)">
          <svg lucideChevronRight></svg>
        </button>
      </div>
      <div class="grid grid-cols-7 text-center text-xs font-semibold text-muted-foreground">
        @for (d of semana; track $index) {
          <span class="py-1">{{ d }}</span>
        }
      </div>
      <div class="grid grid-cols-7 gap-0.5" role="grid">
        @for (dia of dias(); track dia.iso) {
          <button
            type="button"
            class="h-10 cursor-pointer rounded-lg text-sm tabular-nums hover:bg-accent"
            [class.text-muted-foreground]="!dia.doMes"
            [class.ring-1]="dia.iso === hoje()"
            [class.ring-primary]="dia.iso === hoje()"
            [class.!bg-primary]="dia.iso === selecionada()"
            [class.!text-primary-foreground]="dia.iso === selecionada()"
            [class.font-semibold]="dia.iso === selecionada()"
            [attr.aria-label]="dia.rotulo"
            [attr.aria-pressed]="dia.iso === selecionada()"
            (click)="escolher.emit(dia.iso)"
          >
            {{ dia.numero }}
          </button>
        }
      </div>
    </div>
  `,
})
export class CalendarioComponent {
  readonly selecionada = input.required<string>();
  readonly hoje = input.required<string>();
  readonly escolher = output<string>();

  protected readonly semana = SEMANA;
  /** Primeiro dia do mês exibido; acompanha a data selecionada. */
  protected readonly mes = linkedSignal(() => {
    const d = paraDate(this.selecionada());
    return new Date(d.getFullYear(), d.getMonth(), 1, 12);
  });

  protected readonly tituloMes = computed(() => formatoMes.format(this.mes()));

  protected readonly dias = computed(() => {
    const inicio = this.mes();
    const primeiro = new Date(inicio);
    primeiro.setDate(1 - inicio.getDay());
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(primeiro.getFullYear(), primeiro.getMonth(), primeiro.getDate() + i, 12);
      return {
        iso: hojeISO(d),
        numero: d.getDate(),
        doMes: d.getMonth() === inicio.getMonth(),
        rotulo: formatoDia.format(d),
      };
    });
  });

  protected mudarMes(delta: number) {
    this.mes.update((m) => new Date(m.getFullYear(), m.getMonth() + delta, 1, 12));
  }
}
