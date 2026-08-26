const ApiService = {
    firstOrValue(value) {
        if (Array.isArray(value)) return value[0] || '';
        return value || '';
    },

    // 2026-08-26: na base nova (phbsantos1), campos de link tipo
    // Paciente_Nome / Terapeuta_Nome / Supervisor_Nome passaram a devolver
    // o record ID do Airtable (ex: "recQ6JtKNHEzyBjUG"), não mais o nome.
    // O nome legível vem num campo de lookup separado, com o nome que o
    // Airtable gera automaticamente ao criar o lookup — tipo
    // "Nome_Completo (from Paciente_Nome)". Esse helper tenta o lookup
    // primeiro e só cai pro campo de link puro se o valor não parecer um
    // record ID (pra continuar funcionando caso algum workflow antigo
    // ainda devolva o nome direto em Paciente_Nome).
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
        const name =
            this.resolveLinkedName(fields, 'Paciente_Nome', 'Nome_Completo (from Paciente_Nome)') ||
            fields.Nome ||
            `Paciente #${record.id.slice(-6)}`;
        const therapistName = this.resolveLinkedName(fields, 'Terapeuta_Nome', 'Nome (from Terapeuta_Nome)');
        // Terapeuta_Nome (o campo de link puro) já vem como o record ID do
        // Airtable — é exatamente isso que queremos aqui, sem precisar de
        // lookup nenhum. Filtrar por ID é exato (sem risco de nome parcial
        // batendo errado) e session.id já É esse mesmo ID, desde o login.
        const therapistId = this.firstOrValue(fields.Terapeuta_Nome);

        return {
            id: record.id,
            patientKey: name.toLowerCase().trim(),
            name,
            therapistName,
            therapistId,
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

    // 2026-08-26: decisão — filtragem fica 100% no cliente. A API
    // /listar/atendimentos ignora qualquer query string (testado), então
    // a rota escolhida é: trazer tudo e filtrar aqui. Filtro por ID do
    // terapeuta (session.id, o record ID do Airtable de quem logou), não
    // por nome — exato, sem ambiguidade de maiúsculas/acento/nome parcial.
    // Sem session.id não filtra nada e não mostra nada (falha fechada:
    // é dado de paciente, não é pra vazar por engano).
    async fetchAtendimentosDia(date) {
        const session = AuthApi.getSession();
        const terapeutaId = session && session.id;

        const url = `${CONFIG.API_BASE}${CONFIG.ENDPOINTS.LISTAR_ATENDIMENTOS}`;
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`Erro ao carregar agenda (${response.status})`);
        }

        const data = await response.json();
        const records = Array.isArray(data) ? data : data.records || [];

        return records
            .map((record) => this.transformAtendimento(record))
            .filter((patient) => {
                const matchesTerapeuta = Boolean(terapeutaId) && patient.therapistId === terapeutaId;
                const matchesData = !date || (patient.dataHora || '').slice(0, 10) === date;
                return matchesTerapeuta && matchesData;
            })
            .sort((a, b) => new Date(a.dataHora) - new Date(b.dataHora));
    },

    // 2026-08-26: confirmado com a Roseane — fechar um atendimento não é
    // um "update" nele. É criar um Relatorio (Tipo = Evolução) linkado via
    // atendimento_id em /registrar/relatorio.
    //
    // As duas primeiras tentativas de testar isso (na mesma sessão) deram
    // HTTP 200 com corpo vazio e pareciam confirmar um bug no workflow —
    // acabou sendo falso alarme: era a codificação UTF-8 do meu próprio
    // teste em curl (texto acentuado tipo "Evolução" chegando corrompido,
    // ex: "Sess�o Regular"), não um bug do n8n. Retestado enviando o corpo
    // por arquivo (bypassando o shell) e funcionou: cria o Relatorio e
    // resolve corretamente os links Paciente/Autor/Atendimento. O fetch()
    // do navegador sempre serializa UTF-8 certo via JSON.stringify, então
    // esse problema nunca teria afetado o app de verdade — só meu teste.
    //
    // ATUALIZAÇÃO 2026-08-26: o caminho de conclusão (status "realizado")
    // foi corrigido no n8n e está confirmado funcionando — testado 2x do
    // zero (atendimento novo → criar Relatorio com atendimento_id +
    // status_presenca → Status_Presenca e Evolucao_Prontuario do Atendimento
    // são atualizados de verdade). Falta/Desmarcado/Cancelado ainda não
    // foram testados nesse fluxo (fora de escopo por enquanto, a pedido).
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

    // 2026-08-26: fluxo de conclusão (caso Realizado) testado e
    // confirmado funcionando — criar o Relatorio com atendimento_id +
    // status_presenca de fato atualiza Status_Presenca e Evolucao_Prontuario
    // do Atendimento linkado. O que continua confirmado como NÃO suportado:
    // Nivel_Engajamento e Recomendacao_Pos_Sessao não são gravados mesmo
    // enviados soltos no payload (testado) — por isso continuam
    // concatenados dentro do texto de Conteudo, igual o app antigo fazia.
    // Falta/Desmarcado/Cancelado ainda não foram testados neste fluxo
    // (fora de escopo por enquanto).
    buildRegisterPayload(patient, formData) {
        const isRealizado = formData.status === 'realizado';
        const isFaltaOuDesmarcado = formData.status === 'falta' || formData.status === 'desmarcado';
        const session = AuthApi.getSession();

        const conteudoParts = [];
        if (isRealizado) {
            if (formData.notes) conteudoParts.push(formData.notes);
            if (formData.engagement) {
                conteudoParts.push(`Engajamento: ${this.engagementLabels[formData.engagement] || formData.engagement}`);
            }
            if (formData.nextSteps) conteudoParts.push(`Recomendação pós-sessão: ${formData.nextSteps}`);
        } else if (isFaltaOuDesmarcado) {
            conteudoParts.push(`Justificativa: ${formData.justification || ''}`);
        }

        return {
            tipo: 'Evolução',
            paciente_nome: patient.name,
            atendimento_id: patient.id,
            autor_nome: (session && session.nome) || CONFIG.TERAPEUTA,
            data: (patient.dataHora || '').slice(0, 10),
            conteudo: conteudoParts.join('\n\n'),
            editado_por_nome: null,
            // Enviados também soltos, caso o workflow venha a usar campos
            // próprios em vez de só o texto de conteudo (não confirmado).
            status_presenca: this.mapInternalStatusToApi(formData.status),
            justificativa_falta: isFaltaOuDesmarcado ? formData.justification : null,
        };
    },
};
