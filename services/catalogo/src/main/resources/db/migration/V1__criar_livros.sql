CREATE TABLE IF NOT EXISTS livros (
    id              VARCHAR(16)  PRIMARY KEY,
    titulo          VARCHAR(160) NOT NULL,
    autor           VARCHAR(120) NOT NULL,
    categoria       VARCHAR(32)  NOT NULL,
    volume          VARCHAR(40),
    editora         VARCHAR(120),
    titulo_original VARCHAR(160),
    cadastrado_em   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT ck_livros_id CHECK (id ~ '^INK-[0-9]{4}$'),
    CONSTRAINT ck_livros_categoria CHECK (categoria IN ('Mangá', 'HQ', 'Graphic novel'))
);
