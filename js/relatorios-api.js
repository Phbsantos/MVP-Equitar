const RelatoriosApi = {
    firstOrValue(value) {
        if (Array.isArray(value)) return value[0] || '';
        return value || '';
    },

    normalizeStatus(status) {
        if (!status) return 'Realizado';
        if (status.includes('Desmarcado')) return 'Desmarcado com Aviso';
        return status;
    },

    formatDateBrasilia(isoDate) {
        if (!isoDate) return '--';
        return new Date(isoDate).toLocaleDateString('pt-BR', {
            timeZone: 'America/Sao_Paulo',
        });
    },

    formatTimeBrasilia(isoDate) {
        if (!isoDate) return '--:--';
        return new Date(isoDate).toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'America/Sao_Paulo',
        });
    },

    getClinicalNotes(fields, status) {
        const normalizedStatus = this.normalizeStatus(status);

        if (normalizedStatus === 'Realizado') {
            return fields.Evolucao_Prontuario || 'Sem evolução registrada.';
        }

        if (normalizedStatus === 'Falta sem Aviso' || normalizedStatus === 'Desmarcado com Aviso') {
            return fields.Justificativa_Falta || 'Sem justificativa registrada.';
        }

        return fields.Evolucao_Prontuario || fields.Justificativa_Falta || 'Sem detalhes registrados.';
    },

    transformRecord(record) {
        const fields = record.fields || record;
        const status = this.normalizeStatus(fields.Status_Presenca);

        return {
            id: record.id || fields.ID,
            patientName: this.firstOrValue(fields.Paciente_Nome) || fields.Nome || 'Paciente não informado',
            therapistName: this.firstOrValue(fields.Terapeuta_Nome) || 'Terapeuta não informado',
            date: this.formatDateBrasilia(fields.Data_Hora),
            time: this.formatTimeBrasilia(fields.Data_Hora),
            status,
            notes: this.getClinicalNotes(fields, fields.Status_Presenca),
            dataHora: fields.Data_Hora,
        };
    },

    buildQueryParams(filters) {
        const params = new URLSearchParams();

        if (filters.paciente_nome?.trim()) {
            params.set('paciente_nome', filters.paciente_nome.trim());
        }
        if (filters.data_inicio) {
            params.set('data_inicio', filters.data_inicio);
        }
        if (filters.data_fim) {
            params.set('data_fim', filters.data_fim);
        }

        return params;
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

    async fetchRelatorios(filters = {}) {
        const params = this.buildQueryParams(filters);
        const queryString = params.toString();
        const url = `${CONFIG.API_BASE}${CONFIG.ENDPOINTS.RELATORIOS}${queryString ? `?${queryString}` : ''}`;

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`Erro ao carregar relatórios (${response.status})`);
        }

        const data = await response.json();
        const records = this.normalizeRecordsResponse(data);

        return records
            .map((record) => this.transformRecord(record))
            .sort((a, b) => new Date(b.dataHora) - new Date(a.dataHora));
    },
};
