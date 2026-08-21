const SupervisorApi = {
    firstOrValue(value) {
        if (Array.isArray(value)) return value[0] || '';
        return value || '';
    },

    normalizeRecordsResponse(data) {
        if (data == null) return [];

        if (Array.isArray(data)) {
            return data.filter((item) => item && (item.fields || item.id));
        }

        if (Array.isArray(data.records)) {
            return data.records.filter((item) => item && (item.fields || item.id));
        }

        if (data.fields || data.id) {
            return [data];
        }

        return [];
    },

    formatTimeBrasilia(isoDate) {
        if (!isoDate) return '--:--';
        return new Date(isoDate).toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'America/Sao_Paulo',
        });
    },

    formatDateBrasilia(isoDate) {
        if (!isoDate) return '--';
        return new Date(isoDate).toLocaleDateString('pt-BR', {
            timeZone: 'America/Sao_Paulo',
        });
    },

    formatTimeRange(isoDate, durationMinutes = 45) {
        if (!isoDate) return '--:--';
        const start = new Date(isoDate);
        const end = new Date(start.getTime() + durationMinutes * 60000);
        const format = (date) =>
            date.toLocaleTimeString('pt-BR', {
                hour: '2-digit',
                minute: '2-digit',
                timeZone: 'America/Sao_Paulo',
            });
        return `${format(start)} - ${format(end)}`;
    },

    isTodayBrasilia(isoDate) {
        if (!isoDate) return false;
        const today = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
        const appointmentDate = new Date(isoDate).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
        return today === appointmentDate;
    },

    getClinicalNotes(fields, status) {
        if (status === 'Realizado') {
            return fields.Evolucao_Prontuario || 'Sem evolução registrada.';
        }

        if (status === 'Falta sem Aviso' || status?.includes('Desmarcado')) {
            return fields.Justificativa_Falta || 'Sem justificativa registrada.';
        }

        return fields.Evolucao_Prontuario || fields.Justificativa_Falta || 'Sem anotações registradas até o momento.';
    },

    normalizeDisplayStatus(status) {
        if (!status) return 'Agendado';
        if (status.includes('Desmarcado')) return 'Desmarcado';
        return status;
    },

    transformEquipeRecord(record) {
        const fields = record.fields || record;
        const status = this.normalizeDisplayStatus(fields.Status_Presenca);

        return {
            id: record.id || fields.ID,
            paciente: this.firstOrValue(fields.Paciente_Nome) || fields.Nome || 'Paciente não informado',
            terapeuta: this.firstOrValue(fields.Terapeuta_Nome) || 'Terapeuta não informado',
            supervisor: this.firstOrValue(fields.Supervisor_Nome) || CONFIG.SUPERVISOR_NOME,
            especialidade: fields.Especialidade || 'Multiprofissional',
            horario: this.formatTimeRange(fields.Data_Hora),
            hora: this.formatTimeBrasilia(fields.Data_Hora),
            status,
            prontuario: this.getClinicalNotes(fields, fields.Status_Presenca),
            dataHora: fields.Data_Hora,
            sala: fields.Sala || '',
        };
    },

    transformMeuAtendimento(record) {
        const fields = record.fields || record;
        const status = this.normalizeDisplayStatus(fields.Status_Presenca);

        return {
            id: record.id || fields.ID,
            paciente: this.firstOrValue(fields.Paciente_Nome) || fields.Nome || 'Paciente não informado',
            terapeuta: this.firstOrValue(fields.Terapeuta_Nome) || CONFIG.SUPERVISOR_NOME,
            especialidade: fields.Especialidade || 'Terapia Ocupacional',
            hora: this.formatTimeBrasilia(fields.Data_Hora),
            dataLabel: this.isTodayBrasilia(fields.Data_Hora) ? 'Hoje' : this.formatDateBrasilia(fields.Data_Hora),
            status,
            prontuario: this.getClinicalNotes(fields, fields.Status_Presenca),
            sala: fields.Sala || 'Sala não informada',
            dataHora: fields.Data_Hora,
        };
    },

    async fetchEquipeDia(date) {
        const session = AuthApi.getSession();
        const params = new URLSearchParams({ supervisor_nome: (session && session.nome) || CONFIG.SUPERVISOR_NOME });
        if (date) params.set('data', date);

        const url = `${CONFIG.API_BASE}${CONFIG.ENDPOINTS.SUPERVISOR_EQUIPE_DIA}?${params.toString()}`;
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`Erro ao carregar agenda da equipe (${response.status})`);
        }

        const data = await response.json();
        return this.normalizeRecordsResponse(data)
            .map((record) => this.transformEquipeRecord(record))
            .sort((a, b) => new Date(a.dataHora) - new Date(b.dataHora));
    },

    async fetchMeusAtendimentos() {
        const session = AuthApi.getSession();
        const params = new URLSearchParams({ terapeuta: (session && session.nome) || CONFIG.SUPERVISOR_NOME });
        const url = `${CONFIG.API_BASE}${CONFIG.ENDPOINTS.ATENDIMENTOS_DIA}?${params.toString()}`;
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`Erro ao carregar seus atendimentos (${response.status})`);
        }

        const data = await response.json();
        return this.normalizeRecordsResponse(data)
            .map((record) => this.transformMeuAtendimento(record))
            .sort((a, b) => new Date(a.dataHora) - new Date(b.dataHora));
    },

    async agendarSessaoAvulsa(payload) {
        const url = `${CONFIG.API_BASE}${CONFIG.ENDPOINTS.AGENDAR_EXTRA}`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const errorText = await response.text().catch(() => '');
            throw new Error(errorText || `Erro ao agendar sessão (${response.status})`);
        }

        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
            return response.json();
        }

        return { success: true };
    },

    buildAgendamentoPayload(formData) {
        const session = AuthApi.getSession();
        return {
            paciente_nome: formData.paciente,
            terapeuta_nome: formData.terapeuta,
            data_hora: `${formData.data}T${formData.hora}:00-03:00`,
            supervisor_nome: (session && session.nome) || CONFIG.SUPERVISOR_NOME,
        };
    },
};
