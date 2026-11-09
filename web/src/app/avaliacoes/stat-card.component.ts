import { ChangeDetectionStrategy, Component, input } from "@angular/core";

@Component({
  selector: "app-stat-card",
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex items-center gap-4 rounded-2xl border bg-card p-5 shadow-[var(--shadow-card)]">
      <div class="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary [&_svg]:size-6">
        <ng-content />
      </div>
      <div class="min-w-0">
        <p class="text-sm font-medium text-muted-foreground">{{ rotulo() }}</p>
        <p class="text-3xl font-bold leading-tight tracking-tight tabular-nums">{{ valor() ?? "–" }}</p>
        @if (detalhe()) {
          <p class="truncate text-xs text-muted-foreground">{{ detalhe() }}</p>
        }
      </div>
    </div>
  `,
})
export class StatCardComponent {
  readonly rotulo = input.required<string>();
  readonly valor = input<number | string | null>(null);
  readonly detalhe = input<string>();
}
