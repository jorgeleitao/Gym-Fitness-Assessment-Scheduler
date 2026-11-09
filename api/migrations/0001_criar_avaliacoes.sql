-- Versão 1: tabela de avaliações.
-- Datas no formato ISO (AAAA-MM-DD) e horários em HH:mm, sempre no horário local da academia.
-- criado_em / atualizado_em guardam data e hora completas em ISO 8601 (UTC).
CREATE TABLE IF NOT EXISTS avaliacoes (
  id                TEXT PRIMARY KEY NOT NULL,
  nome              TEXT NOT NULL CHECK (length(trim(nome)) >= 2),
  nome_busca        TEXT NOT NULL,
  whatsapp          TEXT NOT NULL CHECK (length(whatsapp) IN (10, 11) AND whatsapp NOT GLOB '*[^0-9]*'),
  data_avaliacao    TEXT NOT NULL CHECK (data_avaliacao GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'),
  horario_avaliacao TEXT NOT NULL CHECK (horario_avaliacao GLOB '[0-2][0-9]:[0-5][0-9]'),
  criado_em         TEXT NOT NULL,
  atualizado_em     TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_avaliacoes_data_horario
  ON avaliacoes (data_avaliacao, horario_avaliacao);
