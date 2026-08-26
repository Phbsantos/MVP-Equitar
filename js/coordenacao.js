function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text ?? '';
    return div.innerHTML;
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    let bgClass = 'bg-slate-900 text-white';
    let icon = 'info';

    if (type === 'error') {
        bgClass = 'bg-rose-600 text-white';
        icon = 'alert-circle';
    } else if (type === 'success') {
        bgClass = 'bg-emerald-600 text-white';
        icon = 'check-circle-2';
    }

    toast.className = `flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg text-xs font-semibold ${bgClass} transition-all duration-300 pointer-events-auto transform translate-y-2 opacity-0`;
    toast.innerHTML = `<i data-lucide="${icon}" class="w-4 h-4 shrink-0"></i><span>${escapeHtml(message)}</span>`;
    container.appendChild(toast);
    lucide.createIcons();

    setTimeout(() => toast.classList.remove('translate-y-2', 'opacity-0'), 10);
    setTimeout(() => {
        toast.classList.add('opacity-0', 'translate-y-2');
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

function formatDate(isoDate) {
    if (!isoDate) return '--';
    return new Date(isoDate).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

function formatTime(isoDate) {
    if (!isoDate) return '--:--';
    return new Date(isoDate).toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'America/Sao_Paulo',
    });
}

// Vira YYYY-MM-DD (o que <input type="date"> espera), aceitando tanto uma
// data ISO completa quanto só a data.
function toDateInputValue(value) {
    if (!value) return '';
    return String(value).slice(0, 10);
}

// -----------------------------------------------------------------------
// Edição em sessão — sem backend ainda (a pedido). As alterações de
// data/conteúdo de um relatório ficam em sessionStorage, então somem ao
// fechar a aba/navegador, mas sobrevivem a um F5 dentro da mesma sessão.
// -----------------------------------------------------------------------
const RELATORIO_EDITS_KEY = 'equitar_coordenacao_relatorio_edits';

function getRelatorioEdits() {
    try {
        return JSON.parse(sessionStorage.getItem(RELATORIO_EDITS_KEY)) || {};
    } catch (e) {
        return {};
    }
}

function saveRelatorioEditToSession(id, { data, conteudo }) {
    const edits = getRelatorioEdits();
    edits[id] = { data, conteudo };
    sessionStorage.setItem(RELATORIO_EDITS_KEY, JSON.stringify(edits));
}

// Aplica a edição salva por cima do relatório vindo da API, sem mutar o
// original — assim o filtro/re-render sempre parte do dado "de verdade" +
// o que foi editado nesta sessão.
function withSessionEdits(relatorio) {
    if (!relatorio) return relatorio;
    const edit = getRelatorioEdits()[relatorio.id];
    if (!edit) return relatorio;
    return { ...relatorio, data: edit.data, conteudo: edit.conteudo, editadoNaSessao: true };
}

// -----------------------------------------------------------------------
// Estado carregado uma vez — trocar de aba ou filtrar depois é só
// re-render, sem round-trip novo à API.
// -----------------------------------------------------------------------
let allAtendimentos = [];
let allRelatorios = [];
let editingRelatorioId = null;

function findRelatorioById(id) {
    const direto = allRelatorios.find((r) => r.id === id);
    if (direto) return direto;

    for (const atendimento of allAtendimentos) {
        if (atendimento.relatorio && atendimento.relatorio.id === id) return atendimento.relatorio;
    }
    return null;
}

// -----------------------------------------------------------------------
// Abas
// -----------------------------------------------------------------------
function switchCoordenacaoTab(tab) {
    ['atendimentos', 'relatorios', 'indicadores'].forEach((t) => {
        document.getElementById(`tab-btn-${t}`).className = t === tab ? 'segmented-btn active' : 'segmented-btn';
        document.getElementById(`tab-panel-${t}`).classList.toggle('hidden', t !== tab);
    });

    if (tab === 'indicadores' && !window.__coordenacaoIndicadoresLoaded) {
        window.__coordenacaoIndicadoresLoaded = true;
        loadIndicadores();
    }
}

// -----------------------------------------------------------------------
// Aba Atendimentos — cards com o relatório vinculado (se houver) já
// visível no próprio card.
// -----------------------------------------------------------------------
function renderAtendimentoCard(atendimento) {
    const relatorio = atendimento.relatorio ? withSessionEdits(atendimento.relatorio) : null;

    return `
        <div class="card p-5 flex flex-col gap-3">
            <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                    <h3 class="text-base font-bold truncate" style="color:var(--ink)">${escapeHtml(atendimento.pacienteNome)}</h3>
                    <p class="text-xs mt-1 flex items-center gap-1.5" style="color:var(--ink-soft)">
                        <i data-lucide="calendar" class="w-3.5 h-3.5"></i>
                        ${formatDate(atendimento.dataHora)} às ${formatTime(atendimento.dataHora)}
                    </p>
                    <p class="text-xs mt-0.5 flex items-center gap-1.5" style="color:var(--ink-soft)">
                        <i data-lucide="user-round" class="w-3.5 h-3.5"></i>
                        ${escapeHtml(atendimento.terapeutaNome)}
                    </p>
                </div>
                ${atendimento.planoSaude ? `<span class="badge badge--brand shrink-0">${escapeHtml(atendimento.planoSaude)}</span>` : ''}
            </div>

            <div class="pt-3" style="border-top:1px solid var(--border)">
                ${
                    relatorio
                        ? `
                    <div class="flex items-center justify-between gap-2 mb-1.5">
                        <p class="text-[11px] font-bold uppercase tracking-wider" style="color:var(--ink-faint)">
                            Evolução${relatorio.editadoNaSessao ? ' · editado nesta sessão' : ''}
                        </p>
                        <button onclick="openEditRelatorioModal('${relatorio.id}')" class="btn-icon" style="width:1.75rem;height:1.75rem;" title="Editar relatório">
                            <i data-lucide="pencil" class="w-3.5 h-3.5"></i>
                        </button>
                    </div>
                    <p class="text-sm leading-relaxed line-clamp-4" style="color:var(--ink)">${escapeHtml(relatorio.conteudo) || '<span class="italic">Sem conteúdo registrado.</span>'}</p>
                `
                        : `<p class="text-xs italic" style="color:var(--ink-faint)">Sem relatório vinculado a este atendimento.</p>`
                }
            </div>
        </div>
    `;
}

function renderAtendimentosTab() {
    const container = document.getElementById('atendimentos-container');
    const empty = document.getElementById('atendimentos-empty');

    if (allAtendimentos.length === 0) {
        container.innerHTML = '';
        empty.classList.remove('hidden');
        return;
    }

    empty.classList.add('hidden');
    container.innerHTML = allAtendimentos.map(renderAtendimentoCard).join('');
    lucide.createIcons();
}

// -----------------------------------------------------------------------
// Aba Relatórios — filtros por data, paciente, plano e terapeuta.
// -----------------------------------------------------------------------
function populateRelatorioFilterOptions() {
    const planos = [...new Set(allRelatorios.map((r) => r.planoSaude).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b, 'pt-BR')
    );
    const terapeutas = [...new Set(allRelatorios.map((r) => r.autorNome).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b, 'pt-BR')
    );

    const planoSelect = document.getElementById('filter-relatorio-plano');
    const terapeutaSelect = document.getElementById('filter-relatorio-terapeuta');

    planoSelect.innerHTML =
        '<option value="">Todos os planos</option>' +
        planos.map((p) => `<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`).join('');

    terapeutaSelect.innerHTML =
        '<option value="">Todos os terapeutas</option>' +
        terapeutas.map((t) => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join('');
}

function getRelatorioFilters() {
    return {
        paciente: document.getElementById('filter-relatorio-paciente').value.trim().toLowerCase(),
        plano: document.getElementById('filter-relatorio-plano').value,
        terapeuta: document.getElementById('filter-relatorio-terapeuta').value,
        dataInicio: document.getElementById('filter-relatorio-data-inicio').value,
        dataFim: document.getElementById('filter-relatorio-data-fim').value,
    };
}

function applyRelatorioFilters(relatorios, filters) {
    return relatorios.filter((r) => {
        if (filters.paciente && !r.pacienteNome.toLowerCase().includes(filters.paciente)) return false;
        if (filters.plano && r.planoSaude !== filters.plano) return false;
        if (filters.terapeuta && r.autorNome !== filters.terapeuta) return false;

        if (r.data) {
            const data = new Date(r.data);
            if (filters.dataInicio && data < new Date(filters.dataInicio)) return false;
            if (filters.dataFim && data > new Date(`${filters.dataFim}T23:59:59`)) return false;
        }

        return true;
    });
}

function renderRelatorioCard(relatorioOriginal) {
    const relatorio = withSessionEdits(relatorioOriginal);
    const tipoBadgeClass = relatorio.tipo === 'Evolução' ? 'badge--ok' : 'badge--brand';

    return `
        <div class="card p-5 flex flex-col gap-3">
            <div class="flex items-start justify-between gap-3 flex-wrap">
                <div>
                    <h3 class="text-base font-bold" style="color:var(--ink)">${escapeHtml(relatorio.pacienteNome)}</h3>
                    <p class="text-xs mt-0.5" style="color:var(--ink-soft)">
                        ${formatDate(relatorio.data)} · ${escapeHtml(relatorio.autorNome)}${relatorio.planoSaude ? ` · ${escapeHtml(relatorio.planoSaude)}` : ''}
                    </p>
                </div>
                <div class="flex items-center gap-2 shrink-0">
                    <span class="badge ${tipoBadgeClass}">${escapeHtml(relatorio.tipo)}</span>
                    <button onclick="openEditRelatorioModal('${relatorio.id}')" class="btn-icon" style="width:1.75rem;height:1.75rem;" title="Editar relatório">
                        <i data-lucide="pencil" class="w-3.5 h-3.5"></i>
                    </button>
                </div>
            </div>

            <p class="text-sm leading-relaxed" style="color:var(--ink)">${escapeHtml(relatorio.conteudo) || '<span class="italic">Sem conteúdo registrado.</span>'}</p>

            ${relatorio.editadoNaSessao ? `<p class="text-[11px] font-semibold" style="color:var(--brand-600)">Editado nesta sessão — ainda não sincronizado com a base.</p>` : ''}
        </div>
    `;
}

function renderRelatoriosTab() {
    const filters = getRelatorioFilters();
    const filtered = applyRelatorioFilters(allRelatorios, filters);

    const container = document.getElementById('relatorios-container');
    const empty = document.getElementById('relatorios-empty');
    const countBadge = document.getElementById('relatorios-count-badge');

    countBadge.innerText = `${filtered.length} relatório(s)`;

    if (filtered.length === 0) {
        container.innerHTML = '';
        empty.classList.remove('hidden');
        return;
    }

    empty.classList.add('hidden');
    container.innerHTML = filtered.map(renderRelatorioCard).join('');
    lucide.createIcons();
}

function clearRelatorioFilters() {
    document.getElementById('filterFormRelatorios').reset();
    renderRelatoriosTab();
}

// -----------------------------------------------------------------------
// Modal de edição — data e conteúdo, compartilhado pelas duas abas.
// -----------------------------------------------------------------------
function openEditRelatorioModal(id) {
    const relatorioOriginal = findRelatorioById(id);
    if (!relatorioOriginal) return;

    const relatorio = withSessionEdits(relatorioOriginal);
    editingRelatorioId = id;

    document.getElementById('modal-editar-paciente').innerText = relatorio.pacienteNome;
    document.getElementById('modal-editar-contexto').innerText = `${relatorio.tipo} · ${relatorio.autorNome}`;
    document.getElementById('modal-editar-data').value = toDateInputValue(relatorio.data);
    document.getElementById('modal-editar-conteudo').value = relatorio.conteudo;

    document.getElementById('modal-editar-relatorio').classList.remove('hidden');
    lucide.createIcons();
}

function closeEditRelatorioModal() {
    document.getElementById('modal-editar-relatorio').classList.add('hidden');
    editingRelatorioId = null;
}

function handleEditRelatorioSubmit(event) {
    event.preventDefault();
    if (!editingRelatorioId) return;

    const data = document.getElementById('modal-editar-data').value;
    const conteudo = document.getElementById('modal-editar-conteudo').value.trim();

    saveRelatorioEditToSession(editingRelatorioId, { data, conteudo });

    closeEditRelatorioModal();
    renderAtendimentosTab();
    renderRelatoriosTab();
    showToast('Alterações salvas nesta sessão. Ainda não foram enviadas para a base.', 'success');
}

// -----------------------------------------------------------------------
// Carregamento
// -----------------------------------------------------------------------
async function loadCoordenacaoDados() {
    const loading = document.getElementById('coordenacao-loading');
    const content = document.getElementById('coordenacao-content');
    const errorState = document.getElementById('coordenacao-error');

    loading.classList.remove('hidden');
    content.classList.add('hidden');
    errorState.classList.add('hidden');

    try {
        const [atendimentos, relatorios] = await Promise.all([
            CoordenacaoApi.fetchAtendimentosRealizados(),
            CoordenacaoApi.fetchRelatoriosCompletos(),
        ]);

        allAtendimentos = atendimentos;
        allRelatorios = relatorios;

        populateRelatorioFilterOptions();
        renderAtendimentosTab();
        renderRelatoriosTab();

        loading.classList.add('hidden');
        content.classList.remove('hidden');
    } catch (error) {
        console.error(error);
        loading.classList.add('hidden');
        errorState.classList.remove('hidden');
        document.getElementById('coordenacao-error-message').innerText =
            error.message || 'Não foi possível carregar os dados da coordenação.';
        showToast(error.message || 'Erro ao carregar dados.', 'error');
    } finally {
        lucide.createIcons();
    }
}

// -----------------------------------------------------------------------
// Aba Indicadores — dashboard antigo, mantido como estava (ainda depende
// do endpoint /coordenacao/metricas, que segue sem URL confirmada).
// -----------------------------------------------------------------------
function renderMetricas(metricas) {
    document.getElementById('metric-assiduidade').innerText = `${metricas.taxaAssiduidade}%`;
    document.getElementById('metric-total').innerText = metricas.totalAgendados;
    document.getElementById('metric-realizados').innerText = metricas.realizados;
    document.getElementById('metric-faltas').innerText = metricas.faltasSemAviso;
    document.getElementById('metric-desmarcados').innerText = metricas.desmarcados;
}

function renderAlertas(alertas) {
    const container = document.getElementById('alerts-container');
    const emptyState = document.getElementById('alerts-empty');
    const countBadge = document.getElementById('alerts-count-badge');

    countBadge.innerText = `${alertas.length} alerta(s)`;
    container.innerHTML = '';

    if (alertas.length === 0) {
        emptyState.classList.remove('hidden');
        return;
    }

    emptyState.classList.add('hidden');

    alertas.forEach((alerta) => {
        const row = document.createElement('div');
        row.className = 'p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3';
        row.innerHTML = `
            <div class="flex items-start gap-3">
                <div class="w-9 h-9 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 font-bold text-xs">
                    <i data-lucide="user-x" class="w-4 h-4"></i>
                </div>
                <div>
                    <p class="font-bold text-slate-900 text-sm">${escapeHtml(alerta.pacienteNome)}</p>
                    <p class="text-xs text-slate-500">Terapeuta: ${escapeHtml(alerta.terapeutaNome)}</p>
                    <span class="inline-block mt-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200">
                        ${alerta.faltasConsecutivas} falta(s) consecutiva(s)
                    </span>
                </div>
            </div>
            <div class="flex items-center gap-2 self-end sm:self-center">
                ${
                    alerta.whatsappLink
                        ? `<a href="${escapeHtml(alerta.whatsappLink)}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold hover:bg-emerald-100 transition">
                            <i data-lucide="message-circle" class="w-3.5 h-3.5"></i>
                            Contatar Responsável
                        </a>`
                        : `<span class="text-xs text-slate-400">Sem telefone cadastrado</span>`
                }
            </div>
        `;
        container.appendChild(row);
    });

    lucide.createIcons();
}

// Endpoint coordenacao-metricas ainda não tem URL confirmada em produção.
// Enquanto isso, mostramos um estado "em breve" em vez de chamar o webhook.
const COORDENACAO_DISPONIVEL = false;

async function loadIndicadores() {
    const loadingState = document.getElementById('loading-state');
    const dashboardContent = document.getElementById('dashboard-content');
    const errorState = document.getElementById('error-state');

    if (!COORDENACAO_DISPONIVEL) {
        loadingState.classList.add('hidden');
        dashboardContent.classList.add('hidden');
        errorState.classList.remove('hidden');
        document.getElementById('error-message').innerText =
            'Painel em construção — aguardando a URL do endpoint coordenacao-metricas no n8n.';
        return;
    }

    loadingState.classList.remove('hidden');
    dashboardContent.classList.add('hidden');
    errorState.classList.add('hidden');

    try {
        const { metricas, alertas } = await CoordenacaoApi.fetchMetricas();
        renderMetricas(metricas);
        renderAlertas(alertas);

        loadingState.classList.add('hidden');
        dashboardContent.classList.remove('hidden');
    } catch (error) {
        console.error(error);
        loadingState.classList.add('hidden');
        errorState.classList.remove('hidden');
        document.getElementById('error-message').innerText =
            error.message || 'Não foi possível carregar os indicadores.';
        showToast(error.message || 'Erro ao carregar indicadores.', 'error');
    } finally {
        lucide.createIcons();
    }
}

// -----------------------------------------------------------------------
// Novo relatório avulso — sem atendimento vinculado. Reaproveita
// CadastroApi.buildRelatorioPayload/registrarRelatorio (já testados contra
// /registrar/relatorio) e a mesma lista de pacientes usada em Cadastros.
// -----------------------------------------------------------------------
let pacienteAutocompleteRelatorio = null;
let pacienteAutocompleteFiltro = null;

// Busca a lista de pacientes uma vez e alimenta os dois autocompletes desta
// página (o do modal "Novo Relatório" e o do filtro da aba Relatórios).
async function loadPacientesParaNovoRelatorio() {
    const input = document.getElementById('novo-relatorio-paciente');

    try {
        const pacientes = await PacientesApi.fetchPacientes();
        const opcoes = pacientes.map((p) => ({ id: p.id, label: p.nome, sublabel: p.planoSaude || '' }));

        if (pacientes.length === 0) {
            input.placeholder = 'Nenhum paciente cadastrado';
            return;
        }

        pacienteAutocompleteRelatorio.setOptions(opcoes);
        input.disabled = false;
        input.placeholder = 'Digite o nome do paciente...';

        if (pacienteAutocompleteFiltro) pacienteAutocompleteFiltro.setOptions(opcoes);
    } catch (error) {
        console.error(error);
        input.placeholder = 'Erro ao carregar pacientes';
        showToast(error.message || 'Erro ao carregar lista de pacientes.', 'error');
    }
}

function openNovoRelatorioModal() {
    const session = AuthApi.getSession();

    document.getElementById('novo-relatorio-autor').innerText = (session && session.nome) || '—';
    document.getElementById('novo-relatorio-data').value = new Date().toISOString().split('T')[0];
    document.getElementById('novo-relatorio-conteudo').value = '';
    document.getElementById('novo-relatorio-paciente').value = '';
    if (pacienteAutocompleteRelatorio) pacienteAutocompleteRelatorio.clear();

    document.getElementById('modal-novo-relatorio').classList.remove('hidden');
    lucide.createIcons();
}

function closeNovoRelatorioModal() {
    document.getElementById('modal-novo-relatorio').classList.add('hidden');
}

async function handleNovoRelatorioSubmit(event) {
    event.preventDefault();

    const session = AuthApi.getSession();
    const pacienteNome = document.getElementById('novo-relatorio-paciente').value.trim();
    const data = document.getElementById('novo-relatorio-data').value;
    const conteudo = document.getElementById('novo-relatorio-conteudo').value.trim();

    if (!pacienteNome) {
        showToast('Selecione um paciente da lista antes de salvar.', 'error');
        return;
    }

    const submitBtn = document.getElementById('novo-relatorio-submit-btn');
    const originalHtml = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> Criando...';
    lucide.createIcons();

    try {
        const payload = CadastroApi.buildRelatorioPayload({
            tipo: 'Avulso',
            pacienteNome,
            atendimentoId: null,
            autorNome: (session && session.nome) || '',
            data,
            conteudo,
        });
        await CadastroApi.registrarRelatorio(payload);

        closeNovoRelatorioModal();
        showToast('Relatório avulso criado com sucesso.', 'success');

        // Recarrega tudo da base pra já mostrar o relatório novo (mais
        // simples e mais confiável do que tentar inserir só na memória).
        await loadCoordenacaoDados();
        switchCoordenacaoTab('relatorios');
    } catch (error) {
        console.error(error);
        showToast(error.message || 'Erro ao criar relatório.', 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalHtml;
        lucide.createIcons();
    }
}

window.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();
    document.getElementById('refresh-btn')?.addEventListener('click', loadCoordenacaoDados);
    document.getElementById('filterFormRelatorios')?.addEventListener('submit', (e) => {
        e.preventDefault();
        renderRelatoriosTab();
    });

    pacienteAutocompleteRelatorio = attachAutocomplete(document.getElementById('novo-relatorio-paciente'), { options: [] });
    pacienteAutocompleteFiltro = attachAutocomplete(document.getElementById('filter-relatorio-paciente'), {
        options: [],
        onSelect: () => renderRelatoriosTab(),
    });
    loadPacientesParaNovoRelatorio();

    // Permite linkar direto pra uma aba, ex: coordenacao.html?tab=relatorios
    const tabParam = new URLSearchParams(window.location.search).get('tab');
    if (['atendimentos', 'relatorios', 'indicadores'].includes(tabParam)) {
        switchCoordenacaoTab(tabParam);
    }

    loadCoordenacaoDados();
});
