import type { RepositorioAvaliacoes } from "./repositorio";
import { exigirMudancaDeSituacao, exigirRemarcacao } from "./situacao";
import type { Avaliacao, AvaliacaoInput, Situacao } from "./tipos";
import { exigirAvaliacaoValida } from "./validacao";
import { ErroLembrete, gerarLinkWhatsApp, type MensagensLembrete } from "./whatsapp";

export class NaoEncontrada extends Error {}

export interface DependenciasServico {
  repo: RepositorioAvaliacoes;
  mensagens: MensagensLembrete;
  gerarId?: () => string;
  agora?: () => Date;
}

export function criarServicoAvaliacoes({
  repo,
  mensagens,
  gerarId = () => crypto.randomUUID(),
  agora = () => new Date(),
}: DependenciasServico) {
  async function buscar(id: string): Promise<Avaliacao> {
    const a = await repo.buscarPorId(id);
    if (!a) throw new NaoEncontrada("Esta avaliação não existe mais. Atualize a lista.");
    return a;
  }

  return {
    listarPorData: repo.listarPorData,
    pesquisar: repo.pesquisar,
    contadores: repo.contadores,

    async criar(input: AvaliacaoInput): Promise<Avaliacao> {
      const dados = exigirAvaliacaoValida(input);
      const momento = agora().toISOString();
      const nova: Avaliacao = {
        id: gerarId(),
        ...dados,
        situacao: "agendada",
        remarcacoes: 0,
        remarcadaDe: null,
        criadoEm: momento,
        atualizadoEm: momento,
      };
      await repo.inserir(nova);
      return nova;
    },

    async atualizar(id: string, input: AvaliacaoInput): Promise<void> {
      const dados = exigirAvaliacaoValida(input);
      const ok = await repo.atualizar(id, dados, agora().toISOString());
      if (!ok) throw new NaoEncontrada("Esta avaliação não existe mais. Atualize a lista.");
    },

    async excluir(id: string): Promise<void> {
      const ok = await repo.excluir(id);
      if (!ok) throw new NaoEncontrada("Esta avaliação já tinha sido excluída.");
    },

    async marcarSituacao(id: string, situacao: Situacao, hoje: string): Promise<void> {
      const a = await buscar(id);
      exigirMudancaDeSituacao(a, situacao, hoje);
      await repo.definirSituacao(id, situacao, agora().toISOString());
    },

    async remarcar(id: string, nova: { data: string; horario: string }, hoje: string): Promise<Avaliacao> {
      const a = await buscar(id);
      exigirRemarcacao(a, nova, hoje);
      await repo.remarcar(id, nova, `${a.data} ${a.horario}`, agora().toISOString());
      return buscar(id);
    },

    // Relê do banco para usar os dados atuais, não os que estão na tela.
    async gerarLembrete(id: string, hoje: string): Promise<string> {
      const avaliacao = await repo.buscarPorId(id);
      if (!avaliacao) throw new ErroLembrete("Esta avaliação não existe mais. Atualize a lista.");
      if (avaliacao.situacao !== "agendada") {
        throw new ErroLembrete("Só avaliações agendadas recebem lembrete.");
      }
      return gerarLinkWhatsApp(avaliacao, hoje, mensagens);
    },
  };
}

export type ServicoAvaliacoes = ReturnType<typeof criarServicoAvaliacoes>;

export function mensagemDeErro(erro: unknown): string {
  if (typeof erro === "string" && erro) return erro;
  if (erro instanceof Error && erro.message) return erro.message;
  return "Algo deu errado. Tente novamente.";
}
