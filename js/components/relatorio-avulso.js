// Modal compartilhado de "Novo Relatório Avulso" — usado por index.html
// (Terapeuta) e supervisor.html (Supervisor). Coordenação já tinha sua
// própria versão hand-rolled (js/coordenacao.js) construída antes deste
// componente existir; não mexi lá pra não arriscar regressão numa peça já
// testada — mas é o mesmo padrão, dá pra migrar depois.
//
// Uso: depois de carregar auth-api.js, autocomplete.js, pacientes-api.js
// e cadastro-api.js —
//   <div id="relatorio-avulso-root"></div>
//   <button onclick="RelatorioAvulsoModal.open()" class="btn-fab">...</button>
//   RelatorioAvulsoModal.mount('relatorio-avulso-root', { onSuccess: () => {...} });
const RelatorioAvulsoModal = {
    _autocomplete: null,
    _onSuccess: null,

    render() {
        return `
            <div id="modal-relatorio-avulso" class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 hidden flex items-center justify-center p-4">
                <div class="bg-white rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden">
                    <div class="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between" style="background:var(--surface-alt)">
                        <div>
                            <h3 class="font-bold text-base flex items-center gap-2" style="color:var(--ink)">
                                <i data-lucide="file-plus" class="w-4 h-4" style="color:var(--brand-600)"></i>
                                Novo relatório avulso
                            </h3>
                            <p class="text-xs mt-0.5" style="color:var(--ink-soft)">Sem necessidade de um atendimento vinculado.</p>
                        </div>
                        <button onclick="RelatorioAvulsoModal.close()" class="btn-icon" title="Fechar">
                            <i data-lucide="x" class="w-5 h-5"></i>
                        </button>
                    </div>

                    <form id="relatorio-avulso-form" class="p-5 space-y-4">
                        <div>
                            <label for="relatorio-avulso-paciente" class="form-label">Paciente <span style="color:var(--danger)">*</span></label>
                            <input type="text" id="relatorio-avulso-paciente" required placeholder="Carregando pacientes..." disabled class="form-input">
                        </div>

                        <div>
                            <label for="relatorio-avulso-data" class="form-label">Data</label>
                            <input type="date" id="relatorio-avulso-data" required class="form-input">
                        </div>

                        <div>
                            <label for="relatorio-avulso-conteudo" class="form-label">Conteúdo <span style="color:var(--danger)">*</span></label>
                            <textarea id="relatorio-avulso-conteudo" rows="7" required placeholder="Ex: contato com a família, orientação passada à escola, observação fora de sessão..." class="form-input text-sm leading-relaxed"></textarea>
                        </div>

                        <p class="text-xs" style="color:var(--ink-faint)">
                            Autor: <span id="relatorio-avulso-autor" style="color:var(--ink-soft); font-weight:600">—</span> (você, a partir da sua sessão)
                        </p>

                        <div class="pt-2 flex items-center justify-end gap-3 border-t" style="border-color:var(--border)">
                            <button type="button" onclick="RelatorioAvulsoModal.close()" class="btn-secondary">Cancelar</button>
                            <button type="submit" id="relatorio-avulso-submit-btn" class="btn-primary">
                                <i data-lucide="save" class="w-4 h-4"></i>
                                Criar relatório
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        `;
    },

    mount(containerId, options = {}) {
        const container = document.getElementById(containerId);
        if (!container) return;

        container.innerHTML = this.render();
        this._onSuccess = options.onSuccess || null;

        document.getElementById('relatorio-avulso-form').addEventListener('submit', (e) => this._handleSubmit(e));
        this._autocomplete = attachAutocomplete(document.getElementById('relatorio-avulso-paciente'), { options: [] });
        this._loadPacientes();

        if (window.lucide) lucide.createIcons();
    },

    async _loadPacientes() {
        const input = document.getElementById('relatorio-avulso-paciente');
        if (!input) return;

        try {
            const pacientes = await PacientesApi.fetchPacientes();

            if (pacientes.length === 0) {
                input.placeholder = 'Nenhum paciente cadastrado';
                return;
            }

            this._autocomplete.setOptions(
                pacientes.map((p) => ({ id: p.id, label: p.nome, sublabel: p.planoSaude || '' }))
            );
            input.disabled = false;
            input.placeholder = 'Digite o nome do paciente...';
        } catch (error) {
            console.error(error);
            input.placeholder = 'Erro ao carregar pacientes';
        }
    },

    open() {
        const session = AuthApi.getSession();

        document.getElementById('relatorio-avulso-autor').innerText = (session && session.nome) || '—';
        document.getElementById('relatorio-avulso-data').value = new Date().toISOString().split('T')[0];
        document.getElementById('relatorio-avulso-conteudo').value = '';
        document.getElementById('relatorio-avulso-paciente').value = '';
        if (this._autocomplete) this._autocomplete.clear();

        document.getElementById('modal-relatorio-avulso').classList.remove('hidden');
        if (window.lucide) lucide.createIcons();
    },

    close() {
        document.getElementById('modal-relatorio-avulso').classList.add('hidden');
    },

    async _handleSubmit(event) {
        event.preventDefault();

        const session = AuthApi.getSession();
        const pacienteNome = document.getElementById('relatorio-avulso-paciente').value.trim();
        const data = document.getElementById('relatorio-avulso-data').value;
        const conteudo = document.getElementById('relatorio-avulso-conteudo').value.trim();

        if (!pacienteNome) {
            if (window.showToast) showToast('Selecione um paciente da lista antes de salvar.', 'error');
            return;
        }

        const submitBtn = document.getElementById('relatorio-avulso-submit-btn');
        const originalHtml = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> Criando...';
        if (window.lucide) lucide.createIcons();

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

            this.close();
            if (window.showToast) showToast('Relatório avulso criado com sucesso.', 'success');
            if (this._onSuccess) this._onSuccess();
        } catch (error) {
            console.error(error);
            if (window.showToast) showToast(error.message || 'Erro ao criar relatório.', 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalHtml;
            if (window.lucide) lucide.createIcons();
        }
    },
};
