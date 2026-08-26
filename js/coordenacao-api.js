const CoordenacaoApi = {
    onlyDigits(value) {
        return String(value || '').replace(/\D/g, '');
    },

    buildWhatsappLink(telefone) {
        const digits = this.onlyDigits(telefone);
        if (!digits) return '';
        const withCountryCode = digits.startsWith('55') ? digits : `55${digits}`;
        return `https://wa.me/${withCountryCode}`;
    },

    transformMetricas(raw) {
        const metricas = raw?.metricas || {};
        return {
            taxaAssiduidade: Number(metricas.taxa_assiduidade) || 0,
            totalAgendados: Number(metricas.total_agendados) || 0,
            realizados: Number(metricas.realizados) || 0,
            faltasSemAviso: Number(metricas.faltas_sem_aviso) || 0,
            desmarcados: Number(metricas.desmarcados) || 0,
        };
    },

    transformAlertas(raw) {
        const alertas = Array.isArray(raw?.alertas_absenteismo) ? raw.alertas_absenteismo : [];
        return alertas.map((item) => ({
            pacienteNome: item.paciente_nome || 'Paciente não informado',
            telefoneResponsavel: item.telefone_responsavel || '',
            terapeutaNome: item.terapeuta_nome || 'Terapeuta não informado',
            faltasConsecutivas: Number(item.faltas_consecutivas) || 0,
            whatsappLink: this.buildWhatsappLink(item.telefone_responsavel),
        }));
    },

    async fetchMetricas() {
        const url = `${CONFIG.API_BASE}${CONFIG.ENDPOINTS.COORDENACAO_METRICAS}`;
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`Erro ao carregar indicadores (${response.status})`);
        }

        const data = await response.json();

        return {
            metricas: this.transformMetricas(data),
            alertas: this.transformAlertas(data),
        };
    },

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

    async fetchRelatoriosCompletos() {
        const [relatorios, pacientes] = await Promise.all([
            this.fetchListar('LISTAR_RELATORIOS'),
            this.fetchListar('LISTAR_PACIENTES'),
        ]);
        const planoMap = this.buildPlanoMap(pacientes);

        return relatorios
            .map((record) => this.transformRelatorio(record, planoMap))
            .sort((a, b) => new Date(b.data) - new Date(a.data));
    },

    transformAtendimentoRealizado(record, planoMap, relatorioByAtendimentoId) {
        const fields = record.fields || record;
        const pacienteNome = this.firstOrValue(fields['Nome_Completo (from Paciente_Nome)']) || 'Paciente não informado';

        return {
            id: record.id,
            pacienteNome,
            terapeutaNome: this.firstOrValue(fields['Nome (from Terapeuta_Nome)']) || 'Terapeuta não informado',
            dataHora: fields.Data_Hora || '',
            planoSaude: planoMap.get(pacienteNome.trim().toLowerCase()) || '',
            relatorio: relatorioByAtendimentoId.get(record.id) || null,
        };
    },

    // Busca tudo em paralelo (1 chamada por tabela) e cruza no cliente —
    // depois disso trocar de aba é instantâneo, sem round-trip novo.
    async fetchAtendimentosRealizados() {
        const [atendimentos, relatorios, pacientes] = await Promise.all([
            this.fetchListar('LISTAR_ATENDIMENTOS'),
            this.fetchListar('LISTAR_RELATORIOS'),
            this.fetchListar('LISTAR_PACIENTES'),
        ]);

        const planoMap = this.buildPlanoMap(pacientes);
        const relatorioByAtendimentoId = new Map();
        relatorios.forEach((record) => {
            const transformed = this.transformRelatorio(record, planoMap);
            if (transformed.atendimentoId) relatorioByAtendimentoId.set(transformed.atendimentoId, transformed);
        });

        return atendimentos
            .filter((record) => (record.fields || record).Status_Presenca === 'Realizado')
            .map((record) => this.transformAtendimentoRealizado(record, planoMap, relatorioByAtendimentoId))
            .sort((a, b) => new Date(b.dataHora) - new Date(a.dataHora));
    },
};
