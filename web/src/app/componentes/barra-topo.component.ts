import { ChangeDetectionStrategy, Component, input } from "@angular/core";

@Component({
  selector: "app-barra-topo",
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav class="bg-marca-barra">
      <div class="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
        <img src="/api/cliente/logo" [alt]="nome()" class="h-9 w-auto select-none" draggable="false" />
        <span class="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">Painel de Avaliações</span>
      </div>
    </nav>
  `,
})
export class BarraTopoComponent {
  readonly nome = input("");
}
