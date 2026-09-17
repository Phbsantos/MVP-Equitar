const UsuariosApi = {
    // 2026-09-08: /listar/usuarios (backend novo) já devolve equipe_nome
    // pronto via JOIN — sem lookup Airtable pra resolver.
    transformUsuario(record) {
        return {
            id: record.id,
            nome: record.nome || '',
            email: record.email || '',
            perfilRole: record.perfil_role || '',
            especialidade: record.especialidade || '',
            numeroConselho: record.numero_conselho || '',
            equipeNome: record.equipe_nome || '',
            status: record.status || 'Ativo',
        };
    },

    async fetchUsuarios() {
        const url = `${CONFIG.API_BASE}${CONFIG.ENDPOINTS.LISTAR_USUARIOS}`;
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`Erro ao carregar usuários (${response.status})`);
        }

        const data = await response.json();
        const records = Array.isArray(data) ? data : [];
        return records.map((record) => this.transformUsuario(record));
    },

    // /listar/terapeutas não existe — só /listar/usuarios (todos os
    // perfis). Buscamos tudo e filtramos aqui. Supervisor entra na lista
    // porque, no modelo, supervisor também é terapeuta (só tem permissão
    // extra) — ver decisão registrada no esquema da base.
    async fetchTerapeutas() {
        const usuarios = await this.fetchUsuarios();
        return usuarios
            .filter((u) => u.nome && u.status !== 'Inativo' && ['Terapeuta', 'Supervisor'].includes(u.perfilRole))
            .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    },
};
