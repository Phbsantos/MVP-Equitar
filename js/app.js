let patients = [];
let selectedPatientId = null;
let patientSearchAutocomplete = null;
let activeFilter = 'all';
let isRecordingSim = false;
let isLoading = false;
let isSaving = false;

function getSelectedDate() {
    return document.getElementById('selected-date').value;
}

function setLoadingState(loading) {
    isLoading = loading;
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
        overlay.classList.toggle('hidden', !loading);
    }
}

function setSavingState(saving) {
    isSaving = saving;
    const saveBtn = document.getElementById('save-btn');
    if (saveBtn) {
        saveBtn.disabled = saving;
        saveBtn.classList.toggle('opacity-60', saving);
        saveBtn.classList.toggle('cursor-not-allowed', saving);
    }
}

async function loadSchedule(date = getSelectedDate(), options = {}) {
    const { showSuccessToast = false } = options;
    setLoadingState(true);

    try {
        patients = await ApiService.fetchAtendimentosDia(date);

        if (patientSearchAutocomplete) {
            patientSearchAutocomplete.setOptions(
                patients.map((p) => ({ id: p.id, label: p.name, sublabel: p.time }))
            );
        }

        updateDashboardStats();
        renderPatientList(document.getElementById('patient-search').value);

        if (patients.length === 0) {
            selectedPatientId = null;
            document.getElementById('empty-state').classList.remove('hidden');
            document.getElementById('patient-form-panel').classList.add('hidden');
            if (showSuccessToast) {
                showToast('Nenhum atendimento encontrado para esta data.', 'info');
            }
            return;
        }

        const stillExists = patients.some((p) => p.id === selectedPatientId);
        if (!stillExists) {
            const firstPending = patients.find((p) => p.status === 'pending');
            selectPatient((firstPending || patients[0]).id);
        } else {
            selectPatient(selectedPatientId);
        }

        if (showSuccessToast) {
            showToast(`${patients.length} atendimento(s) carregado(s).`, 'success');
        }
    } catch (error) {
        console.error(error);
        patients = [];
        selectedPatientId = null;
        renderPatientList();
        updateDashboardStats();
        document.getElementById('empty-state').classList.remove('hidden');
        document.getElementById('patient-form-panel').classList.add('hidden');
        showToast(error.message || 'Falha ao carregar a agenda do dia.', 'error');
    } finally {
        setLoadingState(false);
        lucide.createIcons();
    }
}

