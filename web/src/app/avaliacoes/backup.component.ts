import { CdkMenu, CdkMenuItem, CdkMenuTrigger } from "@angular/cdk/menu";
import { ChangeDetectionStrategy, Component, inject, input, output, signal } from "@angular/core";
import { LucideDownload, LucideEllipsisVertical, LucideFolderOpen, LucideUpload } from "@lucide/angular";

import { ConfirmarComponent } from "../componentes/confirmar.component";
import { ApiService, mensagemDaApi } from "../nucleo/api.service";
import { Avisos } from "../nucleo/avisos";

@Component({
  selector: "app-backup",
  imports: [
    CdkMenu,
    CdkMenuItem,
    CdkMenuTrigger,
    ConfirmarComponent,
    LucideDownload,
    LucideEllipsisVertical,
    LucideFolderOpen,
    LucideUpload,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button type="button" class="btn btn-xl btn-contorno px-4" [disabled]="ocupado()" [cdkMenuTriggerFor]="menu">
      <svg lucideEllipsisVertical></svg>
      Backup
    </button>

    <ng-template #menu>
      <div class="menu" cdkMenu>
        <p class="px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cópia de segurança</p>
        <button type="button" class="menu-item" cdkMenuItem (cdkMenuItemTriggered)="baixar()">
          <svg lucideDownload></svg> Fazer backup (baixar arquivo)
        </button>
        <hr class="my-1" />
        <button type="button" class="menu-item" cdkMenuItem (cdkMenuItemTriggered)="arquivo.click()">
          <svg lucideUpload></svg> Restaurar backup
        </button>
        <hr class="my-1" />
        <button type="button" class="menu-item" cdkMenuItem (cdkMenuItemTriggered)="mostrarLocal()">
          <svg lucideFolderOpen></svg> Onde ficam os dados?
        </button>
      </div>
    </ng-template>

    <input #arquivo type="file" accept=".db" class="hidden" data-testid="arquivo-backup" (change)="escolher(arquivo)" />

    <app-confirmar
      [aberto]="pendente() !== null"
      titulo="Restaurar backup?"
      textoConfirmar="Restaurar e substituir"
      [perigoso]="totalAtual() > 0"
      [ocupado]="ocupado()"
      (confirmar)="restaurar()"
      (cancelar)="cancelar()"
    >
      O backup contém <strong>{{ pendente()?.total ?? 0 }}</strong> avaliação(ões). Elas vão
      <strong>substituir</strong> as {{ totalAtual() }} avaliação(ões) cadastradas agora. Uma cópia dos dados atuais
      será guardada automaticamente antes.
    </app-confirmar>
  `,
})
export class BackupComponent {
  readonly totalAtual = input(0);
  readonly restaurado = output<void>();

  private readonly api = inject(ApiService);
  private readonly avisos = inject(Avisos);
  protected readonly pendente = signal<{ arquivo: File; total: number } | null>(null);
  protected readonly ocupado = signal(false);

  protected async baixar() {
    try {
      const { nome, arquivo } = await this.api.baixarBackup();
      const url = URL.createObjectURL(arquivo);
      const link = Object.assign(document.createElement("a"), { href: url, download: nome });
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      this.avisos.sucesso("Backup gerado!", `${nome} — guarde em um pendrive ou na nuvem.`, 10_000);
    } catch (e) {
      this.avisos.erro("Não foi possível gerar o backup.", mensagemDaApi(e));
    }
  }

  protected async escolher(input: HTMLInputElement) {
    const arquivo = input.files?.[0];
    input.value = "";
    if (!arquivo) return;
    try {
      const { total } = await this.api.inspecionarBackup(arquivo);
      this.pendente.set({ arquivo, total });
    } catch (e) {
      this.avisos.erro("Este arquivo não pode ser usado como backup.", mensagemDaApi(e));
    }
  }

  protected async restaurar() {
    const pendente = this.pendente();
    if (!pendente) return;
    this.ocupado.set(true);
    try {
      const { total, copiaSeguranca } = await this.api.restaurarBackup(pendente.arquivo);
      this.avisos.sucesso(
        "Backup restaurado!",
        `${total} avaliação(ões) carregada(s). Os dados anteriores foram guardados em: ${copiaSeguranca}`,
        15_000,
      );
      this.restaurado.emit();
    } catch (e) {
      this.avisos.erro(
        "Não foi possível restaurar o backup. Seus dados atuais não foram alterados.",
        mensagemDaApi(e),
        15_000,
      );
    } finally {
      this.ocupado.set(false);
      this.pendente.set(null);
    }
  }

  protected cancelar() {
    if (!this.ocupado()) this.pendente.set(null);
  }

  protected async mostrarLocal() {
    try {
      const { arquivo } = await this.api.localDosDados();
      this.avisos.info("Os dados ficam salvos em:", arquivo, 15_000);
    } catch (e) {
      this.avisos.erro(mensagemDaApi(e));
    }
  }
}
