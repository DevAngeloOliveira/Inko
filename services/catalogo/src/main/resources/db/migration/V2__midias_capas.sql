CREATE TABLE capas_livros (
    id            UUID         PRIMARY KEY,
    livro_id      VARCHAR(16)  NOT NULL REFERENCES livros(id),
    object_key    VARCHAR(128) NOT NULL,
    mime_type     VARCHAR(32)  NOT NULL,
    tamanho_bytes INTEGER      NOT NULL,
    sha256        CHAR(64)     NOT NULL,
    largura       INTEGER      NOT NULL,
    altura        INTEGER      NOT NULL,
    criado_em     TIMESTAMPTZ  NOT NULL DEFAULT now(),
    atualizado_em TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT uq_capas_livros_livro UNIQUE (livro_id),
    CONSTRAINT uq_capas_livros_object_key UNIQUE (object_key),
    CONSTRAINT ck_capas_livros_object_key CHECK (object_key ~ '^[0-9a-f-]{36}\.(jpg|png)$'),
    CONSTRAINT ck_capas_livros_mime CHECK (mime_type IN ('image/jpeg', 'image/png')),
    CONSTRAINT ck_capas_livros_tamanho CHECK (tamanho_bytes > 0),
    CONSTRAINT ck_capas_livros_sha256 CHECK (sha256 ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_capas_livros_dimensoes CHECK (largura > 0 AND altura > 0)
);
