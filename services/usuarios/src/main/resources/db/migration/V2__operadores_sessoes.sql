CREATE TABLE operadores (
    id         UUID         PRIMARY KEY,
    email      VARCHAR(160) NOT NULL,
    nome       VARCHAR(120) NOT NULL,
    senha_hash VARCHAR(255) NOT NULL,
    papel      VARCHAR(32)  NOT NULL,
    ativo      BOOLEAN      NOT NULL DEFAULT TRUE,
    criado_em  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT uq_operadores_email UNIQUE (email),
    CONSTRAINT ck_operadores_email_normalizado CHECK (email = lower(btrim(email))),
    CONSTRAINT ck_operadores_papel CHECK (papel IN ('ADMIN', 'BIBLIOTECARIO'))
);

CREATE TABLE sessoes_operador (
    id          UUID        PRIMARY KEY,
    operador_id UUID        NOT NULL REFERENCES operadores (id),
    token_hash  CHAR(64)    NOT NULL,
    criado_em   TIMESTAMPTZ NOT NULL DEFAULT now(),
    expira_em   TIMESTAMPTZ NOT NULL,
    revogado_em TIMESTAMPTZ,
    CONSTRAINT uq_sessoes_operador_token_hash UNIQUE (token_hash),
    CONSTRAINT ck_sessoes_operador_token_hash CHECK (token_hash ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_sessoes_operador_expiracao CHECK (expira_em > criado_em)
);

CREATE INDEX ix_sessoes_operador_ativas ON sessoes_operador (operador_id, expira_em) WHERE revogado_em IS NULL;
CREATE INDEX ix_sessoes_operador_expira_em ON sessoes_operador (expira_em);
