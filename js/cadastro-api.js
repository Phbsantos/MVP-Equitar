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

    // formData.senha / numeroConselho / equipeNome ainda não têm campo no
    // formulário de cadastros.html (só nome, email, perfil, especialidade,
    // status hoje) — aceitos aqui como opcionais pra quando a UI adicionar.
    //
    // ATENÇÃO (2026-08-26): testado direto contra /registrar/usuario — o
    // campo equipe_nome é aceito na requisição mas o link Equipe do
    // registro criado fica vazio (não é resolvido pelo nome no n8n). Não
    // confiar nisso até corrigirem lá.
    buildUsuarioPayload(formData) {
        return {
            nome: formData.nome,
            email: formData.email,
            senha: formData.senha || '',
            perfil_role: formData.perfilRole,
            especialidade: formData.especialidade,
            numero_conselho: formData.numeroConselho || '',
            equipe_nome: formData.equipeNome || null,
            status: formData.status,
        };
    },

    async registrarUsuario(payload) {
        const url = `${CONFIG.API_BASE}${CONFIG.ENDPOINTS.USUARIO_REGISTRAR}`;
        return this.postJson(url, payload);
    },

    // formData.planoSaude ainda não tem campo em cadastros.html — aceito
    // aqui como opcional pra quando a UI adicionar.
    //
    // ATENÇÃO (2026-08-26): mesmo problema do usuário — terapeuta_responsavel_nome
    // é aceito na requisição mas o link Terapeuta_Responsavel do paciente
    // criado fica vazio. Não confiar nisso até corrigirem no n8n.
    buildPacientePayload(formData) {
        return {
            nome_completo: formData.nomeCompleto,
            data_nascimento: formData.dataNascimento,
            responsavel_nome: formData.responsavelNome,
            telefone_whatsapp: formData.telefoneWhatsapp,
            plano_saude: formData.planoSaude || null,
            status: formData.status,
            terapeuta_responsavel_nome: formData.terapeutaResponsavelNome,
        };
    },

    async registrarPaciente(payload) {
        const url = `${CONFIG.API_BASE}${CONFIG.ENDPOINTS.PACIENTE_REGISTRAR}`;
        return this.postJson(url, payload);
    },

    // Novo (2026-08-26): /registrar/relatorio já existe e foi testado com
    // sucesso — inclusive resolve paciente_nome e autor_nome pros links
    // corretos (diferente de usuario/paciente, que não resolvem). Sem UI
    // ainda em relatorios.html — só a função de API por enquanto.
    buildRelatorioPayload(formData) {
        return {
            tipo: formData.tipo,
            paciente_nome: formData.pacienteNome,
            atendimento_id: formData.atendimentoId || null,
            autor_nome: formData.autorNome,
            data: formData.data,
            conteudo: formData.conteudo,
            editado_por_nome: formData.editadoPorNome || null,
        };
    },

    async registrarRelatorio(payload) {
        const url = `${CONFIG.API_BASE}${CONFIG.ENDPOINTS.RELATORIO_REGISTRAR}`;
        return this.postJson(url, payload);
    },
};
