const CONFIG = {
    TERAPEUTA: 'Dr. João Silva',
    TERAPEUTA_CREFITO: 'CREFITO-3/12345-TO',
    SUPERVISOR_NOME: 'Dr. João Silva',
    // 2026-09-08: backend saiu do n8n cloud + Airtable e passou a rodar
    // 100% local — n8n self-hosted em Docker (container n8n_app) falando
    // com Postgres local (container postgres_n8n, banco equitar_db), ver
    // db/n8n-workflows/ (schema em db/migrations/). Os paths de cada
    // endpoint não mudaram (o path do webhook é o mesmo em cada workflow
    // novo) — só a base. Nenhuma versão n8n cloud (phbsantos/phbsantos1/
    // phbsantos2) deve mais ser usada.
    API_BASE: 'http://localhost:5678/webhook',
    ENDPOINTS: {
        // --- Listagem (GET) ---
        LISTAR_USUARIOS: '/listar/usuarios',
        LISTAR_PACIENTES: '/listar/pacientes',
        // 2026-09-08: agora aceita filtros de verdade na query string
        // (terapeuta_id, paciente_id, data, data_inicio, data_fim,
        // status_presenca) — o workflow novo resolve isso no Postgres.
        // Nenhuma tela ainda manda esses parâmetros (todas continuam
        // buscando tudo e filtrando no cliente, padrão estabelecido);
        // migrar pra filtro de servidor é trabalho futuro, não bloqueia nada.
        LISTAR_ATENDIMENTOS: '/listar/atendimentos',
        LISTAR_RELATORIOS: '/listar/relatorios',
        LISTAR_EQUIPES: '/listar/equipes',

        // --- Criação (POST) ---
        // 2026-09-08: equipe_nome agora resolve de verdade pro equipe_id do
        // usuário criado (era um link vazio no Airtable, corrigido no
        // workflow novo via subquery SQL).
        USUARIO_REGISTRAR: '/registrar/usuario',
        // 2026-09-08: terapeuta_responsavel_nome idem — resolve de verdade
        // agora (mesma correção, mesmo motivo).
        PACIENTE_REGISTRAR: '/registrar/paciente',
        // 2026-09-08: dois bugs confirmados corrigidos no workflow novo —
        // (1) status_presenca de Falta/Desmarcado/Cancelado não vira mais
        // "Realizado" à força; (2) nivel_engajamento e
        // recomendacao_pos_sessao agora são campos próprios no payload,
        // gravados em colunas reais — não precisam mais ser concatenados
        // dentro de conteudo (ver ApiService.buildRegisterPayload).
        RELATORIO_REGISTRAR: '/registrar/relatorio',
        ATENDIMENTO_CRIAR: '/criar/atendimento',

        // 2026-09-08: resposta de sucesso agora vem completa em
        // {sucesso, mensagem, usuario:{id, nome, email, perfilRole,
        // especialidade, equipeId, status}} numa chamada só — não precisa
        // mais da segunda busca em /listar/usuarios que o AuthApi.login()
        // fazia pra completar perfilRole/email/status.
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
