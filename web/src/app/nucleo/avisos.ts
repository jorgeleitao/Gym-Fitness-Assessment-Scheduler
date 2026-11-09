import { ChangeDetectionStrategy, Component, inject, Injectable, signal } from "@angular/core";
import { LucideCircleCheck, LucideCircleX, LucideInfo, LucideX } from "@lucide/angular";

type Tipo = "sucesso" | "erro" | "info";

interface Aviso {
  id: number;
  tipo: Tipo;
  titulo: string;
  descricao?: string;
}

/** Notificações curtas no topo da tela. */
@Injectable({ providedIn: "root" })
export class Avisos {
  readonly lista = signal<Aviso[]>([]);
  private proximo = 1;

  sucesso(titulo: string, descricao?: string, duracao = 5000) {
    this.mostrar("sucesso", titulo, descricao, duracao);
  }

  erro(titulo: string, descricao?: string, duracao = 8000) {
    this.mostrar("erro", titulo, descricao, duracao);
  }

  info(titulo: string, descricao?: string, duracao = 8000) {
    this.mostrar("info", titulo, descricao, duracao);
  }

  fechar(id: number) {
    this.lista.update((l) => l.filter((a) => a.id !== id));
  }

  private mostrar(tipo: Tipo, titulo: string, descricao: string | undefined, duracao: number) {
    const id = this.proximo++;
    this.lista.update((l) => [...l.slice(-2), { id, tipo, titulo, descricao }]);
    setTimeout(() => this.fechar(id), duracao);
  }
}

@Component({
  selector: "app-avisos",
  imports: [LucideCircleCheck, LucideCircleX, LucideInfo, LucideX],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="pointer-events-none fixed inset-x-0 top-4 z-[60] flex flex-col items-center gap-2 px-4" aria-live="polite">
      @for (a of avisos.lista(); track a.id) {
        <div
          data-aviso
          [attr.role]="a.tipo === 'erro' ? 'alert' : 'status'"
          class="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border p-4 text-sm shadow-lg"
          [class]="cores[a.tipo]"
        >
          @switch (a.tipo) {
            @case ("sucesso") { <svg lucideCircleCheck class="mt-0.5 size-5 shrink-0"></svg> }
            @case ("erro") { <svg lucideCircleX class="mt-0.5 size-5 shrink-0"></svg> }
            @default { <svg lucideInfo class="mt-0.5 size-5 shrink-0"></svg> }
          }
          <div class="min-w-0 flex-1">
            <p class="font-semibold">{{ a.titulo }}</p>
            @if (a.descricao) {
              <p class="mt-0.5 break-words opacity-90">{{ a.descricao }}</p>
            }
          </div>
          <button type="button" class="cursor-pointer opacity-60 hover:opacity-100" aria-label="Fechar aviso" (click)="avisos.fechar(a.id)">
            <svg lucideX class="size-4"></svg>
          </button>
        </div>
      }
    </div>
  `,
})
export class AvisosComponent {
  protected readonly avisos = inject(Avisos);
  protected readonly cores: Record<Tipo, string> = {
    sucesso: "border-green-200 bg-green-50 text-green-800",
    erro: "border-red-200 bg-red-50 text-red-800",
    info: "border-sky-200 bg-sky-50 text-sky-900",
  };
}
