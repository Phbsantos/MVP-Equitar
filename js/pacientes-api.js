const PacientesApi = {
    normalizeRecordsResponse(data) {
        if (data == null) return [];
        if (Array.isArray(data)) return data.filter((item) => item && (item.fields || item.id));
        if (Array.isArray(data.records)) return data.records.filter((item) => item && (item.fields || item.id));
        if (data.fields || data.id) return [data];
        return [];
    },

    transformPaciente(record) {
        const fields = record.fields || {};
        return {
            id: record.id,
            nome: fields.Nome_Completo || '',
            responsavelNome: fields.Responsavel_Nome || '',
            telefoneWhatsapp: fields.Telefone_WhatsApp ? String(fields.Telefone_WhatsApp) : '',
            status: fields.Status || '',
        };
    },

    async fetchPacientes() {
        const url = `${CONFIG.API_BASE}${CONFIG.ENDPOINTS.LISTAR_PACIENTES}`;
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`Erro ao carregar pacientes (${response.status})`);
        }

        const data = await response.json();
        return this.normalizeRecordsResponse(data)
            .map((record) => this.transformPaciente(record))
            .filter((p) => p.nome)
            .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    },
};
