INSERT INTO usuarios (id, nome, matricula, email, cadastrado_em) VALUES
    ('USR-0142', 'Rafael Moura', '2025014', 'rafael.moura@exemplo.com', DATE '2025-03-14'),
    ('USR-0087', 'Beatriz Moraes', '2024087', 'bia.moraes@exemplo.com', DATE '2024-11-02'),
    ('USR-0203', 'Lia Sato', '2025203', 'lia.sato@exemplo.com', DATE '2025-08-21'),
    ('USR-0031', 'Lucas Almeida', '2024031', 'lucas.almeida@exemplo.com', DATE '2024-05-09'),
    ('USR-0110', 'Davi Nogueira', '2025110', 'davi.n@exemplo.com', DATE '2025-01-27'),
    ('USR-0175', 'Helena Vaz', '2025175', 'helena.vaz@exemplo.com', DATE '2025-06-03'),
    ('USR-0218', 'Paulo Ikeda', '2026218', 'paulo.ikeda@exemplo.com', DATE '2026-02-11'),
    ('USR-0226', 'Marina Lopes', '2026226', 'marina.lopes@exemplo.com', DATE '2026-04-30')
ON CONFLICT DO NOTHING;
