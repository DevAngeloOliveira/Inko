CREATE TABLE capa_objetos (
    chave VARCHAR(128) PRIMARY KEY,
    conteudo BYTEA NOT NULL CHECK (octet_length(conteudo) BETWEEN 1 AND 2097152)
);
