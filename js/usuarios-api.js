const UsuariosApi = {
    normalizeRecordsResponse(data) {
        if (data == null) return [];
        if (Array.isArray(data)) return data.filter((item) => item && (item.fields || item.id));
        if (Array.isArray(data.records)) return data.records.filter((item) => item && (item.fields || item.id));
        if (data.fields || data.id) return [data];
        return [];
    },

    transformUsuario(record) {
        const fields = record.fields || {};
        return {
            id: record.id,
            nome: fields.Nome || '',
            email: fields.Email || '',
            perfilRole: fields.Perfil_Role || '',
            especialidade: fields.Especialidade || '',
            status: fields.Status || 'Ativo',
        };
    },

    async fetchTerapeutas() {
        const params = new URLSearchParams({ role: 'Terapeuta' });
        const url = `${CONFIG.API_BASE}${CONFIG.ENDPOINTS.LISTAR_TERAPEUTAS}?${params.toString()}`;
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`Erro ao carregar terapeutas (${response.status})`);
        }

        const data = await response.json();
        return this.normalizeRecordsResponse(data)
            .map((record) => this.transformUsuario(record))
            .filter((u) => u.nome && u.status !== 'Inativo')
            .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    },
};
