import { HttpClient, HttpErrorResponse, HttpParams } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { firstValueFrom, type Observable } from "rxjs";

import type { Avaliacao, AvaliacaoInput, Contadores, Situacao } from "../../../../shared/avaliacoes/tipos";

export interface DadosCliente {
  id: string;
  nome: string;
  nomeCurto: string;
  produto: string;
  versao: string;
}

export type Visao = { tipo: "dia"; data: string } | { tipo: "busca"; termo: string };

/** Erros da API chegam como { mensagem }. */
export function mensagemDaApi(erro: unknown): string {
  if (erro instanceof HttpErrorResponse) {
    const mensagem = (erro.error as { mensagem?: unknown } | null)?.mensagem;
    if (typeof mensagem === "string") return mensagem;
    if (erro.status === 0) return "Não foi possível falar com o servidor. Ele está rodando?";
    return `Erro ${erro.status}.`;
  }
  if (erro instanceof Error && erro.message) return erro.message;
  return "Algo deu errado. Tente novamente.";
}

@Injectable({ providedIn: "root" })
export class ApiService {
  private readonly http = inject(HttpClient);

  private enviar<T>(pedido: Observable<T>): Promise<T> {
    return firstValueFrom(pedido);
  }

  cliente() {
    return this.enviar(this.http.get<DadosCliente>("/api/cliente"));
  }

  listar(visao: Visao) {
    const params =
      visao.tipo === "dia" ? new HttpParams().set("data", visao.data) : new HttpParams().set("busca", visao.termo);
    return this.enviar(this.http.get<Avaliacao[]>("/api/avaliacoes", { params }));
  }

  contadores(hoje: string) {
    return this.enviar(this.http.get<Contadores>("/api/avaliacoes/contadores", { params: { hoje } }));
  }

  criar(dados: AvaliacaoInput) {
    return this.enviar(this.http.post<Avaliacao>("/api/avaliacoes", dados));
  }

  atualizar(id: string, dados: AvaliacaoInput) {
    return this.enviar(this.http.put<void>(`/api/avaliacoes/${encodeURIComponent(id)}`, dados));
  }

  excluir(id: string) {
    return this.enviar(this.http.delete<void>(`/api/avaliacoes/${encodeURIComponent(id)}`));
  }

  marcarSituacao(id: string, situacao: Situacao, hoje: string) {
    return this.enviar(
      this.http.patch<void>(`/api/avaliacoes/${encodeURIComponent(id)}/situacao`, { situacao, hoje }),
    );
  }

  remarcar(id: string, nova: { data: string; horario: string }, hoje: string) {
    return this.enviar(
      this.http.post<Avaliacao>(`/api/avaliacoes/${encodeURIComponent(id)}/remarcar`, { ...nova, hoje }),
    );
  }

  lembrete(id: string, hoje: string) {
    return this.enviar(
      this.http.post<{ link: string }>(`/api/avaliacoes/${encodeURIComponent(id)}/lembrete`, { hoje }),
    );
  }

  async baixarBackup(): Promise<{ nome: string; arquivo: Blob }> {
    const r = await this.enviar(this.http.get("/api/backup", { observe: "response", responseType: "blob" }));
    const nome = /filename="([^"]+)"/.exec(r.headers.get("Content-Disposition") ?? "")?.[1] ?? "backup.db";
    return { nome, arquivo: r.body ?? new Blob() };
  }

  inspecionarBackup(arquivo: Blob) {
    return this.enviar(this.http.post<{ total: number }>("/api/backup/inspecionar", arquivo, this.binario()));
  }

  restaurarBackup(arquivo: Blob) {
    return this.enviar(
      this.http.post<{ total: number; copiaSeguranca: string }>("/api/backup/restaurar", arquivo, this.binario()),
    );
  }

  localDosDados() {
    return this.enviar(this.http.get<{ arquivo: string }>("/api/backup/local"));
  }

  private binario() {
    return { headers: { "Content-Type": "application/octet-stream" } };
  }
}
