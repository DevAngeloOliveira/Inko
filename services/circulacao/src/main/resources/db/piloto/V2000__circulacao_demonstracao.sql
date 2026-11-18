WITH amostra AS (
    SELECT n,
           (now() AT TIME ZONE 'America/Sao_Paulo')::date AS hoje,
           CASE WHEN n <= 20 THEN 18 + n % 7
                WHEN n <= 40 THEN 1 + n % 5
                ELSE 30 + n % 10 END AS dias_desde_emprestimo
    FROM generate_series(1, 60) AS linha(n)
)
INSERT INTO emprestimos (id, livro_id, usuario_id, data_emprestimo, data_prevista, data_devolucao)
SELECT 'EMP-' || (8000 + n)::text,
       'INK-' || (3000 + n)::text,
       'USR-' || lpad((701 + (n-1) % 36)::text, 4, '0'),
       hoje - dias_desde_emprestimo, hoje - dias_desde_emprestimo + 14,
       CASE WHEN n > 40 THEN hoje - dias_desde_emprestimo + 10 END
FROM amostra;
