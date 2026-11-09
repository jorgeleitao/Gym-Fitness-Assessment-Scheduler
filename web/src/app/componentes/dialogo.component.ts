import { afterRenderEffect, ChangeDetectionStrategy, Component, type ElementRef, input, output, viewChild } from "@angular/core";

/** Janela modal com o <dialog> nativo: foco preso, Esc e clique fora fecham. */
@Component({
  selector: "app-dialogo",
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dialog
      #dialogo
      class="dialogo"
      [attr.aria-labelledby]="idTitulo()"
      (cancel)="$event.preventDefault(); fechar.emit()"
      (click)="cliqueFora($event, dialogo)"
    >
      @if (aberto()) {
        <ng-content />
      }
    </dialog>
  `,
})
export class DialogoComponent {
  readonly aberto = input.required<boolean>();
  readonly idTitulo = input<string>();
  readonly fechar = output<void>();

  private readonly dialogo = viewChild.required<ElementRef<HTMLDialogElement>>("dialogo");

  protected cliqueFora(evento: MouseEvent, dialogo: HTMLDialogElement) {
    if (evento.target === dialogo) this.fechar.emit();
  }

  constructor() {
    afterRenderEffect(() => {
      const el = this.dialogo().nativeElement;
      if (this.aberto() && !el.open) el.showModal();
      if (!this.aberto() && el.open) el.close();
    });
  }
}
