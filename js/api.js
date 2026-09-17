const ApiService = {
    // 2026-09-08: backend novo (n8n local + Postgres) não tem mais
    // variantes de grafia pro Status_Presenca — o enum status_presenca no
    // banco tem um valor canônico só por estado (ver
    // db/migrations/001_init_schema.sql). Os dois mapas abaixo continuam
    // existindo só porque o app usa um vocabulário interno mais curto
    // (pending/realizado/falta/desmarcado/cancelado) que não bate 1:1 com
    // os valores do enum.
    mapApiStatusToInternal(apiStatus) {
        const map = {
            Agendado: 'pending',
            Realizado: 'realizado',
            'Falta sem Aviso': 'falta',
            'Desmarcado com Aviso': 'desmarcado',
            'Cancelado pelo Terapeuta': 'cancelado',
        };
        return map[apiStatus] || 'pending';
    },

    mapInternalStatusToApi(internalStatus) {
        const map = {
            realizado: 'Realizado',
            falta: 'Falta sem Aviso',
            desmarcado: 'Desmarcado com Aviso',
            cancelado: 'Cancelado pelo Terapeuta',
        };
        return map[internalStatus] || 'Realizado';
    },

    engagementLabels: {
        excelente: 'Excelente / Muito Colaborativo',
        adequado: 'Adequado / Estável',
        parcial: 'Parcialmente Engajado / Atencioso',
        resistente: 'Resistência / Agitação',
    },

    formatTime(isoDate) {
        if (!isoDate) return '--:--';
        const date = new Date(isoDate);
        const hours = String(date.getUTCHours()).padStart(2, '0');
        const minutes = String(date.getUTCMinutes()).padStart(2, '0');
        return `${hours}:${minutes}`;
    },

    formatDate(isoDate) {
        if (!isoDate) return '';
        const date = new Date(isoDate);
        const day = String(date.getUTCDate()).padStart(2, '0');
        const month = String(date.getUTCMonth() + 1).padStart(2, '0');
        const year = date.getUTCFullYear();
        return `${day}/${month}/${year}`;
    },

    // 2026-09-08: linha reta agora — /listar/atendimentos devolve objetos
    // já achatados (paciente_nome, terapeuta_id, terapeuta_nome, etc.),
    // sem "fields", sem lookup, sem precisar adivinhar se um valor "parece"
    // um record ID do Airtable. id/paciente_id/terapeuta_id já são
    // inteiros de verdade — comparam certo com session.id (também inteiro
    // desde o login novo, ver js/auth-api.js).
    transformAtendimento(record) {
        return {
            id: record.id,
            patientKey: (record.paciente_nome || '').toLowerCase().trim(),
            name: record.paciente_nome || `Paciente #${record.paciente_id}`,
            therapistName: record.terapeuta_nome || '',
            therapistId: record.terapeuta_id,
            age: '',
            time: this.formatTime(record.data_hora),
            specialty: record.especialidade || 'Terapia Ocupacional',
            status: this.mapApiStatusToInternal(record.status_presenca),
            notes: record.evolucao_prontuario || '',
            justification: record.justificativa_falta || '',
            engagement: record.nivel_engajamento || 'adequado',
            nextSteps: record.recomendacao_pos_sessao || '',
            dataHora: record.data_hora,
            apiStatus: record.status_presenca || 'Agendado',
        };
    },

    buildPatientHistory(patients, patientKey) {
        return patients
            .filter((p) => p.patientKey === patientKey && p.status !== 'pending')
            .sort((a, b) => new Date(b.dataHora) - new Date(a.dataHora))
            .map((p) => ({
                date: this.formatDate(p.dataHora),
                status: p.status,
                text:
                    p.status === 'realizado'
                        ? p.notes
                        : `[${p.status.toUpperCase()}] Justificativa: ${p.justification}`,
            }));
    },

    // 2026-09-08: /listar/atendimentos agora aceita filtro de verdade no
    // servidor (terapeuta_id e data), corrigindo o problema documentado —
    // a API antiga (Airtable) ignorava qualquer query string, então o app
    // inteiro precisava trazer tudo e filtrar aqui. Filtro por ID do
    // terapeuta continua sendo o certo (exato, sem depender de nome) —
    // agora feito no Postgres via WHERE em vez de no JS.
    async fetchAtendimentosDia(date) {
        const session = AuthApi.getSession();
        const terapeutaId = session && session.id;

        // Falha fechada: sem terapeuta autenticado, não busca nada — é
        // dado de paciente, não é pra vazar por engano.
        if (!terapeutaId) return [];

        const params = new URLSearchParams({ terapeuta_id: terapeutaId });
        if (date) params.set('data', date);

        const url = `${CONFIG.API_BASE}${CONFIG.ENDPOINTS.LISTAR_ATENDIMENTOS}?${params.toString()}`;
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`Erro ao carregar agenda (${response.status})`);
        }

        const data = await response.json();
        const records = Array.isArray(data) ? data : [];

        return records.map((record) => this.transformAtendimento(record)).sort((a, b) => new Date(a.dataHora) - new Date(b.dataHora));
    },

    // Fechar um atendimento não é um "update" nele — é criar um Relatorio
    // (Tipo = Evolução) linkado via atendimento_id em /registrar/relatorio,
    // que agora também atualiza Status_Presenca/Evolucao_Prontuario/
    // Justificativa_Falta/Nivel_Engajamento/Recomendacao_Pos_Sessao do
    // Atendimento linkado — todos campos reais agora, ver buildRegisterPayload.
    async registerAtendimento(payload) {
        const url = `${CONFIG.API_BASE}${CONFIG.ENDPOINTS.RELATORIO_REGISTRAR}`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const errorText = await response.text().catch(() => '');
            throw new Error(errorText || `Erro ao salvar atendimento (${response.status})`);
        }

        const rawText = await response.text().catch(() => '');
        if (!rawText) return { success: true };

        try {
            return JSON.parse(rawText);
        } catch (e) {
            return { success: true };
        }
    },

    // 2026-09-08: backend novo já tem coluna própria pra Nivel_Engajamento
    // e Recomendacao_Pos_Sessao em Atendimentos (ver
    // db/migrations/001_init_schema.sql) — não precisam mais ser
    // concatenados dentro do texto de "conteudo" como no Airtable antigo.
    // "conteudo" agora carrega só a evolução/justificativa de verdade;
    // os outros campos vão soltos no payload e o workflow
    // /registrar/relatorio grava cada um na coluna certa.
    buildRegisterPayload(patient, formData) {
        const isRealizado = formData.status === 'realizado';
        const isFaltaOuDesmarcado = formData.status === 'falta' || formData.status === 'desmarcado';
        const session = AuthApi.getSession();

        return {
            tipo: 'Evolução',
            paciente_nome: patient.name,
            atendimento_id: patient.id,
            autor_nome: (session && session.nome) || CONFIG.TERAPEUTA,
            data: (patient.dataHora || '').slice(0, 10),
            conteudo: isRealizado ? formData.notes || '' : `Justificativa: ${formData.justification || ''}`,
            editado_por_nome: null,
            status_presenca: this.mapInternalStatusToApi(formData.status),
            justificativa_falta: isFaltaOuDesmarcado ? formData.justification : null,
            nivel_engajamento: isRealizado ? formData.engagement || null : null,
            recomendacao_pos_sessao: isRealizado ? formData.nextSteps || null : null,
        };
    },
};
