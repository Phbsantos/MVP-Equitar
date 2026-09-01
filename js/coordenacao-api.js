const CoordenacaoApi = {
    // --- Atendimentos realizados + Relatórios, com Plano_Saude cruzado ---
    // Plano_Saude vive em Pacientes, não em Atendimentos nem Relatorios —
    // por isso todo fetch abaixo também busca /listar/pacientes pra montar
    // o cruzamento por nome. Ver decisão registrada no esquema da base
    // ("Base Equitar"): o plano fica no paciente, não no atendimento.

    firstOrValue(value) {
        if (Array.isArray(value)) return value[0] || '';
        return value || '';
    },

    normalizeRecordsResponse(data) {
        if (data == null) return [];
        if (Array.isArray(data)) return data.filter((item) => item && (item.fields || item.id));
        if (Array.isArray(data.records)) return data.records.filter((item) => item && (item.fields || item.id));
        if (data.fields || data.id) return [data];
        return [];
    },

    async fetchListar(endpointKey) {
        const url = `${CONFIG.API_BASE}${CONFIG.ENDPOINTS[endpointKey]}`;
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`Erro ao carregar dados (${response.status})`);
        }

        return this.normalizeRecordsResponse(await response.json());
    },

    buildPlanoMap(pacienteRecords) {
        const map = new Map();
        pacienteRecords.forEach((record) => {
            const fields = record.fields || record;
            const nome = fields.Nome_Completo;
            if (nome) map.set(nome.trim().toLowerCase(), fields.Plano_Saude || '');
        });
        return map;
    },

    transformRelatorio(record, planoMap) {
        const fields = record.fields || record;
        const pacienteNome = this.firstOrValue(fields['Nome_Completo (from Paciente)']) || 'Paciente não informado';

        return {
            id: record.id,
            tipo: fields.Tipo || 'Evolução',
            pacienteNome,
            autorNome: this.firstOrValue(fields['Nome (from Autor)']) || 'Autor não informado',
            data: fields.Data || '',
            conteudo: fields.Conteudo || '',
            atendimentoId: this.firstOrValue(fields.Atendimento) || null,
            editadoPor: fields.Editado_Por || '',
            planoSaude: planoMap.get(pacienteNome.trim().toLowerCase()) || '',
        };
    },

    // Transforma um Atendimento cru, mantendo o Status_Presenca original —
    // usado pela aba Indicadores, que precisa enxergar Falta/Desmarcado/
    // Cancelado/Agendado além de Realizado (fetchAtendimentosComContexto
    // filtra pra Realizado só depois, pra montar a aba Atendimentos).
    transformAtendimentoCompleto(record, planoMap, relatorioByAtendimentoId) {
        const fields = record.fields || record;
        const pacienteNome = this.firstOrValue(fields['Nome_Completo (from Paciente_Nome)']) || 'Paciente não informado';

        return {
            id: record.id,
            pacienteNome,
            terapeutaNome: this.firstOrValue(fields['Nome (from Terapeuta_Nome)']) || 'Terapeuta não informado',
            dataHora: fields.Data_Hora || '',
            planoSaude: planoMap.get(pacienteNome.trim().toLowerCase()) || '',
            relatorio: relatorioByAtendimentoId.get(record.id) || null,
            status: fields.Status_Presenca || 'Agendado',
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
