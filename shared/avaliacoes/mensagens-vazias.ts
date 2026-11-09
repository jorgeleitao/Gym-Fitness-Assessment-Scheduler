import { formatarData, somarDias } from "./formato";

export interface MensagemVazia {
  titulo: string;
  texto: string;
}

export function mensagemDiaVazio(data: string, hoje: string): MensagemVazia {
  if (data === hoje) {
    return {
      titulo: "Ops! Cadê as avaliações de hoje? 👀",
      texto:
        "Hoje não temos nenhuma avaliação cadastrada. Vamos que vamos! Bora correr atrás de novas matrículas e preencher esse painel!",
    };
  }
  if (data === somarDias(hoje, 1)) {
    return {
      titulo: "Amanhã ainda está livre!",
      texto: `Nenhuma avaliação marcada para amanhã (${formatarData(data)}). Que tal já chamar alguém para agendar?`,
    };
  }
  if (data > hoje) {
    return {
      titulo: "Agenda livre por aqui!",
      texto: `Ainda não há avaliações para ${formatarData(data)}. Bora preencher esse dia com novas matrículas!`,
    };
  }
  if (data === somarDias(hoje, -1)) {
    return {
      titulo: "Ontem foi tranquilo",
      texto: `Não houve nenhuma avaliação em ${formatarData(data)}. Bola pra frente, o foco agora é nos próximos dias!`,
    };
  }
  return {
    titulo: "Nada por aqui nesse dia",
    texto: `Não houve nenhuma avaliação em ${formatarData(data)}. Bola pra frente, o foco agora é nos próximos dias!`,
  };
}
