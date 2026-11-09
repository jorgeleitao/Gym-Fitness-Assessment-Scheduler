import { ChangeDetectionStrategy, Component, computed, ElementRef, inject, input, output, signal } from "@angular/core";
import { LucideCalendarDays, LucideChevronLeft, LucideChevronRight } from "@lucide/angular";

import { diaDaSemana, formatarData, somarDias } from "../../../../shared/avaliacoes/formato";
import { CalendarioComponent } from "./calendario.component";

@Component({
  selector: "app-seletor-data",
  imports: [CalendarioComponent, LucideCalendarDays, LucideChevronLeft, LucideChevronRight],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    "(document:click)": "fecharSeFora($event)",
    "(document:keydown.escape)": "aberto.set(false)",
  },
  template: `
    <div class="flex items-center gap-1.5">
      <button type="button" class="btn btn-icone btn-contorno h-11 w-11 rounded-xl" aria-label="Dia anterior" (click)="mudar.emit(anterior())">
        <svg lucideChevronLeft></svg>
      </button>

      <div class="relative">
        <button
          type="button"
          class="btn btn-contorno h-11 min-w-[200px] justify-start gap-3 rounded-xl px-3.5 text-left"
          [class.border-primary]="ativo()"
          [class.ring-1]="ativo()"
          [class.ring-primary]="ativo()"
          aria-label="Escolher data no calendário"
          [attr.aria-expanded]="aberto()"
          (click)="aberto.set(!aberto())"
        >
          <svg lucideCalendarDays class="text-primary"></svg>
          <span class="flex flex-col leading-tight">
            <span class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{{ rotulo() }}</span>
            <span class="font-semibold tabular-nums">{{ dataFormatada() }}</span>
          </span>
        </button>

        @if (aberto()) {
          <div class="absolute left-0 top-full z-40 mt-2 rounded-2xl border bg-popover shadow-lg">
            <app-calendario [selecionada]="data()" [hoje]="hoje()" (escolher)="escolher($event)" />
            <div class="border-t p-2">
              <button type="button" class="btn btn-md btn-fantasma w-full" (click)="escolher(hoje())">Ir para hoje</button>
            </div>
          </div>
        }
      </div>

      <button type="button" class="btn btn-icone btn-contorno h-11 w-11 rounded-xl" aria-label="Próximo dia" (click)="mudar.emit(proximo())">
        <svg lucideChevronRight></svg>
      </button>
    </div>
  `,
})
export class SeletorDataComponent {
  readonly data = input.required<string>();
  readonly hoje = input.required<string>();
  readonly ativo = input(true);
  readonly mudar = output<string>();

  protected readonly aberto = signal(false);
  private readonly elemento = inject(ElementRef<HTMLElement>);

  protected readonly anterior = computed(() => somarDias(this.data(), -1));
  protected readonly proximo = computed(() => somarDias(this.data(), 1));
  protected readonly dataFormatada = computed(() => formatarData(this.data()));
  protected readonly rotulo = computed(() => {
    const [data, hoje] = [this.data(), this.hoje()];
    if (data === hoje) return "Hoje";
    if (data === somarDias(hoje, 1)) return "Amanhã";
    if (data === somarDias(hoje, -1)) return "Ontem";
    return diaDaSemana(data);
  });

  protected escolher(data: string) {
    this.aberto.set(false);
    this.mudar.emit(data);
  }

  protected fecharSeFora(evento: MouseEvent) {
    if (this.aberto() && !this.elemento.nativeElement.contains(evento.target as Node)) this.aberto.set(false);
  }
}
