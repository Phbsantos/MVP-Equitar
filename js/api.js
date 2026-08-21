const ApiService = {
    firstOrValue(value) {
        if (Array.isArray(value)) return value[0] || '';
        return value || '';
    },

    mapApiStatusToInternal(apiStatus) {
        const map = {
            'Agendado': 'pending',
            'Realizado': 'realizado',
            'Falta sem Aviso': 'falta',
            'Desmarcado com Aviso': 'desmarcado',
            'Desmarcado c/ Aviso': 'desmarcado',
            'Cancelado pelo Terapeuta': 'cancelado',
            'Cancelado Terapeuta': 'cancelado',
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

    transformAtendimento(record) {
        const fields = record.fields || {};
        const name = this.firstOrValue(fields.Paciente_Nome) || fields.Nome || `Paciente #${record.id.slice(-6)}`;

        return {
            id: record.id,
            patientKey: name.toLowerCase().trim(),
            name,
            age: fields.Idade_Paciente || '',
            time: this.formatTime(fields.Data_Hora),
            specialty: fields.Especialidade || 'Terapia Ocupacional',
            status: this.mapApiStatusToInternal(fields.Status_Presenca),
            notes: fields.Evolucao_Prontuario || '',
            justification: fields.Justificativa_Falta || '',
            engagement: fields.Nivel_Engajamento || 'adequado',
            nextSteps: fields.Recomendacao_Pos_Sessao || '',
            dataHora: fields.Data_Hora,
            apiStatus: fields.Status_Presenca || 'Agendado',
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

    async fetchAtendimentosDia(date) {
        const session = AuthApi.getSession();
        const params = new URLSearchParams({
            terapeuta: (session && session.nome) || CONFIG.TERAPEUTA,
        });

        if (date) {
            params.set('data', date);
        }

        const url = `${CONFIG.API_BASE}${CONFIG.ENDPOINTS.ATENDIMENTOS_DIA}?${params.toString()}`;
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`Erro ao carregar agenda (${response.status})`);
        }

        const data = await response.json();
        const records = Array.isArray(data) ? data : data.records || [];

        return records
            .map((record) => this.transformAtendimento(record))
            .sort((a, b) => new Date(a.dataHora) - new Date(b.dataHora));
    },

    async registerAtendimento(payload) {
        const url = `${CONFIG.API_BASE}${CONFIG.ENDPOINTS.REGISTRAR}`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const errorText = await response.text().catch(() => '');
            throw new Error(errorText || `Erro ao salvar atendimento (${response.status})`);
        }

        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
            return response.json();
        }

        return { success: true };
    },

    // A API de registro só persiste 4 campos (atendimento_id, status_presenca,
    // evolucao_prontuario, justificativa_falta). Engajamento e recomendação
    // pós-sessão não têm campo próprio na tabela, então são anexados ao texto
    // da evolução para não se perderem.
    buildRegisterPayload(patient, formData) {
        const isRealizado = formData.status === 'realizado';
        const isFaltaOuDesmarcado = formData.status === 'falta' || formData.status === 'desmarcado';

        const notesParts = [];
        if (isRealizado) {
            if (formData.notes) notesParts.push(formData.notes);
            if (formData.engagement) {
                notesParts.push(`Engajamento: ${this.engagementLabels[formData.engagement] || formData.engagement}`);
            }
            if (formData.nextSteps) {
                notesParts.push(`Recomendação pós-sessão: ${formData.nextSteps}`);
            }
        }

        return {
            atendimento_id: patient.id,
            status_presenca: this.mapInternalStatusToApi(formData.status),
            evolucao_prontuario: isRealizado ? notesParts.join('\n\n') : '',
            justificativa_falta: isFaltaOuDesmarcado ? formData.justification : '',
        };
    },
};
