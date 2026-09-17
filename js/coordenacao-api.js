const CoordenacaoApi = {
    // --- Atendimentos realizados + Relatórios, com Plano_Saude cruzado ---
    // Plano_Saude vive em Pacientes, não em Atendimentos nem Relatorios —
    // por isso todo fetch abaixo também busca /listar/pacientes pra montar
    // o cruzamento. Ver decisão registrada no esquema da base ("Base
    // Equitar"): o plano fica no paciente, não no atendimento.
    //
    // 2026-09-08: backend novo — o cruzamento agora é por paciente_id
    // (inteiro real, vindo de FK) em vez de por nome normalizado em
    // minúsculas. Mais exato (dois pacientes não podem colidir por nome
    // parecido) e mais simples (sem lookup Airtable pra desembrulhar).

    async fetchListar(endpointKey) {
        const url = `${CONFIG.API_BASE}${CONFIG.ENDPOINTS[endpointKey]}`;
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`Erro ao carregar dados (${response.status})`);
        }

        const data = await response.json();
        return Array.isArray(data) ? data : [];
    },

    buildPlanoMap(pacienteRecords) {
        const map = new Map();
        pacienteRecords.forEach((record) => {
            if (record.id != null) map.set(record.id, record.plano_nome || '');
        });
        return map;
    },

    transformRelatorio(record, planoMap) {
        return {
            id: record.id,
            tipo: record.tipo || 'Evolução',
            pacienteNome: record.paciente_nome || 'Paciente não informado',
            autorNome: record.autor_nome || 'Autor não informado',
            data: record.data || '',
            conteudo: record.conteudo || '',
            atendimentoId: record.atendimento_id || null,
            editadoPor: record.editado_por_nome || '',
            planoSaude: planoMap.get(record.paciente_id) || '',
        };
    },

    // Transforma um Atendimento cru, mantendo o Status_Presenca original —
    // usado pela aba Indicadores, que precisa enxergar Falta/Desmarcado/
    // Cancelado/Agendado além de Realizado (fetchAtendimentosComContexto
    // filtra pra Realizado só depois, pra montar a aba Atendimentos).
    transformAtendimentoCompleto(record, planoMap, relatorioByAtendimentoId) {
        return {
            id: record.id,
            pacienteNome: record.paciente_nome || 'Paciente não informado',
            terapeutaNome: record.terapeuta_nome || 'Terapeuta não informado',
            dataHora: record.data_hora || '',
            planoSaude: planoMap.get(record.paciente_id) || '',
            relatorio: relatorioByAtendimentoId.get(record.id) || null,
            status: record.status_presenca || 'Agendado',
        };
    },

    // Busca Atendimentos + Relatórios + Pacientes em UMA rodada só (1
    // chamada por tabela) e cruza tudo no cliente. Usado tanto pela aba
    // Atendimentos (que só quer os Realizados) quanto pela aba Indicadores
    // (que precisa de todos os status) — depois desse fetch, trocar de aba
    // é instantâneo, sem round-trip novo.
    async fetchAtendimentosComContexto() {
        const [atendimentos, relatorios, pacientes] = await Promise.all([
            this.fetchListar('LISTAR_ATENDIMENTOS'),
            this.fetchListar('LISTAR_RELATORIOS'),
            this.fetchListar('LISTAR_PACIENTES'),
        ]);

        const planoMap = this.buildPlanoMap(pacientes);

        const relatoriosTransformados = relatorios
            .map((record) => this.transformRelatorio(record, planoMap))
            .sort((a, b) => new Date(b.data) - new Date(a.data));

        const relatorioByAtendimentoId = new Map();
        relatoriosTransformados.forEach((r) => {
            if (r.atendimentoId) relatorioByAtendimentoId.set(r.atendimentoId, r);
        });

        const todosAtendimentos = atendimentos
            .map((record) => this.transformAtendimentoCompleto(record, planoMap, relatorioByAtendimentoId))
            .sort((a, b) => new Date(b.dataHora) - new Date(a.dataHora));

        return {
            todosAtendimentos,
            atendimentosRealizados: todosAtendimentos.filter((a) => a.status === 'Realizado'),
            relatorios: relatoriosTransformados,
        };
    },
};