function renderPatientList(searchTerm = '') {
    const container = document.getElementById('patient-list-container');
    container.innerHTML = '';

    const filtered = patients.filter((p) => {
        const term = searchTerm.toLowerCase();
        const matchesSearch =
            p.name.toLowerCase().includes(term) ||
            String(p.atendimentoNum).includes(term) ||
            p.id.toLowerCase().includes(term);

        if (activeFilter === 'pending') return matchesSearch && p.status === 'pending';
        if (activeFilter === 'done') return matchesSearch && p.status !== 'pending';
        return matchesSearch;
    });

    document.getElementById('patient-count-badge').innerText = `${filtered.length} Pacientes`;

    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="p-6 text-center text-slate-400 text-xs">
                Nenhum paciente encontrado para os filtros selecionados.
            </div>
        `;
        return;
    }

    filtered.forEach((p) => {
        const isSelected = p.id === selectedPatientId;
        const card = document.createElement('div');
        card.className = `p-3 rounded-xl cursor-pointer transition border ${
            isSelected
                ? 'bg-clinical-50/80 border-clinical-500 shadow-sm'
                : 'bg-white hover:bg-slate-50 border-transparent hover:border-slate-200'
        }`;
        card.onclick = () => selectPatient(p.id);

        let badgeClass = 'bg-amber-100 text-amber-800 border-amber-200';
        let badgeText = 'Pendente';
        let statusIcon = 'clock';

        if (p.status === 'realizado') {
            badgeClass = 'bg-emerald-100 text-emerald-800 border-emerald-200';
            badgeText = 'Concluído';
            statusIcon = 'check-circle';
        } else if (p.status === 'falta') {
            badgeClass = 'bg-rose-100 text-rose-800 border-rose-200';
            badgeText = 'Falta';
            statusIcon = 'user-x';
        } else if (p.status === 'desmarcado') {
            badgeClass = 'bg-amber-100 text-amber-900 border-amber-200';
            badgeText = 'Desmarcado';
            statusIcon = 'alert-circle';
        } else if (p.status === 'cancelado') {
            badgeClass = 'bg-slate-200 text-slate-800 border-slate-300';
            badgeText = 'Cancelado';
            statusIcon = 'ban';
        }

        const initials = p.name
            .split(' ')
            .filter(Boolean)
            .map((n) => n[0])
            .slice(0, 2)
            .join('')
            .toUpperCase();

        card.innerHTML = `
            <div class="flex items-center justify-between">
                <div class="flex items-center space-x-3">
                    <div class="w-9 h-9 rounded-lg ${isSelected ? 'bg-clinical-600 text-white' : 'bg-slate-100 text-slate-600'} font-bold flex items-center justify-center text-xs shrink-0">
                        ${initials || 'P'}
                    </div>
                    <div>
                        <h4 class="font-bold text-slate-900 text-xs sm:text-sm leading-snug">${p.name}</h4>
                        <p class="text-[11px] text-slate-500">${p.time}${p.age ? ` • ${p.age}` : ''}</p>
                    </div>
                </div>
                <div class="flex flex-col items-end gap-1">
                    <span class="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded-full border ${badgeClass}">
                        <i data-lucide="${statusIcon}" class="w-3 h-3"></i>
                        ${badgeText}
                    </span>
                </div>
            </div>
        `;
        container.appendChild(card);
    });

    lucide.createIcons();
}

function selectPatient(patientId) {
    selectedPatientId = patientId;
    const patient = patients.find((p) => p.id === patientId);
    if (!patient) return;

    document.getElementById('empty-state').classList.add('hidden');
    document.getElementById('patient-form-panel').classList.remove('hidden');

    document.getElementById('active-name').innerText = patient.name;
    // 2026-09-08: patient.id agora é um inteiro de verdade (Postgres),
    // não mais um record ID tipo "recXXXXXXXXXXXXXXX" — .slice(-6) num
    // number quebra (TypeError). Zero-pad no lugar do truncamento.
    document.getElementById('active-id').innerText = `ATD-${patient.atendimentoNum || String(patient.id).padStart(4, '0')}`;
    document.getElementById('active-age').innerText = patient.age || 'Idade não informada';
    document.getElementById('active-specialty').innerText = patient.specialty;

    const initials = patient.name
        .split(' ')
        .filter(Boolean)
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();
    document.getElementById('active-avatar').innerText = initials || 'P';

    const badge = document.getElementById('active-status-badge');
    if (patient.status === 'pending') {
        badge.className = 'px-2 py-0.5 text-xs font-semibold rounded-full bg-amber-100 text-amber-800 border border-amber-200';
        badge.innerText = 'Pendente';
    } else if (patient.status === 'realizado') {
        badge.className = 'px-2 py-0.5 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200';
        badge.innerText = 'Concluído (Realizado)';
    } else {
        badge.className = 'px-2 py-0.5 text-xs font-semibold rounded-full bg-rose-100 text-rose-800 border border-rose-200';
        badge.innerText = `Registrado (${patient.status})`;
    }

    const currentStatus = patient.status === 'pending' ? 'realizado' : patient.status;
    setRadioStatus(currentStatus);

    document.getElementById('clinical-notes').value = patient.notes || '';
    document.getElementById('justification-text').value = patient.justification || '';
    document.getElementById('engagement-level').value = patient.engagement || 'adequado';
    document.getElementById('next-steps').value = patient.nextSteps || '';

    updateCharCount();
    handleStatusChange(currentStatus);
    renderPatientList(document.getElementById('patient-search').value);

    // Uma vez Realizado e já enviado, terapeuta não edita mais a evolução
    // — só visualiza. Supervisor/Coordenador/Admin não são afetados por
    // essa trava (a regra é especificamente sobre o perfil Terapeuta).
    const session = AuthApi.getSession();
    const bloqueado = patient.status === 'realizado' && session && session.perfilRole === 'Terapeuta';
    setFormLocked(bloqueado);
}

// Desabilita todo o formulário de registro (radios, texto, selects,
// botões de modelo/voz e salvar) — usado quando um Terapeuta abre um
// atendimento que ele mesmo já concluiu e enviou.
function setFormLocked(locked) {
    document.getElementById('locked-banner').classList.toggle('hidden', !locked);

    document.getElementsByName('attendance-status').forEach((r) => (r.disabled = locked));
    document.getElementById('justification-text').disabled = locked;
    document.getElementById('clinical-notes').disabled = locked;
    document.getElementById('engagement-level').disabled = locked;
    document.getElementById('next-steps').disabled = locked;
    document.querySelectorAll('.template-btn').forEach((btn) => (btn.disabled = locked));
    document.getElementById('mic-btn').disabled = locked;

    const saveBtn = document.getElementById('save-btn');
    const resetBtn = document.getElementById('reset-btn');
    saveBtn.disabled = locked;
    resetBtn.disabled = locked;
    saveBtn.classList.toggle('opacity-60', locked);
    saveBtn.classList.toggle('cursor-not-allowed', locked);
    resetBtn.classList.toggle('opacity-60', locked);
    resetBtn.classList.toggle('cursor-not-allowed', locked);
}

function setRadioStatus(status) {
    const radios = document.getElementsByName('attendance-status');
    radios.forEach((r) => {
        r.checked = r.value === status;
    });
    updateRadioStyles(status);
}

function handleStatusChange(status) {
    updateRadioStyles(status);
    const justificationContainer = document.getElementById('justification-container');

    if (status === 'falta' || status === 'desmarcado') {
        justificationContainer.classList.remove('hidden');
    } else {
        justificationContainer.classList.add('hidden');
    }
}

function updateRadioStyles(selectedStatus) {
    const options = ['realizado', 'falta', 'desmarcado', 'cancelado'];
    const colorMap = {
        realizado: 'border-emerald-500 bg-emerald-50/30 ring-2 ring-emerald-500/20',
        falta: 'border-rose-500 bg-rose-50/30 ring-2 ring-rose-500/20',
        desmarcado: 'border-amber-500 bg-amber-50/30 ring-2 ring-amber-500/20',
        cancelado: 'border-slate-500 bg-slate-100/50 ring-2 ring-slate-500/20',
    };

    options.forEach((opt) => {
        const label = document.getElementById(`label-status-${opt}`);
        if (opt === selectedStatus) {
            label.className = `relative flex items-center p-3 rounded-xl border cursor-pointer transition ${colorMap[opt]}`;
        } else {
            label.className =
                'relative flex items-center p-3 rounded-xl border border-slate-200 cursor-pointer transition hover:bg-slate-50';
        }
    });
}

function updateCharCount() {
    const text = document.getElementById('clinical-notes').value;
    document.getElementById('char-count').innerText = text.length;
}

function insertTemplate(type) {
    const textarea = document.getElementById('clinical-notes');
    let templateText = '';

    if (type === 'padrao') {
        templateText =
            'Sessão realizada com foco no plano terapêutico individualizado. Paciente apresentou bom engajamento e cumpriu as atividades propostas com auxílio moderado. Sinais vitais estáveis. Sem intercorrências.';
    } else if (type === 'avd') {
        templateText =
            'Treino de Atividades de Vida Diária (AVDs) focando em independência funcional. Trabalhada coordenação motora fina, preensão e alcance. Paciente demonstrou melhora na precisão dos movimentos.';
    } else if (type === 'sensorial') {
        templateText =
            'Atendimento baseado na Integração Sensorial. Utilizados estímulos táteis e vestibulares controlados para regulação do estado de alerta. Paciente aceitou bem as transições de atividades.';
    }

    if (textarea.value.trim().length > 0) {
        textarea.value += `\n\n${templateText}`;
    } else {
        textarea.value = templateText;
    }

    updateCharCount();
    showToast('Modelo de texto inserido!');
}

function toggleVoiceSim() {
    const micBtn = document.getElementById('mic-btn');
    const micIcon = document.getElementById('mic-icon');
    const micText = document.getElementById('mic-text');
    const textarea = document.getElementById('clinical-notes');

    if (!isRecordingSim) {
        isRecordingSim = true;
        micBtn.classList.add('text-rose-600', 'font-bold');
        micText.innerText = 'Ouvindo... (Clique para parar)';
        micIcon.classList.add('animate-pulse');
        showToast('Ditado por voz iniciado...');

        setTimeout(() => {
            if (isRecordingSim) {
                const voicePhrase =
                    ' [Transcrição de voz: Paciente relata boa adaptação aos exercícios propostos na última semana].';
                textarea.value += voicePhrase;
                updateCharCount();
                toggleVoiceSim();
            }
        }, 3000);
    } else {
        isRecordingSim = false;
        micBtn.classList.remove('text-rose-600', 'font-bold');
        micText.innerText = 'Simular Ditado por Voz';
        micIcon.classList.remove('animate-pulse');
    }
}

async function saveAttendance() {
    if (!selectedPatientId || isSaving) return;

    const patient = patients.find((p) => p.id === selectedPatientId);
    if (!patient) return;

    // Segunda barreira além de desabilitar os campos na tela — mesmo que
    // alguém force reativar um input pelo devtools, o salvamento em si
    // recusa.
    const session = AuthApi.getSession();
    if (patient.status === 'realizado' && session && session.perfilRole === 'Terapeuta') {
        showToast('Este atendimento já foi concluído — terapeutas não podem mais editar a evolução.', 'error');
        return;
    }

    const radios = document.getElementsByName('attendance-status');
    let selectedStatus = 'realizado';
    radios.forEach((r) => {
        if (r.checked) selectedStatus = r.value;
    });

    const notes = document.getElementById('clinical-notes').value.trim();
    const justification = document.getElementById('justification-text').value.trim();
    const engagement = document.getElementById('engagement-level').value;
    const nextSteps = document.getElementById('next-steps').value.trim();

    if (selectedStatus === 'realizado' && notes.length < 5) {
        showToast('Por favor, preencha o relato da sessão antes de salvar.', 'error');
        return;
    }

    if ((selectedStatus === 'falta' || selectedStatus === 'desmarcado') && justification.length < 3) {
        showToast('Por favor, informe a justificativa da ausência.', 'error');
        return;
    }

    const formData = { status: selectedStatus, notes, justification, engagement, nextSteps };
    const payload = ApiService.buildRegisterPayload(patient, formData);

    setSavingState(true);

    try {
        await ApiService.registerAtendimento(payload);

        patient.status = selectedStatus;
        patient.notes = notes;
        patient.justification = justification;
        patient.engagement = engagement;
        patient.nextSteps = nextSteps;
        patient.apiStatus = ApiService.mapInternalStatusToApi(selectedStatus);

        renderPatientList(document.getElementById('patient-search').value);
        updateDashboardStats();
        selectPatient(selectedPatientId);

        showToast(`Atendimento de ${patient.name} gravado com sucesso!`, 'success');
        checkAtendimentosPendentesAnteriores();

        const nextPending = patients.find((p) => p.status === 'pending');
        if (nextPending) {
            setTimeout(() => {
                selectPatient(nextPending.id);
                showToast(`Avançando para o próximo paciente: ${nextPending.name}`, 'info');
            }, 1000);
        }
    } catch (error) {
        console.error(error);
        showToast(error.message || 'Erro ao salvar o atendimento. Tente novamente.', 'error');
    } finally {
        setSavingState(false);
    }
}

function resetForm() {
    if (selectedPatientId) {
        selectPatient(selectedPatientId);
        showToast('Alterações descartadas.');
    }
}

function updateDashboardStats() {
    const total = patients.length;
    const completed = patients.filter((p) => p.status === 'realizado').length;
    const pending = patients.filter((p) => p.status === 'pending').length;
    const absent = patients.filter((p) => ['falta', 'desmarcado', 'cancelado'].includes(p.status)).length;

    document.getElementById('stat-total').innerText = total;
    document.getElementById('stat-completed').innerText = completed;
    document.getElementById('stat-pending').innerText = pending;
    document.getElementById('stat-absent').innerText = absent;
}

function filterPatients(filter) {
    activeFilter = filter;
    document.querySelectorAll('.filter-btn').forEach((btn) => {
        btn.className =
            'filter-btn flex-1 py-1 rounded-md text-center text-slate-600 hover:text-slate-900 transition';
    });
    document.getElementById(`filter-${filter}`).className =
        'filter-btn flex-1 py-1 rounded-md text-center bg-white shadow-sm text-slate-800 font-semibold transition';

    renderPatientList(document.getElementById('patient-search').value);
}

const TIMELINE_STATUS_META = {
    realizado: { badge: 'bg-emerald-100 text-emerald-800', dot: 'bg-emerald-500', label: 'Realizado' },
    falta: { badge: 'bg-rose-100 text-rose-800', dot: 'bg-rose-500', label: 'Falta sem Aviso' },
    desmarcado: { badge: 'bg-amber-100 text-amber-800', dot: 'bg-amber-500', label: 'Desmarcado com Aviso' },
    cancelado: { badge: 'bg-slate-300 text-slate-800', dot: 'bg-slate-400', label: 'Cancelado' },
};

// Linha do tempo do dia: busca no servidor por paciente_id + a data que está
// selecionada na agenda (não necessariamente "hoje" no relógio — o terapeuta
// pode estar revisando outro dia), cruzando qualquer terapeuta/especialidade
// que tenha atendido esse paciente nessa data. Ver
// ApiService.fetchTimelineAtendimentosPaciente pro porquê de não filtrar por
// terapeuta_id.
async function openHistoryModal() {
    if (!selectedPatientId) return;
    const patient = patients.find((p) => p.id === selectedPatientId);
    if (!patient) return;

    document.getElementById('modal-patient-info').innerText = `${patient.name} • ATD-${patient.atendimentoNum || String(patient.id).padStart(4, '0')}`;
    const container = document.getElementById('modal-history-content');
    container.innerHTML = '<div class="text-center p-8 text-slate-400 text-xs">Carregando linha do tempo...</div>';
    document.getElementById('history-modal').classList.remove('hidden');

    let timeline = [];
    try {
        timeline = await ApiService.fetchTimelineAtendimentosPaciente(patient.pacienteId, getSelectedDate());
    } catch (error) {
        console.error(error);
        container.innerHTML = `
            <div class="text-center p-8 text-rose-500 text-xs">
                Não foi possível carregar a linha do tempo de hoje. Tente novamente.
            </div>
        `;
        return;
    }

    renderTimeline(container, timeline);
    lucide.createIcons();
}

function renderTimeline(container, timeline) {
    container.innerHTML = '';

    if (timeline.length === 0) {
        container.innerHTML = `
            <div class="text-center p-8 text-slate-400 text-xs">
                Nenhum atendimento registrado para este paciente nesta data.
            </div>
        `;
        return;
    }

    const list = document.createElement('div');
    list.className = 'relative pl-7';

    const line = document.createElement('div');
    line.className = 'absolute left-[9px] top-2 bottom-2 w-px bg-slate-200';
    list.appendChild(line);

    timeline.forEach((item, index) => {
        const meta = TIMELINE_STATUS_META[item.status] || TIMELINE_STATUS_META.realizado;
        const isRealizado = item.status === 'realizado';
        const detailId = `timeline-detail-${item.id}`;

        const entry = document.createElement('div');
        entry.className = `relative ${index < timeline.length - 1 ? 'mb-4' : ''}`;

        const detailText = isRealizado
            ? item.notes || 'Sem relato registrado.'
            : `Justificativa: ${item.justification || 'não informada'}`;

        const extraDetails = isRealizado
            ? `
                ${item.engagement ? `<p class="mt-2 text-[11px] text-slate-400">Engajamento: ${ApiService.engagementLabels[item.engagement] || item.engagement}</p>` : ''}
                ${item.nextSteps ? `<p class="mt-1 text-[11px] text-slate-400">Próximos passos: ${item.nextSteps}</p>` : ''}
            `
            : '';

        entry.innerHTML = `
            <span class="absolute -left-7 top-1.5 w-3 h-3 rounded-full ring-4 ring-white ${meta.dot}"></span>
            <button type="button" onclick="toggleTimelineDetail('${detailId}', this)" class="w-full text-left border border-slate-200 rounded-xl p-3 bg-slate-50/50 hover:bg-slate-100/70 transition">
                <div class="flex items-center justify-between gap-2 text-xs">
                    <span class="font-bold text-slate-700 flex items-center gap-1.5">
                        <i data-lucide="clock" class="w-3.5 h-3.5 text-slate-400"></i>
                        ${item.time}
                    </span>
                    <span class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${meta.badge}">${meta.label}</span>
                </div>
                <div class="mt-1.5 flex items-center justify-between gap-2">
                    <p class="text-xs text-slate-600">
                        <span class="font-semibold">${item.tipoAtendimento || 'Atendimento'}</span>
                        · ${item.therapistName || 'Terapeuta não informado'}
                    </p>
                    <i data-lucide="chevron-down" class="chevron w-4 h-4 text-slate-400 transition-transform shrink-0"></i>
                </div>
            </button>
            <div id="${detailId}" class="hidden mt-2 ml-1 p-3 rounded-lg bg-white border border-slate-100 text-xs text-slate-600 leading-relaxed">
                ${detailText}
                ${extraDetails}
            </div>
        `;

        list.appendChild(entry);
    });

    container.appendChild(list);
}

function toggleTimelineDetail(detailId, buttonEl) {
    const detail = document.getElementById(detailId);
    if (!detail) return;
    detail.classList.toggle('hidden');
    const chevron = buttonEl.querySelector('.chevron');
    if (chevron) chevron.classList.toggle('rotate-180');
}

function closeHistoryModal() {
    document.getElementById('history-modal').classList.add('hidden');
}

let pendentesAnterioresCache = [];

// Verifica atendimentos que ficaram "Agendado" em dias ANTERIORES a hoje —
// nunca foram fechados. Roda ao carregar a página e de novo depois de cada
// atendimento salvo, pra o aviso sumir/atualizar sozinho.
async function checkAtendimentosPendentesAnteriores() {
    const session = AuthApi.getSession();
    if (!session) return;

    try {
        pendentesAnterioresCache = await ApiService.fetchAtendimentosPendentesAnteriores(session.id);
    } catch (error) {
        console.error(error);
        return; // é só um aviso -- falhar aqui não deve travar a agenda
    }

    const banner = document.getElementById('pendentes-anteriores-banner');
    const texto = document.getElementById('pendentes-anteriores-texto');
    if (!banner || !texto) return;

    if (pendentesAnterioresCache.length === 0) {
        banner.classList.add('hidden');
        return;
    }

    const plural = pendentesAnterioresCache.length > 1;
    texto.innerText = `Você tem ${pendentesAnterioresCache.length} atendimento${plural ? 's' : ''} pendente${plural ? 's' : ''} de dias anteriores, ainda como "Agendado".`;
    banner.classList.remove('hidden');
    lucide.createIcons();
}

function openPendentesAnterioresModal() {
    const container = document.getElementById('pendentes-modal-content');
    if (!container) return;

    renderPendentesAnterioresLista(container, pendentesAnterioresCache);
    lucide.createIcons();
    document.getElementById('pendentes-modal').classList.remove('hidden');
}

function closePendentesAnterioresModal() {
    document.getElementById('pendentes-modal').classList.add('hidden');
}

function renderPendentesAnterioresLista(container, lista) {
    container.innerHTML = '';

    if (lista.length === 0) {
        container.innerHTML = `
            <div class="text-center p-8 text-slate-400 text-xs">
                Nenhum atendimento pendente de dias anteriores.
            </div>
        `;
        return;
    }

    lista.forEach((item) => {
        const row = document.createElement('div');
        row.className = 'flex items-center justify-between gap-3 border border-slate-200 rounded-xl p-3 bg-slate-50/50';
        row.innerHTML = `
            <div class="min-w-0">
                <p class="text-sm font-bold text-slate-800 truncate">${item.name}</p>
                <p class="text-xs text-slate-500">
                    ${ApiService.formatDate(item.dataHora)} às ${item.time} · ${item.tipoAtendimento || 'Atendimento'}
                </p>
            </div>
            <button type="button" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-300 text-amber-700 text-xs font-semibold hover:bg-amber-50 transition shrink-0">
                Finalizar
                <i data-lucide="arrow-right" class="w-3.5 h-3.5"></i>
            </button>
        `;
        row.querySelector('button').addEventListener('click', () => finalizarPendenteAnterior(item));
        container.appendChild(row);
    });
}

// Em vez de fechar o atendimento direto de dentro do modal (duplicaria toda
// a validação que já existe em saveAttendance), leva o terapeuta pro dia
// certo na agenda com o paciente já selecionado — um clique a mais, zero
// regra de negócio reimplementada.
async function finalizarPendenteAnterior(item) {
    closePendentesAnterioresModal();

    const dataAtendimento = (item.dataHora || '').slice(0, 10);
    document.getElementById('selected-date').value = dataAtendimento;
    selectedPatientId = null;

    await loadSchedule(dataAtendimento);
    selectPatient(item.id);

    showToast(`Abrindo o atendimento de ${item.name} em ${ApiService.formatDate(item.dataHora)} pra você finalizar.`, 'info');
}

let relatoriosPendentesCienciaCache = [];
let relatorioCienciaIndiceAtual = 0;

// Relatórios de Evolução que este terapeuta escreveu e que foram alterados
// por outra pessoa (normalmente Coordenação) sem ele ainda ter respondido.
// Modal obrigatório (sem botão de fechar) -- ele precisa dar ciência antes
// de seguir. Discordar não abre um fluxo de contestação dentro do app: só
// registra a resposta "não concordo" e orienta a falar direto com quem
// editou (ver ApiService.confirmarCienciaRelatorio).
async function checkRelatoriosPendentesCiencia() {
    const session = AuthApi.getSession();
    if (!session) return;

    try {
        relatoriosPendentesCienciaCache = await ApiService.fetchRelatoriosPendentesCiencia(session.id);
    } catch (error) {
        console.error(error);
        return;
    }

    relatorioCienciaIndiceAtual = 0;
    if (relatoriosPendentesCienciaCache.length > 0) {
        renderRelatorioCienciaModal();
    }
}

function renderRelatorioCienciaModal() {
    const item = relatoriosPendentesCienciaCache[relatorioCienciaIndiceAtual];
    const modal = document.getElementById('relatorio-ciencia-modal');
    if (!modal) return;

    if (!item) {
        modal.classList.add('hidden');
        return;
    }

    document.getElementById('ciencia-contador').innerText =
        relatoriosPendentesCienciaCache.length > 1
            ? `${relatorioCienciaIndiceAtual + 1} de ${relatoriosPendentesCienciaCache.length}`
            : '';
    document.getElementById('ciencia-paciente').innerText = item.pacienteNome;
    document.getElementById('ciencia-data').innerText = ApiService.formatDate(item.data);
    document.getElementById('ciencia-editor').innerText =
        item.editadoPorNome + (item.editadoPorEmail ? ` (${item.editadoPorEmail})` : '');
    document.getElementById('ciencia-conteudo').innerText = item.conteudo || 'Sem conteúdo registrado.';

    modal.classList.remove('hidden');
    lucide.createIcons();
}

async function responderCienciaRelatorio(decisao) {
    const item = relatoriosPendentesCienciaCache[relatorioCienciaIndiceAtual];
    if (!item) return;

    try {
        await ApiService.confirmarCienciaRelatorio(item.id, decisao);
    } catch (error) {
        console.error(error);
        showToast(error.message || 'Erro ao registrar sua resposta. Tente novamente.', 'error');
        return;
    }

    showToast(
        decisao === 'nao_concordo'
            ? `Registrado. Entre em contato com ${item.editadoPorNome} pra alinhar essa alteração.`
            : 'Ciência registrada.',
        decisao === 'nao_concordo' ? 'info' : 'success'
    );

    relatorioCienciaIndiceAtual += 1;
    renderRelatorioCienciaModal();
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');

    let bgClass = 'bg-slate-900 text-white';
    let icon = 'info';

    if (type === 'success') {
        bgClass = 'bg-emerald-600 text-white';
        icon = 'check-circle-2';
    } else if (type === 'error') {
        bgClass = 'bg-rose-600 text-white';
        icon = 'alert-circle';
    }

    toast.className = `flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg text-xs font-semibold ${bgClass} transition-all duration-300 pointer-events-auto transform translate-y-2 opacity-0`;
    toast.innerHTML = `
        <i data-lucide="${icon}" class="w-4 h-4 shrink-0"></i>
        <span>${message}</span>
    `;

    container.appendChild(toast);
    lucide.createIcons();

    setTimeout(() => {
        toast.classList.remove('translate-y-2', 'opacity-0');
    }, 10);

    setTimeout(() => {
        toast.classList.add('opacity-0', 'translate-y-2');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

window.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();

    document.getElementById('selected-date').value = new Date().toISOString().split('T')[0];

    document.getElementById('patient-search').addEventListener('input', (e) => {
        renderPatientList(e.target.value);
    });

    // Autocomplete com sugestão por cima do filtro ao vivo já existente
    // (os dois convivem — o filtro continua atualizando a lista a cada
    // tecla; escolher uma sugestão aqui abre o paciente direto).
    patientSearchAutocomplete = attachAutocomplete(document.getElementById('patient-search'), {
        options: [],
        onSelect: (opt) => selectPatient(opt.id),
    });

    document.getElementById('selected-date').addEventListener('change', () => {
        selectedPatientId = null;
        loadSchedule(getSelectedDate(), { showSuccessToast: true });
    });

    document.getElementById('refresh-btn')?.addEventListener('click', () => {
        loadSchedule(getSelectedDate(), { showSuccessToast: true });
    });

    loadSchedule();
    checkAtendimentosPendentesAnteriores();
    checkRelatoriosPendentesCiencia();
});
