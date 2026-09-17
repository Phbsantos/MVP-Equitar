const CONFIG = {
    TERAPEUTA: 'Dr. João Silva',
    TERAPEUTA_CREFITO: 'CREFITO-3/12345-TO',
    SUPERVISOR_NOME: 'Dr. João Silva',
    // 2026-09-16: backend saiu da máquina local de desenvolvimento e foi
    // pra uma VPS (Ubuntu 24.04) — mesma arquitetura (n8n self-hosted em
    // Docker + Postgres, ver db/n8n-workflows/ e db/migrations/). Rodou
    // primeiro só em HTTP puro por IP; no mesmo dia ganhou HTTPS de
    // verdade via Caddy (reverse proxy com TLS automático) na frente do
    // n8n, usando o hostname público sslip.io (resolve pro IP da VPS sem
    // precisar de domínio próprio) — certificado real do Let's Encrypt,
    // emitido e renovado automaticamente pelo Caddy. n8n não escuta mais
    // direto na porta pública (só via Caddy/443, porta 5678 fechada no
    // firewall e vinculada só a 127.0.0.1 no docker-compose). Nenhuma
    // versão anterior (n8n cloud phbsantos*, localhost:5678 de dev, ou o
    // http://IP:5678 sem TLS) deve mais ser usada.
    API_BASE: 'https://38-72-132-152.sslip.io/webhook',
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
