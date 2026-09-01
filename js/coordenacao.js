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
let allAtendimentosTodos = []; // todos os status — usado só pela aba Indicadores
let allRelatorios = [];
let selectedRelatorioIds = new Set();
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

    if (tab === 'indicadores') renderIndicadores();
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

function populateAtendimentoFilterOptions() {
    const planos = [...new Set(allAtendimentos.map((a) => a.planoSaude).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b, 'pt-BR')
    );
    const terapeutas = [...new Set(allAtendimentos.map((a) => a.terapeutaNome).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b, 'pt-BR')
    );

    const planoSelect = document.getElementById('filter-atendimento-plano');
    const terapeutaSelect = document.getElementById('filter-atendimento-terapeuta');

    planoSelect.innerHTML =
        '<option value="">Todos os planos</option>' +
        planos.map((p) => `<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`).join('');

    terapeutaSelect.innerHTML =
        '<option value="">Todos os terapeutas</option>' +
        terapeutas.map((t) => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join('');
}

function getAtendimentoFilters() {
    return {
        paciente: document.getElementById('filter-atendimento-paciente').value.trim().toLowerCase(),
        terapeuta: document.getElementById('filter-atendimento-terapeuta').value,
        plano: document.getElementById('filter-atendimento-plano').value,
        evolucao: document.getElementById('filter-atendimento-evolucao').value, // '' | 'com' | 'sem'
        dataInicio: document.getElementById('filter-atendimento-data-inicio').value,
        dataFim: document.getElementById('filter-atendimento-data-fim').value,
    };
}

// Todos os filtros combinam com E (não é "ou um ou outro") — dá pra usar
// terapeuta + período, ou terapeuta + plano, ao mesmo tempo.
function applyAtendimentoFilters(atendimentos, filters) {
    return atendimentos.filter((a) => {
        if (filters.paciente && !a.pacienteNome.toLowerCase().includes(filters.paciente)) return false;
        if (filters.terapeuta && a.terapeutaNome !== filters.terapeuta) return false;
        if (filters.plano && a.planoSaude !== filters.plano) return false;
        if (filters.evolucao === 'com' && !a.relatorio) return false;
        if (filters.evolucao === 'sem' && a.relatorio) return false;

        if (a.dataHora) {
            const data = new Date(a.dataHora);
            if (filters.dataInicio && data < new Date(filters.dataInicio)) return false;
            if (filters.dataFim && data > new Date(`${filters.dataFim}T23:59:59`)) return false;
        }

        return true;
    });
}

function clearAtendimentoFilters() {
    document.getElementById('filterFormAtendimentos').reset();
    renderAtendimentosTab();
}

function renderAtendimentosTab() {
    const filters = getAtendimentoFilters();
    const filtered = applyAtendimentoFilters(allAtendimentos, filters);

    const container = document.getElementById('atendimentos-container');
    const empty = document.getElementById('atendimentos-empty');
    const countBadge = document.getElementById('atendimentos-count-badge');

    countBadge.innerText = `${filtered.length} atendimento(s)`;

    if (filtered.length === 0) {
        container.innerHTML = '';
        empty.classList.remove('hidden');
        return;
    }

    empty.classList.add('hidden');
    container.innerHTML = filtered.map(renderAtendimentoCard).join('');
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
    const selecionado = selectedRelatorioIds.has(relatorio.id);

    return `
        <div class="card p-5 flex flex-col gap-3" style="${selecionado ? 'outline:2px solid var(--brand-500, #2f8f5b); outline-offset:-2px;' : ''}">
            <div class="flex items-start justify-between gap-3 flex-wrap">
                <div class="flex items-start gap-3">
                    <input type="checkbox" class="mt-1 w-4 h-4 shrink-0" ${selecionado ? 'checked' : ''}
                        onchange="toggleRelatorioSelection('${relatorio.id}', this.checked)" title="Selecionar para exportar" />
                    <div>
                        <h3 class="text-base font-bold" style="color:var(--ink)">${escapeHtml(relatorio.pacienteNome)}</h3>
                        <p class="text-xs mt-0.5" style="color:var(--ink-soft)">
                            ${formatDate(relatorio.data)} · ${escapeHtml(relatorio.autorNome)}${relatorio.planoSaude ? ` · ${escapeHtml(relatorio.planoSaude)}` : ''}
                        </p>
                    </div>
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
    updateRelatorioSelectionToolbar();
}

function clearRelatorioFilters() {
    document.getElementById('filterFormRelatorios').reset();
    renderRelatoriosTab();
}

// -----------------------------------------------------------------------
// Seleção de relatórios para exportação — só permite selecionar relatórios
// do mesmo paciente por vez (decisão explícita do usuário).
// -----------------------------------------------------------------------
function toggleRelatorioSelection(id, checked) {
    const relatorio = findRelatorioById(id);
    if (!relatorio) return;

    if (checked) {
        const jaSelecionado = getSelectedRelatoriosSorted()[0];
        if (jaSelecionado && jaSelecionado.pacienteNome !== relatorio.pacienteNome) {
            showToast(
                `Só é possível exportar relatórios de um paciente por vez. Desmarque os relatórios de "${jaSelecionado.pacienteNome}" antes de selecionar outro paciente.`,
                'error'
            );
            renderRelatoriosTab();
            return;
        }
        selectedRelatorioIds.add(id);
    } else {
        selectedRelatorioIds.delete(id);
    }

    updateRelatorioSelectionToolbar();
}

function clearRelatorioSelection() {
    selectedRelatorioIds.clear();
    renderRelatoriosTab();
}

function getSelectedRelatoriosSorted() {
    return [...selectedRelatorioIds]
        .map((id) => findRelatorioById(id))
        .filter(Boolean)
        .map((r) => withSessionEdits(r))
        .sort((a, b) => new Date(a.data || 0) - new Date(b.data || 0));
}

function updateRelatorioSelectionToolbar() {
    const toolbar = document.getElementById('relatorio-selection-toolbar');
    const countEl = document.getElementById('relatorio-selection-count');
    if (!toolbar || !countEl) return;

    const total = selectedRelatorioIds.size;
    toolbar.classList.toggle('hidden', total === 0);
    countEl.innerText = `${total} selecionado(s)`;
}

// -----------------------------------------------------------------------
// Exportação de relatórios selecionados como documento de evolução.
// Título "Evolução de Paciente" + dados do paciente/terapeuta, seguido
// dos relatórios selecionados encadeados em ordem cronológica.
// -----------------------------------------------------------------------
function buildEvolucaoDocumentHtml(relatorios) {
    const pacienteNome = relatorios[0].pacienteNome;
    const autoresUnicos = [...new Set(relatorios.map((r) => r.autorNome).filter(Boolean))];
    const terapeutaNome = autoresUnicos.length ? autoresUnicos.join(' / ') : '—';

    const entradas = relatorios
        .map(
            (r) => `
                <div style="margin-bottom:18px;">
                    <p style="margin:0 0 4px 0; font-weight:bold;">${escapeHtml(formatDate(r.data))}</p>
                    <p style="margin:0; white-space:pre-wrap;">${escapeHtml(r.conteudo) || 'Sem conteúdo registrado.'}</p>
                </div>
            `
        )
        .join('');

    return `
        <div style="font-family:Calibri,Arial,sans-serif; font-size:14px; color:#111; padding:24px;">
            <h1 style="text-align:center; font-size:20px; margin:0 0 24px 0;">Evolução de Paciente</h1>
            <div style="text-align:left; margin-bottom:20px;">
                <p style="margin:0 0 4px 0;"><strong>Nome do paciente:</strong> ${escapeHtml(pacienteNome)}</p>
                <p style="margin:0;"><strong>Nome do terapeuta:</strong> ${escapeHtml(terapeutaNome)}</p>
            </div>
            <hr style="border:none; border-top:1px solid #ccc; margin:0 0 20px 0;" />
            ${entradas}
        </div>
    `;
}

function exportSelectedRelatorios(formato) {
    const relatorios = getSelectedRelatoriosSorted();
    if (relatorios.length === 0) {
        showToast('Selecione ao menos um relatório para exportar.', 'error');
        return;
    }

    const pacienteNome = relatorios[0].pacienteNome;
    const conteudoHtml = buildEvolucaoDocumentHtml(relatorios);
    const nomeArquivo = `Evolucao_${pacienteNome.replace(/[^a-zA-Z0-9]+/g, '_')}`;

    if (formato === 'pdf') {
        exportComoPdf(conteudoHtml);
    } else if (formato === 'xml') {
        exportComoXml(relatorios, nomeArquivo);
    } else {
        exportComoWord(conteudoHtml, nomeArquivo);
    }
}

function escapeXmlText(text) {
    return String(text ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

// Exporta os dados brutos dos relatórios selecionados como XML — pensado
// para integração/uso em outro sistema, não para leitura em editor de texto.
function buildEvolucaoXml(relatorios) {
    const pacienteNome = relatorios[0].pacienteNome;
    const autoresUnicos = [...new Set(relatorios.map((r) => r.autorNome).filter(Boolean))];
    const terapeutaNome = autoresUnicos.length ? autoresUnicos.join(' / ') : '';

    const itens = relatorios
        .map(
            (r) => `
        <Relatorio>
            <Id>${escapeXmlText(r.id)}</Id>
            <Tipo>${escapeXmlText(r.tipo)}</Tipo>
            <Autor>${escapeXmlText(r.autorNome)}</Autor>
            <Data>${escapeXmlText(toDateInputValue(r.data))}</Data>
            <PlanoSaude>${escapeXmlText(r.planoSaude)}</PlanoSaude>
            <Conteudo>${escapeXmlText(r.conteudo)}</Conteudo>
        </Relatorio>`
        )
        .join('');

    return `<?xml version="1.0" encoding="UTF-8"?>
<EvolucaoPaciente>
    <Paciente>${escapeXmlText(pacienteNome)}</Paciente>
    <Terapeuta>${escapeXmlText(terapeutaNome)}</Terapeuta>
    <Relatorios>${itens}
    </Relatorios>
</EvolucaoPaciente>
`;
}

function exportComoXml(relatorios, nomeArquivo) {
    const xml = buildEvolucaoXml(relatorios);
    const blob = new Blob([xml], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${nomeArquivo}.xml`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

// Imprime via um iframe invisível — evita bloqueio de pop-up e deixa o
// usuário escolher "Salvar como PDF" na própria caixa de impressão.
//
// Importante: print() é chamado NA HORA, logo depois do doc.close(), sem
// esperar o evento "load" do iframe. Esperar por ele (como a versão
// anterior fazia) não é confiável — document.write() nem sempre redispara
// o load — e mesmo quando dispara, chamar print() de dentro de um callback
// assíncrono pode perder a permissão de "gesto do usuário" que o navegador
// exige pra abrir a caixa de impressão, bloqueando ela silenciosamente.
// Como doc.write()/doc.close() são síncronos, o conteúdo já está pronto
// nesse ponto — não precisa esperar nada.
function exportComoPdf(conteudoHtml) {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.top = '0';
    iframe.style.left = '-10000px';
    iframe.style.width = '800px';
    iframe.style.height = '600px';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Evolução de Paciente</title></head><body>${conteudoHtml}</body></html>`);
    doc.close();

    const limpar = () => {
        if (iframe.parentNode) document.body.removeChild(iframe);
    };

    iframe.contentWindow.focus();
    iframe.contentWindow.print();

    iframe.contentWindow.addEventListener('afterprint', limpar, { once: true });
    setTimeout(limpar, 5000); // rede de segurança, caso "afterprint" não dispare
}

// Gera um .doc compatível com o Word usando o formato HTML-com-namespace do
// próprio Word — não é um .docx (OOXML) real, mas abre e edita normalmente
// no Word/LibreOffice sem depender de nenhuma biblioteca externa.
function exportComoWord(conteudoHtml, nomeArquivo) {
    const documentoCompleto = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
        <head><meta charset="utf-8"><title>Evolução de Paciente</title></head>
        <body>${conteudoHtml}</body>
        </html>
    `;

    const blob = new Blob(['﻿', documentoCompleto], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${nomeArquivo}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
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
        const { todosAtendimentos, atendimentosRealizados, relatorios } = await CoordenacaoApi.fetchAtendimentosComContexto();

        allAtendimentos = atendimentosRealizados;
        allAtendimentosTodos = todosAtendimentos;
        allRelatorios = relatorios;
        selectedRelatorioIds.clear();

        populateAtendimentoFilterOptions();
        populateRelatorioFilterOptions();
        populateIndicadorFilterOptions();
        if (pacienteAutocompleteFiltroAtendimento) {
            pacienteAutocompleteFiltroAtendimento.setOptions(
                [...new Map(allAtendimentos.map((a) => [a.pacienteNome, a])).values()].map((a) => ({
                    id: a.pacienteNome,
                    label: a.pacienteNome,
                    sublabel: a.planoSaude || '',
                }))
            );
        }
        if (pacienteAutocompleteFiltroIndicador) {
            pacienteAutocompleteFiltroIndicador.setOptions(
                [...new Map(allAtendimentosTodos.map((a) => [a.pacienteNome, a])).values()].map((a) => ({
                    id: a.pacienteNome,
                    label: a.pacienteNome,
                    sublabel: a.planoSaude || '',
                }))
            );
        }
        renderAtendimentosTab();
        renderRelatoriosTab();
        renderIndicadores();

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
// Aba Indicadores — 100% client-side, montada em cima dos mesmos
// Atendimentos/Relatórios já carregados (allAtendimentosTodos inclui TODOS
// os status, diferente de allAtendimentos que só tem Realizado). Não
// depende do endpoint /coordenacao/metricas (nunca teve URL confirmada).
//
// Atenção: por um bug conhecido no n8n, Falta/Desmarcado/Cancelado ainda
// são gravados como Status_Presenca "Realizado" na base — então até esse
// bug ser corrigido no backend, os indicadores de Falta/Desmarcado/
// Cancelado abaixo tendem a ficar subestimados (e "Realizados" superestimado).
// -----------------------------------------------------------------------
function isFalta(status) {
    return status === 'Falta sem Aviso';
}
function isDesmarcado(status) {
    return typeof status === 'string' && status.includes('Desmarcado');
}
function isCancelado(status) {
    return typeof status === 'string' && status.includes('Cancelado');
}

function populateIndicadorFilterOptions() {
    const terapeutaSelect = document.getElementById('filter-indicador-terapeuta');
    const terapeutas = [...new Set(allAtendimentosTodos.map((a) => a.terapeutaNome).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b, 'pt-BR')
    );

    const valorAtual = terapeutaSelect.value;
    terapeutaSelect.innerHTML =
        '<option value="">Todos os terapeutas</option>' +
        terapeutas.map((t) => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join('');
    if (terapeutas.includes(valorAtual)) terapeutaSelect.value = valorAtual;
}

function getIndicadorFilters() {
    return {
        paciente: document.getElementById('filter-indicador-paciente').value.trim().toLowerCase(),
        terapeuta: document.getElementById('filter-indicador-terapeuta').value,
        dataInicio: document.getElementById('filter-indicador-data-inicio').value,
        dataFim: document.getElementById('filter-indicador-data-fim').value,
    };
}

function applyIndicadorFilters(atendimentos, filters) {
    return atendimentos.filter((a) => {
        if (filters.paciente && !a.pacienteNome.toLowerCase().includes(filters.paciente)) return false;
        if (filters.terapeuta && a.terapeutaNome !== filters.terapeuta) return false;
        if (a.dataHora) {
            const data = new Date(a.dataHora);
            if (filters.dataInicio && data < new Date(filters.dataInicio)) return false;
            if (filters.dataFim && data > new Date(`${filters.dataFim}T23:59:59`)) return false;
        }
        return true;
    });
}

function clearIndicadorFilters() {
    document.getElementById('filterFormIndicadores').reset();
    if (pacienteAutocompleteFiltroIndicador) pacienteAutocompleteFiltroIndicador.clear();
    renderIndicadores();
}

function computeIndicadoresResumo(atendimentos) {
    const realizados = atendimentos.filter((a) => a.status === 'Realizado');
    const comEvolucao = realizados.filter((a) => a.relatorio);
    const semEvolucao = realizados.filter((a) => !a.relatorio);
    const faltas = atendimentos.filter((a) => isFalta(a.status));
    const desmarcados = atendimentos.filter((a) => isDesmarcado(a.status));
    const cancelados = atendimentos.filter((a) => isCancelado(a.status));

    const baseAssiduidade = realizados.length + faltas.length + desmarcados.length + cancelados.length;
    const taxaAssiduidade = baseAssiduidade > 0 ? Math.round((realizados.length / baseAssiduidade) * 100) : 0;

    return {
        total: atendimentos.length,
        realizados,
        comEvolucao,
        semEvolucao,
        faltas,
        desmarcados,
        cancelados,
        taxaAssiduidade,
    };
}

function renderIndicadoresKpis(resumo) {
    const root = document.getElementById('indicadores-kpis-root');
    root.innerHTML = [
        UI.statCard({ id: 'ind-kpi-total', label: 'Total no filtro', icon: 'calendar-days', initialValue: resumo.total, accent: true }),
        UI.statCard({ id: 'ind-kpi-realizados', label: 'Realizados', icon: 'check-circle-2', initialValue: resumo.realizados.length }),
        UI.statCard({ id: 'ind-kpi-com-evolucao', label: 'Com evolução', icon: 'file-check-2', initialValue: resumo.comEvolucao.length }),
        UI.statCard({ id: 'ind-kpi-sem-evolucao', label: 'Sem evolução', icon: 'file-warning', initialValue: resumo.semEvolucao.length }),
        UI.statCard({ id: 'ind-kpi-faltas', label: 'Faltas s/ aviso', icon: 'user-x', initialValue: resumo.faltas.length }),
        UI.statCard({ id: 'ind-kpi-desmarcados', label: 'Desmarcados', icon: 'calendar-x', initialValue: resumo.desmarcados.length }),
        UI.statCard({ id: 'ind-kpi-cancelados', label: 'Cancelados', icon: 'ban', initialValue: resumo.cancelados.length }),
        UI.statCard({ id: 'ind-kpi-assiduidade', label: 'Taxa de assiduidade', icon: 'trending-up', initialValue: `${resumo.taxaAssiduidade}%` }),
    ].join('');
    lucide.createIcons();
}

function renderIndicadoresSemEvolucao(semEvolucaoList) {
    const container = document.getElementById('indicadores-sem-evolucao-container');
    const empty = document.getElementById('indicadores-sem-evolucao-empty');
    const badge = document.getElementById('indicadores-sem-evolucao-badge');

    badge.innerText = `${semEvolucaoList.length} caso(s)`;

    if (semEvolucaoList.length === 0) {
        container.innerHTML = '';
        empty.classList.remove('hidden');
        return;
    }

    empty.classList.add('hidden');
    container.innerHTML = semEvolucaoList
        .map(
            (a) => `
        <div class="p-4 flex items-center justify-between gap-3 flex-wrap">
            <div>
                <p class="text-sm font-semibold" style="color:var(--ink)">${escapeHtml(a.pacienteNome)}</p>
                <p class="text-xs mt-0.5" style="color:var(--ink-soft)">
                    ${formatDate(a.dataHora)} às ${formatTime(a.dataHora)} · ${escapeHtml(a.terapeutaNome)}
                </p>
            </div>
            <span class="badge badge--warn">Sem evolução</span>
        </div>
    `
        )
        .join('');
}

function renderIndicadoresPorTerapeuta(atendimentos) {
    const tbody = document.getElementById('indicadores-terapeuta-tbody');
    const empty = document.getElementById('indicadores-terapeuta-empty');

    const porTerapeuta = new Map();
    atendimentos
        .filter((a) => a.status === 'Realizado')
        .forEach((a) => {
            if (!porTerapeuta.has(a.terapeutaNome)) {
                porTerapeuta.set(a.terapeutaNome, { terapeuta: a.terapeutaNome, realizados: 0, comEvolucao: 0, semEvolucao: 0 });
            }
            const linha = porTerapeuta.get(a.terapeutaNome);
            linha.realizados += 1;
            if (a.relatorio) linha.comEvolucao += 1;
            else linha.semEvolucao += 1;
        });

    const linhas = [...porTerapeuta.values()].sort(
        (a, b) => b.semEvolucao - a.semEvolucao || a.terapeuta.localeCompare(b.terapeuta, 'pt-BR')
    );

    if (linhas.length === 0) {
        tbody.innerHTML = '';
        empty.classList.remove('hidden');
        return;
    }

    empty.classList.add('hidden');
    tbody.innerHTML = linhas
        .map(
            (l) => `
        <tr class="border-t" style="border-color:var(--border)">
            <td class="px-4 py-3 font-semibold" style="color:var(--ink)">${escapeHtml(l.terapeuta)}</td>
            <td class="px-4 py-3 text-center">${l.realizados}</td>
            <td class="px-4 py-3 text-center"><span class="badge badge--ok">${l.comEvolucao}</span></td>
            <td class="px-4 py-3 text-center">${
                l.semEvolucao > 0 ? `<span class="badge badge--warn">${l.semEvolucao}</span>` : '0'
            }</td>
        </tr>
    `
        )
        .join('');
}

// Conta faltas/desmarcações/cancelamentos consecutivos mais recentes de um
// paciente, olhando o HISTÓRICO COMPLETO (não o filtro atual aplicado na
// tela) — um alerta de risco não deveria sumir só porque o filtro de data
// mudou.
function computeFaltasConsecutivas(pacienteNome) {
    const historico = allAtendimentosTodos
        .filter((a) => a.pacienteNome === pacienteNome && a.status !== 'Agendado')
        .sort((a, b) => new Date(b.dataHora) - new Date(a.dataHora));

    let consecutivas = 0;
    for (const a of historico) {
        if (a.status === 'Realizado') break;
        consecutivas += 1;
    }
    return consecutivas;
}

function renderIndicadoresPorPaciente(atendimentos) {
    const tbody = document.getElementById('indicadores-paciente-tbody');
    const empty = document.getElementById('indicadores-paciente-empty');

    const porPaciente = new Map();
    atendimentos.forEach((a) => {
        if (!porPaciente.has(a.pacienteNome)) {
            porPaciente.set(a.pacienteNome, { paciente: a.pacienteNome, realizados: 0, faltas: 0, desmarcados: 0, cancelados: 0 });
        }
        const linha = porPaciente.get(a.pacienteNome);
        if (a.status === 'Realizado') linha.realizados += 1;
        else if (isFalta(a.status)) linha.faltas += 1;
        else if (isDesmarcado(a.status)) linha.desmarcados += 1;
        else if (isCancelado(a.status)) linha.cancelados += 1;
    });

    const linhas = [...porPaciente.values()]
        .map((l) => ({ ...l, faltasConsecutivas: computeFaltasConsecutivas(l.paciente) }))
        .sort(
            (a, b) =>
                b.faltas + b.desmarcados + b.cancelados - (a.faltas + a.desmarcados + a.cancelados) ||
                a.paciente.localeCompare(b.paciente, 'pt-BR')
        );

    if (linhas.length === 0) {
        tbody.innerHTML = '';
        empty.classList.remove('hidden');
        return;
    }

    empty.classList.add('hidden');
    tbody.innerHTML = linhas
        .map(
            (l) => `
        <tr class="border-t" style="border-color:var(--border)">
            <td class="px-4 py-3 font-semibold" style="color:var(--ink)">${escapeHtml(l.paciente)}</td>
            <td class="px-4 py-3 text-center">${l.realizados}</td>
            <td class="px-4 py-3 text-center">${l.faltas > 0 ? `<span class="badge badge--danger">${l.faltas}</span>` : '0'}</td>
            <td class="px-4 py-3 text-center">${
                l.desmarcados > 0 ? `<span class="badge badge--warn">${l.desmarcados}</span>` : '0'
            }</td>
            <td class="px-4 py-3 text-center">${l.cancelados}</td>
            <td class="px-4 py-3">${
                l.faltasConsecutivas >= 2
                    ? `<span class="badge badge--danger">${l.faltasConsecutivas} faltas seguidas</span>`
                    : '<span style="color:var(--ink-faint)">—</span>'
            }</td>
        </tr>
    `
        )
        .join('');
}

function renderIndicadores() {
    const filters = getIndicadorFilters();
    const filtered = applyIndicadorFilters(allAtendimentosTodos, filters);
    const resumo = computeIndicadoresResumo(filtered);

    renderIndicadoresKpis(resumo);
    renderIndicadoresSemEvolucao(resumo.semEvolucao);
    renderIndicadoresPorTerapeuta(filtered);
    renderIndicadoresPorPaciente(filtered);
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

let pacienteAutocompleteFiltroAtendimento = null;
let pacienteAutocompleteFiltroIndicador = null;

window.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();
    document.getElementById('refresh-btn')?.addEventListener('click', loadCoordenacaoDados);
    document.getElementById('filterFormRelatorios')?.addEventListener('submit', (e) => {
        e.preventDefault();
        renderRelatoriosTab();
    });
    document.getElementById('filterFormAtendimentos')?.addEventListener('submit', (e) => {
        e.preventDefault();
        renderAtendimentosTab();
    });
    document.getElementById('filterFormIndicadores')?.addEventListener('submit', (e) => {
        e.preventDefault();
        renderIndicadores();
    });

    pacienteAutocompleteRelatorio = attachAutocomplete(document.getElementById('novo-relatorio-paciente'), { options: [] });
    pacienteAutocompleteFiltro = attachAutocomplete(document.getElementById('filter-relatorio-paciente'), {
        options: [],
        onSelect: () => renderRelatoriosTab(),
    });
    pacienteAutocompleteFiltroAtendimento = attachAutocomplete(document.getElementById('filter-atendimento-paciente'), {
        options: [],
        onSelect: () => renderAtendimentosTab(),
    });
    pacienteAutocompleteFiltroIndicador = attachAutocomplete(document.getElementById('filter-indicador-paciente'), {
        options: [],
        onSelect: () => renderIndicadores(),
    });
    loadPacientesParaNovoRelatorio();

    // Permite linkar direto pra uma aba, ex: coordenacao.html?tab=relatorios
    const tabParam = new URLSearchParams(window.location.search).get('tab');
    if (['atendimentos', 'relatorios', 'indicadores'].includes(tabParam)) {
        switchCoordenacaoTab(tabParam);
    }

    loadCoordenacaoDados();
});
