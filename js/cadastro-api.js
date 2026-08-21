const CadastroApi = {
    async postJson(url, payload) {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const errorText = await response.text().catch(() => '');
            throw new Error(errorText || `Erro na requisição (${response.status})`);
        }

        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
            return response.json();
        }

        return { success: true };
    },

    buildUsuarioPayload(formData) {
        return {
            nome: formData.nome,
            email: formData.email,
            perfil_role: formData.perfilRole,
            especialidade: formData.especialidade,
            status: formData.status,
        };
    },

    async registrarUsuario(payload) {
        const url = `${CONFIG.API_BASE}${CONFIG.ENDPOINTS.USUARIO_REGISTRAR}`;
        return this.postJson(url, payload);
    },

    buildPacientePayload(formData) {
        return {
            nome_completo: formData.nomeCompleto,
            data_nascimento: formData.dataNascimento,
            responsavel_nome: formData.responsavelNome,
            telefone_whatsapp: formData.telefoneWhatsapp,
            status: formData.status,
            terapeuta_responsavel_nome: formData.terapeutaResponsavelNome,
        };
    },

    async registrarPaciente(payload) {
        const url = `${CONFIG.API_BASE}${CONFIG.ENDPOINTS.PACIENTE_REGISTRAR}`;
        return this.postJson(url, payload);
    },
};
