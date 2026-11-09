import { ChangeDetectionStrategy, Component, input, output } from "@angular/core";

import { DialogoComponent } from "./dialogo.component";

@Component({
  selector: "app-confirmar",
  imports: [DialogoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-dialogo [aberto]="aberto()" idTitulo="confirmar-titulo" (fechar)="cancelar.emit()">
      <h2 id="confirmar-titulo" class="text-xl font-semibold">{{ titulo() }}</h2>
      <div class="mt-2 text-base text-muted-foreground"><ng-content /></div>
      <div class="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" class="btn btn-lg btn-contorno" (click)="cancelar.emit()">Cancelar</button>
        <button
          type="button"
          class="btn btn-lg"
          [class]="perigoso() ? 'btn-perigo' : 'btn-primario'"
          [disabled]="ocupado()"
          (click)="confirmar.emit()"
        >
          {{ textoConfirmar() }}
        </button>
      </div>
    </app-dialogo>
  `,
})
export class ConfirmarComponent {
  readonly aberto = input.required<boolean>();
  readonly titulo = input.required<string>();
  readonly textoConfirmar = input.required<string>();
  readonly perigoso = input(false);
  readonly ocupado = input(false);
  readonly confirmar = output<void>();
  readonly cancelar = output<void>();
}
