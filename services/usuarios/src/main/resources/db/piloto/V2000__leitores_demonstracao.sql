INSERT INTO usuarios (id, nome, matricula, email, cadastrado_em)
SELECT 'USR-' || lpad((700 + n)::text, 4, '0'),
       (ARRAY['Lia', 'Bento', 'Iara', 'Caio', 'Nina', 'Ravi'])[1 + (n-1) % 6]
           || ' ' || (ARRAY['Prado', 'Mota', 'Reis', 'Luz', 'Lima', 'Vaz'])[1 + (n-1) / 6] || ' (Demo)',
       'DEMO-' || lpad(n::text, 3, '0'),
       'leitor-' || n || '@example.invalid',
       (now() AT TIME ZONE 'America/Sao_Paulo')::date - (70 + n)
FROM generate_series(1, 36) AS leitores(n);
