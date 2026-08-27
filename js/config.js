const CONFIG = {
    TERAPEUTA: 'Dr. João Silva',
    TERAPEUTA_CREFITO: 'CREFITO-3/12345-TO',
    SUPERVISOR_NOME: 'Dr. João Silva',
    // 2026-08-27: base de produção mudou de phbsantos1 pra phbsantos2.
    // Antes dela, era phbsantos1 (troca em 2026-08-26); a phbsantos original
    // (sem número) já tinha ficado pra trás nessa data também. Nenhuma
    // versão anterior deve mais ser usada.
    API_BASE: 'https://phbsantos2.app.n8n.cloud/webhook/api',
    ENDPOINTS: {
        // --- Listagem (GET) ---
        LISTAR_USUARIOS: '/listar/usuarios',
        LISTAR_PACIENTES: '/listar/pacientes',
        LISTAR_ATENDIMENTOS: '/listar/atendimentos',
        // Corrigido no n8n em 2026-08-26 (antes devolvia a mesma tabela de
        // /listar/atendimentos) — hoje devolve a tabela Relatorios de
        // verdade: Tipo, Conteudo, Paciente/Autor (link+lookup), Data,
        // Atendimento (só em Evolução linkada), Editado_Por (texto simples).
        LISTAR_RELATORIOS: '/listar/relatorios',
        // Corrigido no n8n em 2026-08-26 (mesmo bug do item acima) — hoje
        // devolve Nome_Equipe, Supervisor (link+lookup) e Membros (rollup
        // já com os nomes prontos, sem precisar resolver link).
        LISTAR_EQUIPES: '/listar/equipes',

        // --- Criação (POST) ---
        // Aceito como está por decisão da Roseane (2026-08-26): equipe_nome
        // é aceito no payload mas o link Equipe do usuário criado fica
        // vazio. Não é mais tratado como pendência.
        USUARIO_REGISTRAR: '/registrar/usuario',
        // Aceito como está por decisão da Roseane (2026-08-26): mesmo caso
        // — terapeuta_responsavel_nome é aceito mas o link
        // Terapeuta_Responsavel do paciente criado fica vazio.
        PACIENTE_REGISTRAR: '/registrar/paciente',
        // Testado e funcionando (2026-08-26), inclusive com atendimento_id
        // preenchido (fecha um atendimento existente): resolve os links
        // Paciente/Autor/Atendimento e atualiza Status_Presenca +
        // Evolucao_Prontuario do Atendimento linkado. Nivel_Engajamento e
        // Recomendacao_Pos_Sessao continuam sem campo próprio — são
        // concatenados no texto de Conteudo (ver ApiService.buildRegisterPayload).
        RELATORIO_REGISTRAR: '/registrar/relatorio',
        // Testado e funcionando (2026-08-26).
        ATENDIMENTO_CRIAR: '/criar/atendimento',

        // Login: testado e funcionando (corrigido em 2026-08-26, depois de
        // começar quebrado com HTTP 200 vazio pra tudo). Resposta de
        // sucesso vem achatada (não é o {id, fields} cru do Airtable) e sem
        // Perfil_Role/Email/Status — por isso AuthApi.login() completa a
        // sessão com uma segunda busca em /listar/usuarios pelo id.
        // Ainda não retestado especificamente na base phbsantos2 (2026-08-27)
        // — vale confirmar os 3 casos (sucesso, e-mail errado, senha errada)
        // de novo já que mudou de instância.
        USUARIO_LOGIN: '/usuario/login',
        // Agenda filtrada por equipe do supervisor: sem endpoint dedicado —
        // reconstruído no cliente (ver SupervisorApi.fetchEquipeMembroIds/
        // fetchEquipeDia) a partir de /listar/equipes + /listar/atendimentos,
        // filtrando por ID de terapeuta, não por nome. Chave mantida só de
        // referência, não é mais usada no código.
        SUPERVISOR_EQUIPE_DIA: '/supervisor/equipe-dia',
        // Métricas de coordenação: seguem sem endpoint (já era TODO antes).
        COORDENACAO_METRICAS: '/coordenacao/metricas',
    },
};
