const RelatoriosApi = {
    firstOrValue(value) {
        if (Array.isArray(value)) return value[0] || '';
        return value || '';
    },

    formatDateBrasilia(isoDate) {
        if (!isoDate) return '--';
        return new Date(isoDate).toLocaleDateString('pt-BR', {
            timeZone: 'America/Sao_Paulo',
        });
    },

    // 2026-08-26: /listar/relatorios corrigido no n8n — agora devolve a
    // tabela Relatorios de verdade, não mais uma cópia de Atendimentos.
    // Formato confirmado (via GET real e via POST /registrar/relatorio):
    //   Tipo ("Evolução" | "Avulso"), Conteudo, Data (às vezes só data,
    //   às vezes ISO com T00:00:00 — nunca carrega hora de verdade, então
    //   não exibimos horário aqui), Paciente (link) + "Nome_Completo (from
    //   Paciente)" (lookup), Autor (link) + "Nome (from Autor)" (lookup),
    //   Atendimento (link, só presente em Evolução linkada a uma sessão),
    //   Editado_Por (texto simples, não é link), Relatorio_ID (primary
    //   field automático).
    transformRecord(record) {
        const fields = record.fields || record;

        return {
            id: record.id,
            tipo: fields.Tipo || 'Evolução',
            patientName: this.firstOrValue(fields['Nome_Completo (from Paciente)']) || 'Paciente não informado',
            authorName: this.firstOrValue(fields['Nome (from Autor)']) || 'Autor não informado',
            date: this.formatDateBrasilia(fields.Data),
            conteudo: fields.Conteudo || 'Sem conteúdo registrado.',
            atendimentoId: this.firstOrValue(fields.Atendimento) || null,
            editadoPor: fields.Editado_Por || '',
            dataRaw: fields.Data,
        };
    },

    normalizeRecordsResponse(data) {
        if (data == null) {
            return [];
        }

        if (Array.isArray(data)) {
            return data.filter((item) => item && (item.fields || item.id));
        }

        if (Array.isArray(data.records)) {
            return data.records.filter((item) => item && (item.fields || item.id));
        }

        if (data.fields || data.id) {
            return [data];
        }

        return [];
    },

    // /listar/relatorios (como os outros /listar/*) ignora qualquer query
    // string — testado. O filtro do formulário é aplicado aqui no cliente.
    applyClientFilters(records, filters) {
        const nomeTermo = (filters.paciente_nome || '').trim().toLowerCase();
        const dataInicio = filters.data_inicio ? new Date(filters.data_inicio) : null;
        const dataFim = filters.data_fim ? new Date(filters.data_fim) : null;

        return records.filter((r) => {
            if (nomeTermo && !r.patientName.toLowerCase().includes(nomeTermo)) return false;

            if (r.dataRaw) {
                const data = new Date(r.dataRaw);
                if (dataInicio && data < dataInicio) return false;
                if (dataFim && data > dataFim) return false;
            }

            return true;
        });
    },

    async fetchRelatorios(filters = {}) {
        const url = `${CONFIG.API_BASE}${CONFIG.ENDPOINTS.LISTAR_RELATORIOS}`;
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`Erro ao carregar relatórios (${response.status})`);
        }

        const data = await response.json();
        const records = this.normalizeRecordsResponse(data)
            .map((record) => this.transformRecord(record))
            .sort((a, b) => new Date(b.dataRaw) - new Date(a.dataRaw));

        return this.applyClientFilters(records, filters);
    },
};
