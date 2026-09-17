-- 003_relatorio_ciencia.sql
-- Ciência de alteração de relatório: quando um Relatório de Evolução é
-- editado por alguém diferente do autor original (hoje só acontece pelo
-- botão de editar da Coordenação — ver 21_editar_relatorio.json), o autor
-- precisa ver a alteração e responder — concordar ou avisar que discorda —
-- antes de seguir usando a agenda (ver js/app.js, modal obrigatório).
--
-- Reaproveita relatorios.updated_at, que já existe e já é mantido pelo
-- trigger set_updated_at() em toda UPDATE: não precisamos de uma coluna
-- "alterado_em" própria, nem de zerar ciente_em/contestado_em na mão a
-- cada edição nova. Basta comparar as duas contra updated_at — se
-- nenhuma for mais recente que a última alteração, o item está pendente
-- de novo automaticamente (ver "precisa_ciencia" em
-- 05_listar_relatorios.json).
ALTER TABLE relatorios ADD COLUMN ciente_em TIMESTAMPTZ;
ALTER TABLE relatorios ADD COLUMN contestado_em TIMESTAMPTZ;
