const SupervisorApi = {
    firstOrValue(value) {
        if (Array.isArray(value)) return value[0] || '';
        return value || '';
    },

    // Mesmo problema documentado em ApiService.resolveLinkedName (js/api.js):
    // Paciente_Nome/Terapeuta_Nome/Supervisor_Nome agora trazem o record ID
    // do Airtable, não o nome. O nome legível vem no lookup correspondente.
    looksLikeRecordId(value) {
        return typeof value === 'string' && /^rec[a-zA-Z0-9]{14,}$/.test(value);
    },

    resolveLinkedName(fields, linkField, lookupField) {
        const lookupValue = this.firstOrValue(fields[lookupField]);
        if (lookupValue) return lookupValue;

        const linkValue = this.firstOrValue(fields[linkField]);
        if (linkValue && !this.looksLikeRecordId(linkValue)) return linkValue;

        return '';
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
            paciente:
                this.resolveLinkedName(fields, 'Paciente_Nome', 'Nome_Completo (from Paciente_Nome)') ||
                fields.Nome ||
                'Paciente não informado',
            terapeuta: this.resolveLinkedName(fields, 'Terapeuta_Nome', 'Nome (from Terapeuta_Nome)') || 'Terapeuta não informado',
            // Terapeuta_Nome puro já é o record ID — usado pra filtrar por
            // equipe com exatidão, sem depender de comparação de nome.
            terapeutaId: this.firstOrValue(fields.Terapeuta_Nome),
            supervisor: this.resolveLinkedName(fields, 'Supervisor_Nome', 'Nome (from Supervisor_Nome)') || CONFIG.SUPERVISOR_NOME,
            especialidade: fields.Especialidade || 'Multiprofissional',
            horario: this.formatTimeRange(fields.Data_Hora),
            hora: this.formatTimeBrasilia(fields.Data_Hora),
            status,
            prontuario: this.getClinicalNotes(fields, fields.Status_Presenca),
            dataHora: fields.Data_Hora,
            sala: fields.Sala || '',
        };
    },

    // 2026-08-26: /supervisor/equipe-dia não existe na base nova — a lista
    // de endpoints não trouxe substituto direto. Reconstruído a partir de
    // /listar/equipes + /listar/atendimentos, filtrando 100% no cliente
    // (a API ignora query string). Filtro por ID, não por nome: "Supervisor"
    // e "Usuários" (o link de verdade da equipe, não o rollup "Membros" de
    // nomes) já trazem record ID — exato, sem depender de acento/capitalização.
    async fetchEquipeMembroIds(supervisorId) {
        const url = `${CONFIG.API_BASE}${CONFIG.ENDPOINTS.LISTAR_EQUIPES}`;
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`Erro ao carregar equipes (${response.status})`);
        }

        const data = await response.json();
        const equipes = this.normalizeRecordsResponse(data);

        const equipe = equipes.find((record) => {
            const fields = record.fields || record;
            const supervisorIds = Array.isArray(fields.Supervisor) ? fields.Supervisor : [];
            return supervisorIds.includes(supervisorId);
        });

        if (!equipe) return [supervisorId];

        const fields = equipe.fields || equipe;
        const membroIds = Array.isArray(fields['Usuários']) ? fields['Usuários'] : [];
        return membroIds.length ? membroIds : [supervisorId];
    },

    // 2026-08-26: Coordenador/Admin não são supervisor de equipe nenhuma
    // (só Juliana e Camila são, hoje) — sem esse caso especial, o filtro de
    // equipe abaixo sempre dava 0 pra eles. Decisão: Coordenador/Admin
    // pulam o filtro de equipe e veem tudo aqui também, igual já viam na
    // aba Atendimentos da tela Coordenação.
    VE_TUDO_SEM_FILTRO_DE_EQUIPE: ['Coordenador', 'Admin'],

    async fetchEquipeDia(date) {
        const session = AuthApi.getSession();
        const supervisorId = session && session.id;
        const vePapelSemEquipe = session && this.VE_TUDO_SEM_FILTRO_DE_EQUIPE.includes(session.perfilRole);

        const membroIds = !vePapelSemEquipe && supervisorId ? await this.fetchEquipeMembroIds(supervisorId) : [];

        const url = `${CONFIG.API_BASE}${CONFIG.ENDPOINTS.LISTAR_ATENDIMENTOS}`;
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`Erro ao carregar agenda da equipe (${response.status})`);
        }

        const data = await response.json();
        return this.normalizeRecordsResponse(data)
            .map((record) => this.transformEquipeRecord(record))
            .filter((item) => {
                const matchesEquipe = vePapelSemEquipe || membroIds.includes(item.terapeutaId);
                const matchesData = !date || (item.dataHora || '').slice(0, 10) === date;
                return matchesEquipe && matchesData;
            })
            .sort((a, b) => new Date(a.dataHora) - new Date(b.dataHora));
    },

    // 2026-08-26: testado e funcionando. A primeira rodada de teste tinha
    // dado HTTP 200 com corpo vazio e parecia um bug no workflow, mas era
    // a codificação UTF-8 do meu teste em curl corrompendo texto acentuado
    // (ex: "Sessão Regular" chegando como "Sess�o Regular", rejeitado pelo
    // Single Select do Airtable) — não um bug do n8n. Retestado com o
    // corpo vindo de um arquivo (bypassando o shell) e criou o registro
    // normalmente. O fetch()/JSON.stringify() do navegador nunca teve esse
    // problema, então isso nunca afetou o app de verdade.
    async agendarSessaoAvulsa(payload) {
        const url = `${CONFIG.API_BASE}${CONFIG.ENDPOINTS.ATENDIMENTO_CRIAR}`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const errorText = await response.text().catch(() => '');
            throw new Error(errorText || `Erro ao agendar sessão (${response.status})`);
        }

        // Mantemos parsing tolerante a corpo vazio por segurança (não
        // custa nada), mas não é mais esperado que aconteça.
        const rawText = await response.text().catch(() => '');
        if (!rawText) {
            return { success: true };
        }

        try {
            return JSON.parse(rawText);
        } catch (e) {
            return { success: true };
        }
    },

    buildAgendamentoPayload(formData) {
        const session = AuthApi.getSession();
        return {
            paciente_nome: formData.paciente,
            terapeuta_nome: formData.terapeuta,
            data_hora: `${formData.data}T${formData.hora}:00-03:00`,
            supervisor_nome: (session && session.nome) || CONFIG.SUPERVISOR_NOME,
            tipo_atendimento: formData.tipo || 'Sessão Extra/Reforço',
        };
    },
};
