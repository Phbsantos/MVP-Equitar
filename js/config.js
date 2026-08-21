const CONFIG = {
    TERAPEUTA: 'Dr. João Silva',
    TERAPEUTA_CREFITO: 'CREFITO-3/12345-TO',
    SUPERVISOR_NOME: 'Dr. João Silva',
    API_BASE: 'https://phbsantos.app.n8n.cloud/webhook/api',
    ENDPOINTS: {
        ATENDIMENTOS_DIA: '/atendimentos/dia',
        REGISTRAR: '/atendimento/registrar',
        AGENDAR_EXTRA: '/atendimento/agendar-extra',
        RELATORIOS: '/relatorios/prontuarios',
        SUPERVISOR_EQUIPE_DIA: '/supervisor/equipe-dia',
        // TODO: confirmar URL real com a Roseane — ainda não veio na lista de endpoints ativos.
        COORDENACAO_METRICAS: '/coordenacao/metricas',
        PACIENTE_REGISTRAR: '/paciente/registrar',
        USUARIO_REGISTRAR: '/usuario/registrar',
        LISTAR_TERAPEUTAS: '/listar/terapeutas',
        LISTAR_PACIENTES: '/listar/pacientes',
        USUARIO_LOGIN: '/usuario/login',
    },
};
