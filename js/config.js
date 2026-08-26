const CONFIG = {
    TERAPEUTA: 'Dr. João Silva',
    TERAPEUTA_CREFITO: 'CREFITO-3/12345-TO',
    SUPERVISOR_NOME: 'Dr. João Silva',
    // 2026-08-26: base trocada para a nova instância n8n (phbsantos1). Os
    // endpoints antigos abaixo (comentados) ficaram na instância antiga e
    // não devem mais ser usados.
    API_BASE: 'https://phbsantos1.app.n8n.cloud/webhook/api',
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

        // --- Ainda sem substituto funcional na nova base (bloqueado) ---
        // Login: o caminho existe na base nova (não dá 404 — comparado com
        // um path genuinamente não registrado, que dá 404 com mensagem
        // clara do n8n), mas devolve HTTP 200 com corpo vazio tanto pra
        // credenciais válidas quanto inválidas (testado 2026-08-26). Ou
        // seja: o workflow está registrado mas não retorna sessão/usuário
        // pra nenhum caso — provavelmente um stub ainda não conectado à
        // consulta de usuário/checagem de senha. Login não funciona até
        // isso ser implementado.
        USUARIO_LOGIN: '/usuario/login',
        // Agenda filtrada por equipe do supervisor: sem endpoint dedicado —
        // reconstruído no cliente (ver SupervisorApi.fetchEquipeMembros/
        // fetchEquipeDia) a partir de /listar/equipes + /listar/atendimentos.
        // Chave mantida só de referência, não é mais usada no código.
        SUPERVISOR_EQUIPE_DIA: '/supervisor/equipe-dia',
        // Métricas de coordenação: seguem sem endpoint (já era TODO antes).
        COORDENACAO_METRICAS: '/coordenacao/metricas',
    },
};
