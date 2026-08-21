const CoordenacaoApi = {
    onlyDigits(value) {
        return String(value || '').replace(/\D/g, '');
    },

    buildWhatsappLink(telefone) {
        const digits = this.onlyDigits(telefone);
        if (!digits) return '';
        const withCountryCode = digits.startsWith('55') ? digits : `55${digits}`;
        return `https://wa.me/${withCountryCode}`;
    },

    transformMetricas(raw) {
        const metricas = raw?.metricas || {};
        return {
            taxaAssiduidade: Number(metricas.taxa_assiduidade) || 0,
            totalAgendados: Number(metricas.total_agendados) || 0,
            realizados: Number(metricas.realizados) || 0,
            faltasSemAviso: Number(metricas.faltas_sem_aviso) || 0,
            desmarcados: Number(metricas.desmarcados) || 0,
        };
    },

    transformAlertas(raw) {
        const alertas = Array.isArray(raw?.alertas_absenteismo) ? raw.alertas_absenteismo : [];
        return alertas.map((item) => ({
            pacienteNome: item.paciente_nome || 'Paciente não informado',
            telefoneResponsavel: item.telefone_responsavel || '',
            terapeutaNome: item.terapeuta_nome || 'Terapeuta não informado',
            faltasConsecutivas: Number(item.faltas_consecutivas) || 0,
            whatsappLink: this.buildWhatsappLink(item.telefone_responsavel),
        }));
    },

    async fetchMetricas() {
        const url = `${CONFIG.API_BASE}${CONFIG.ENDPOINTS.COORDENACAO_METRICAS}`;
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`Erro ao carregar indicadores (${response.status})`);
        }

        const data = await response.json();

        return {
            metricas: this.transformMetricas(data),
            alertas: this.transformAlertas(data),
        };
    },
};
