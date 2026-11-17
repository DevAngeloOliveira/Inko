CREATE SEQUENCE IF NOT EXISTS usuarios_seq START WITH 1000;

CREATE TABLE IF NOT EXISTS usuarios (
    id            VARCHAR(16)  PRIMARY KEY,
    nome          VARCHAR(120) NOT NULL,
    matricula     VARCHAR(20)  NOT NULL,
    email         VARCHAR(160),
    cadastrado_em DATE         NOT NULL DEFAULT CURRENT_DATE,
    CONSTRAINT uq_usuarios_matricula UNIQUE (matricula),
    CONSTRAINT uq_usuarios_email UNIQUE (email),
    CONSTRAINT ck_usuarios_id CHECK (id ~ '^USR-[0-9]{4,}$')
);
