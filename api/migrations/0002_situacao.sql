-- Versão 2: o que aconteceu com a avaliação e histórico de remarcação.
ALTER TABLE avaliacoes ADD COLUMN situacao TEXT NOT NULL DEFAULT 'agendada'
  CHECK (situacao IN ('agendada', 'compareceu', 'faltou', 'cancelada'));

ALTER TABLE avaliacoes ADD COLUMN remarcacoes INTEGER NOT NULL DEFAULT 0
  CHECK (remarcacoes >= 0);

-- Data e horário antes da última remarcação ("AAAA-MM-DD HH:mm").
ALTER TABLE avaliacoes ADD COLUMN remarcada_de TEXT
  CHECK (remarcada_de IS NULL OR remarcada_de GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9] [0-2][0-9]:[0-5][0-9]');

CREATE INDEX IF NOT EXISTS idx_avaliacoes_situacao ON avaliacoes (situacao, data_avaliacao);
