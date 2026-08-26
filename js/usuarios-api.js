const UsuariosApi = {
    // Copiado de ApiService.firstOrValue (js/api.js) em vez de depender
    // dele: esta tabela é usada em páginas (ex: cadastros.html) que não
    // carregam api.js.
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

    transformUsuario(record) {
        const fields = record.fields || {};
        return {
            id: record.id,
            nome: fields.Nome || '',
            email: fields.Email || '',
            perfilRole: fields.Perfil_Role || '',
            especialidade: fields.Especialidade || '',
            numeroConselho: fields.Numero_Conselho || '',
            // 2026-08-26: Equipe é um link agora — o nome legível vem no
            // lookup "Nome_Equipe (from Equipe)" que o Airtable gerou.
            equipeNome: this.firstOrValue(fields['Nome_Equipe (from Equipe)']) || '',
            status: fields.Status || 'Ativo',
        };
    },

    async fetchUsuarios() {
        const url = `${CONFIG.API_BASE}${CONFIG.ENDPOINTS.LISTAR_USUARIOS}`;
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`Erro ao carregar usuários (${response.status})`);
        }

        const data = await response.json();
        return this.normalizeRecordsResponse(data).map((record) => this.transformUsuario(record));
    },

    // 2026-08-26: /listar/terapeutas não existe mais na base nova — só
    // /listar/usuarios (todos os perfis). Buscamos tudo e filtramos aqui.
    // Supervisor entra na lista porque, no modelo, supervisor também é
    // terapeuta (só tem permissão extra) — ver decisão registrada no
    // esquema da base.
    async fetchTerapeutas() {
        const usuarios = await this.fetchUsuarios();
        return usuarios
            .filter((u) => u.nome && u.status !== 'Inativo' && ['Terapeuta', 'Supervisor'].includes(u.perfilRole))
            .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    },
};
