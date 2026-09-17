// Utilitário local (não roda na VPS): lê um workflow JSON e gera um SQL de
// UPDATE direto em workflow_entity.nodes/connections. Necessário porque
// `n8n import:workflow` não atualiza um workflow que já existe e está
// ativo nesta instância — confirmado na prática em 2026-09-17
// (workflow_entity.nodes e a workflow_history apontada por
// activeVersionId continuaram com o conteúdo antigo mesmo depois do
// import reportar sucesso).
//
// Uso: node gerar_fix_sql.js <arquivo-do-workflow.json> <workflow-id> <arquivo-saida.sql>
const fs = require('fs');

const [, , inputPath, workflowId, outputPath] = process.argv;
const wf = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
const nodesJson = JSON.stringify(wf.nodes);
const connJson = JSON.stringify(wf.connections);

const sql = [
    '-- Gerado por gerar_fix_sql.js a partir de ' + inputPath,
    '-- Rodar a reativação (bloco DO $$ de sempre) logo depois, pra gerar',
    '-- uma workflow_history nova a partir deste conteúdo.',
    'UPDATE workflow_entity',
    'SET nodes = $json$' + nodesJson + '$json$::json,',
    '    connections = $json$' + connJson + '$json$::json',
    "WHERE id = '" + workflowId + "';",
    '',
].join('\n');

fs.writeFileSync(outputPath, sql, 'utf8');
console.log('Gerado ' + outputPath + ' (' + sql.length + ' bytes)');
