import { ChangeDetectionStrategy, Component, effect, input, output, signal, untracked } from "@angular/core";

import { formatarTelefone } from "../../../../shared/avaliacoes/formato";
import type { Avaliacao, AvaliacaoInput } from "../../../../shared/avaliacoes/tipos";
import { NOME_MAX, validarAvaliacao, type ErrosAvaliacao } from "../../../../shared/avaliacoes/validacao";
import { DialogoComponent } from "../componentes/dialogo.component";

type Campo = keyof AvaliacaoInput;

const vazio = (data: string): AvaliacaoInput => ({ nome: "", data, horario: "", whatsapp: "" });

@Component({
  selector: "app-formulario",
  imports: [DialogoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-dialogo [aberto]="aberto()" idTitulo="formulario-titulo" (fechar)="fechar.emit()">
      <h2 id="formulario-titulo" class="text-xl font-semibold">
        {{ avaliacao() ? "Editar avaliação" : "Nova avaliação" }}
      </h2>
      <p class="mt-1 text-sm text-muted-foreground">Todos os campos são obrigatórios.</p>

      <form class="mt-5 space-y-5" novalidate (submit)="$event.preventDefault(); enviar()">
        <div class="space-y-2">
          <label for="campo-nome" class="text-sm font-semibold">Nome do cliente</label>
          <input
            id="campo-nome"
            class="campo"
            autocomplete="off"
            autofocus
            placeholder="Ex.: Maria da Silva"
            [maxLength]="nomeMax"
            [value]="form().nome"
            [attr.aria-invalid]="!!erros().nome"
            (input)="alterar('nome', $any($event.target).value)"
          />
          @if (erros().nome) {
            <p role="alert" class="text-sm font-medium text-destructive">{{ erros().nome }}</p>
          }
        </div>

        <div class="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div class="space-y-2">
            <label for="campo-data" class="text-sm font-semibold">Data da avaliação</label>
            <input
              id="campo-data"
              type="date"
              class="campo"
              [value]="form().data"
              [attr.aria-invalid]="!!erros().data"
              (input)="alterar('data', $any($event.target).value)"
            />
            @if (erros().data) {
              <p role="alert" class="text-sm font-medium text-destructive">{{ erros().data }}</p>
            }
          </div>
          <div class="space-y-2">
            <label for="campo-horario" class="text-sm font-semibold">Horário</label>
            <input
              id="campo-horario"
              type="time"
              class="campo"
              [value]="form().horario"
              [attr.aria-invalid]="!!erros().horario"
              (input)="alterar('horario', $any($event.target).value)"
            />
            @if (erros().horario) {
              <p role="alert" class="text-sm font-medium text-destructive">{{ erros().horario }}</p>
            }
          </div>
        </div>

        <div class="space-y-2">
          <label for="campo-whatsapp" class="text-sm font-semibold">WhatsApp com DDD</label>
          <input
            #telefone
            id="campo-whatsapp"
            type="tel"
            inputmode="numeric"
            class="campo"
            autocomplete="off"
            placeholder="(11) 98765-4321"
            [value]="form().whatsapp"
            [attr.aria-invalid]="!!erros().whatsapp"
            (input)="alterarTelefone(telefone)"
          />
          @if (erros().whatsapp) {
            <p role="alert" class="text-sm font-medium text-destructive">{{ erros().whatsapp }}</p>
          }
        </div>

        <div class="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
          <button type="button" class="btn btn-lg btn-contorno" (click)="fechar.emit()">Cancelar</button>
          <button type="submit" class="btn btn-lg btn-primario" [disabled]="salvando()">
            {{ salvando() ? "Salvando…" : "Salvar avaliação" }}
          </button>
        </div>
      </form>
    </app-dialogo>
  `,
})
export class FormularioComponent {
  readonly aberto = input.required<boolean>();
  readonly avaliacao = input<Avaliacao | null>(null);
  readonly dataPadrao = input.required<string>();
  /** Retorna true quando salvou; o formulário então fecha. */
  readonly salvar = input.required<(dados: AvaliacaoInput) => Promise<boolean>>();
  readonly fechar = output<void>();

  protected readonly nomeMax = NOME_MAX;
  protected readonly form = signal<AvaliacaoInput>(vazio(""));
  protected readonly erros = signal<ErrosAvaliacao>({});
  protected readonly salvando = signal(false);

  constructor() {
    // Ao abrir: preenche com a avaliação em edição ou deixa em branco na data padrão.
    effect(() => {
      if (!this.aberto()) return;
      const a = this.avaliacao();
      const data = this.dataPadrao();
      untracked(() => {
        this.erros.set({});
        this.salvando.set(false);
        this.form.set(
          a ? { nome: a.nome, data: a.data, horario: a.horario, whatsapp: formatarTelefone(a.whatsapp) } : vazio(data),
        );
      });
    });
  }

  protected alterar(campo: Campo, valor: string) {
    this.form.update((f) => ({ ...f, [campo]: valor }));
    if (this.erros()[campo]) this.erros.update((e) => ({ ...e, [campo]: undefined }));
  }

  protected alterarTelefone(el: HTMLInputElement) {
    const formatado = formatarTelefone(el.value);
    el.value = formatado;
    this.alterar("whatsapp", formatado);
  }

  protected async enviar() {
    if (this.salvando()) return;
    const r = validarAvaliacao(this.form());
    if (!r.ok) {
      this.erros.set(r.erros);
      const primeiro = Object.keys(r.erros)[0];
      document.getElementById(`campo-${primeiro}`)?.focus();
      return;
    }
    this.salvando.set(true);
    try {
      if (await this.salvar()(r.dados)) this.fechar.emit();
    } finally {
      this.salvando.set(false);
    }
  }
}
