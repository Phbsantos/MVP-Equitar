// Nó Code (JavaScript) — n8n
// Posição no workflow: Webhook  →  [ESTE NÓ]  →  Airtable "Search"/"List records"
// No nó Airtable, em "Filter by Formula", usar a expressão:
//     {{ $json.filterByFormula }}
//
// O que faz: lê os query params recebidos no webhook de /listar/atendimentos
// (?terapeuta=, ?paciente_nome=, ?data=, ?data_inicio=, ?data_fim=,
// ?status_presenca=) e monta uma fórmula do Airtable equivalente, combinando
// todos os filtros presentes com AND(). Se nenhum parâmetro vier, devolve
// TRUE() — ou seja, sem filtro nenhum, continua trazendo tudo, exatamente
// como o endpoint já se comporta hoje.
//
// Nomes de campo usados (confirmados na tabela Atendimentos real):
// Data_Hora, Status_Presenca (campos próprios) e os LOOKUPS
// "Nome (from Terapeuta_Nome)" / "Nome_Completo (from Paciente_Nome)" —
// os campos de link puros (Terapeuta_Nome/Paciente_Nome) NÃO resolvem pro
// texto em fórmula nesta base (testado); é preciso usar o lookup mesmo.

// Escapa aspas duplas e barras invertidas antes de embutir um valor vindo
// do usuário dentro de uma string de fórmula do Airtable — sem isso, um
// paciente com aspas no nome (ou alguém digitando de propósito) quebra a
// fórmula ou, pior, injeta lógica nela.
function escaparParaFormula(valor) {
    return String(valor).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

// Compara um campo de data/hora (Data_Hora) contra um dia específico,
// ignorando a hora. IS_SAME com granularidade 'day' já lida com isso sem
// precisar montar um intervalo manual de 00:00 a 23:59.
function clausulaDataExata(campo, valorISO) {
    return `IS_SAME({${campo}}, "${escaparParaFormula(valorISO)}", 'day')`;
}

// Filtro por nome via campo de LOOKUP (não o link puro — testado que o
// link puro não resolve pro texto em fórmula nesta base). ARRAYJOIN +
// SEARCH porque um lookup também devolve array. Comparação em minúsculas
// pra não depender de capitalização exata.
function clausulaNomeEmLink(campo, nome) {
    const nomeEscapado = escaparParaFormula(nome).toLowerCase();
    return `SEARCH("${nomeEscapado}", LOWER(ARRAYJOIN({${campo}}))) > 0`;
}

function clausulaIgualdadeTexto(campo, valor) {
    return `{${campo}} = "${escaparParaFormula(valor)}"`;
}

function construirFiltro(query) {
    const clausulas = [];

    if (query.terapeuta) {
        clausulas.push(clausulaNomeEmLink('Nome (from Terapeuta_Nome)', query.terapeuta));
    }

    if (query.paciente_nome) {
        clausulas.push(clausulaNomeEmLink('Nome_Completo (from Paciente_Nome)', query.paciente_nome));
    }

    if (query.status_presenca) {
        clausulas.push(clausulaIgualdadeTexto('Status_Presenca', query.status_presenca));
    }

    // ?data= é um dia exato; ?data_inicio=/?data_fim= é um intervalo.
    // Se vier ?data=, ele tem prioridade e ignora data_inicio/data_fim,
    // pra não montar uma combinação contraditória sem querer.
    if (query.data) {
        clausulas.push(clausulaDataExata('Data_Hora', query.data));
    } else {
        if (query.data_inicio) {
            clausulas.push(`IS_AFTER({Data_Hora}, "${escaparParaFormula(query.data_inicio)}T00:00:00.000-03:00")`);
        }
        if (query.data_fim) {
            clausulas.push(`IS_BEFORE({Data_Hora}, "${escaparParaFormula(query.data_fim)}T23:59:59.999-03:00")`);
        }
    }

    if (clausulas.length === 0) return 'TRUE()';
    if (clausulas.length === 1) return clausulas[0];
    return `AND(${clausulas.join(', ')})`;
}

// n8n roda este bloco uma vez por item de entrada (modo padrão "Run Once
// for Each Item"). Para um webhook GET normal, é só 1 item mesmo.
for (const item of $input.all()) {
    // O nó Webhook do n8n expõe a query string em item.json.query.
    const query = item.json.query || {};
    item.json.filterByFormula = construirFiltro(query);
}

return $input.all();
