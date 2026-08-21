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

async function loadCoordenacao() {
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

window.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();
    document.getElementById('refresh-btn')?.addEventListener('click', loadCoordenacao);
    loadCoordenacao();
});
