import { ChangeDetectionStrategy, Component, inject, signal } from "@angular/core";
import { Title } from "@angular/platform-browser";

import { PainelComponent } from "./avaliacoes/painel.component";
import { BarraTopoComponent } from "./componentes/barra-topo.component";
import { ApiService, mensagemDaApi } from "./nucleo/api.service";
import { AvisosComponent } from "./nucleo/avisos";

@Component({
  selector: "app-raiz",
  imports: [AvisosComponent, BarraTopoComponent, PainelComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen">
      <app-barra-topo [nome]="nome()" />
      @if (erro(); as erro) {
        <div class="mx-auto max-w-xl px-6 py-24 text-center">
          <h1 class="text-xl font-bold">Não foi possível conectar ao servidor</h1>
          <p class="mt-2 text-muted-foreground">{{ erro }}</p>
          <p class="mt-4 text-sm text-muted-foreground">
            Confira se a API está rodando (npm start) e recarregue a página.
          </p>
        </div>
      } @else if (pronto()) {
        <app-painel />
      } @else {
        <p class="py-24 text-center text-muted-foreground" aria-busy="true">Carregando…</p>
      }
      <app-avisos />
    </div>
  `,
})
export class RaizComponent {
  protected readonly nome = signal("");
  protected readonly pronto = signal(false);
  protected readonly erro = signal<string | null>(null);

  constructor() {
    const titulo = inject(Title);
    inject(ApiService)
      .cliente()
      .then((c) => {
        this.nome.set(c.nome);
        titulo.setTitle(`${c.nomeCurto} — Painel de Avaliações`);
        this.pronto.set(true);
      })
      .catch((e) => this.erro.set(mensagemDaApi(e)));
  }
}
