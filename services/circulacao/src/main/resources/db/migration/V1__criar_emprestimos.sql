CREATE SEQUENCE IF NOT EXISTS emprestimos_seq START WITH 10500;

CREATE TABLE IF NOT EXISTS emprestimos (
    id              VARCHAR(20) PRIMARY KEY,
    livro_id        VARCHAR(16) NOT NULL,
    usuario_id      VARCHAR(16) NOT NULL,
    data_emprestimo DATE        NOT NULL,
    data_prevista   DATE        NOT NULL,
    data_devolucao  DATE,
    registrado_em   TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_emprestimos_prazo CHECK (data_prevista > data_emprestimo),
    CONSTRAINT ck_emprestimos_devolucao CHECK (data_devolucao IS NULL OR data_devolucao >= data_emprestimo)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_emprestimo_ativo_livro
    ON emprestimos (livro_id)
    WHERE data_devolucao IS NULL;

CREATE INDEX IF NOT EXISTS ix_emprestimos_usuario ON emprestimos (usuario_id);
