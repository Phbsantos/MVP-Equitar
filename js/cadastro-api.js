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
    // 2026-09-08: equipe_nome agora resolve de verdade pro equipe_id do
    // usuário criado — corrigido no workflow novo (n8n local + Postgres,
    // ver db/n8n-workflows/07_registrar_usuario.json), que resolve por
    // subquery SQL em vez de depender do Airtable resolver o link sozinho.
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
    // 2026-09-08: terapeuta_responsavel_nome idem — resolve de verdade
    // agora (mesma correção do workflow novo, ver
    // db/n8n-workflows/08_registrar_paciente.json).
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

    // /registrar/relatorio resolve paciente_nome/autor_nome/editado_por_nome
    // pra FK de verdade. Sem UI ainda em relatorios.html — só a função de
    // API por enquanto. Campos de fechamento de atendimento (status_presenca,
    // justificativa_falta, nivel_engajamento, recomendacao_pos_sessao) não
    // entram aqui — ver ApiService.buildRegisterPayload (js/api.js) pro
    // fluxo real de fechamento usado em index.html/supervisor.html.
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

    // /criar/atendimento — testado e funcionando (ver
    // SupervisorApi.agendarSessaoAvulsa). Centralizado aqui pra ser
    // reaproveitado por qualquer tela que precise criar um atendimento real
    // (ex: geração de atendimentos a partir de uma Recorrência em
    // cadastros.html — a tabela `recorrencias` já existe de verdade no
    // Postgres desde 2026-09-07, mas ainda não tem endpoint de
    // criar/listar no n8n; a feature continua session-only por enquanto,
    // ver js/recorrencia.js).
    buildAtendimentoPayload(formData) {
        return {
            paciente_nome: formData.pacienteNome,
            terapeuta_nome: formData.terapeutaNome,
            data_hora: formData.dataHora,
            supervisor_nome: formData.supervisorNome || '',
            tipo_atendimento: formData.tipoAtendimento || 'Sessão Regular',
        };
    },

    async criarAtendimento(payload) {
        const url = `${CONFIG.API_BASE}${CONFIG.ENDPOINTS.ATENDIMENTO_CRIAR}`;
        return this.postJson(url, payload);
    },
};
