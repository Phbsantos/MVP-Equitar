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

function switchCadastroTab(tab) {
    ['paciente', 'usuario', 'recorrencia'].forEach((t) => {
        document.getElementById(`tab-btn-${t}`).className = t === tab ? 'segmented-btn active' : 'segmented-btn';
        document.getElementById(`tab-${t}`).classList.toggle('hidden', t !== tab);
    });

    // A grade semanal da aba Recorrência precisa de mais espaço horizontal
    // do que os formulários simples das outras duas abas.
    const main = document.querySelector('main');
    main.classList.toggle('max-w-3xl', tab !== 'recorrencia');
    main.classList.toggle('max-w-6xl', tab === 'recorrencia');
}

async function handlePacienteSubmit(event) {
    event.preventDefault();
    const submitBtn = document.getElementById('paciente-submit-btn');
    const originalHtml = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> Cadastrando...';
    lucide.createIcons();

    const payload = CadastroApi.buildPacientePayload({
        nomeCompleto: document.getElementById('paciente-nome-completo').value.trim(),
        dataNascimento: document.getElementById('paciente-data-nascimento').value,
        responsavelNome: document.getElementById('paciente-responsavel-nome').value.trim(),
        telefoneWhatsapp: document.getElementById('paciente-telefone-whatsapp').value.trim(),
        status: document.getElementById('paciente-status').value,
        terapeutaResponsavelNome: document.getElementById('paciente-terapeuta-responsavel').value.trim(),
        planoSaude: document.getElementById('paciente-plano-saude').value.trim(),
    });

    try {
        await CadastroApi.registrarPaciente(payload);
        showToast(`Paciente ${payload.nome_completo} cadastrado com sucesso!`, 'success');
        document.getElementById('form-paciente').reset();
        document.getElementById('paciente-status').value = 'Em Acompanhamento';
    } catch (error) {
        console.error(error);
        showToast(error.message || 'Erro ao cadastrar paciente.', 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalHtml;
        lucide.createIcons();
    }
}

async function handleUsuarioSubmit(event) {
    event.preventDefault();
    const submitBtn = document.getElementById('usuario-submit-btn');
    const originalHtml = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> Cadastrando...';
    lucide.createIcons();

    const payload = CadastroApi.buildUsuarioPayload({
        nome: document.getElementById('usuario-nome').value.trim(),
        email: document.getElementById('usuario-email').value.trim(),
        perfilRole: document.getElementById('usuario-perfil-role').value,
        especialidade: document.getElementById('usuario-especialidade').value.trim(),
        status: document.getElementById('usuario-status').value,
        numeroConselho: document.getElementById('usuario-numero-conselho').value.trim(),
        equipeNome: document.getElementById('usuario-equipe').value,
    });

    try {
        await CadastroApi.registrarUsuario(payload);
        showToast(`Usuário ${payload.nome} cadastrado com sucesso!`, 'success');
        document.getElementById('form-usuario').reset();
        document.getElementById('usuario-perfil-role').value = 'Terapeuta';
        document.getElementById('usuario-status').value = 'Ativo';
    } catch (error) {
        console.error(error);
        showToast(error.message || 'Erro ao cadastrar usuário.', 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalHtml;
        lucide.createIcons();
    }
}

let terapeutaAutocomplete = null;

async function loadTerapeutasOptions() {
    const input = document.getElementById('paciente-terapeuta-responsavel');

    try {
        const terapeutas = await UsuariosApi.fetchTerapeutas();

        if (terapeutas.length === 0) {
            input.placeholder = 'Nenhum terapeuta cadastrado';
            input.disabled = true;
            return;
        }

        terapeutaAutocomplete.setOptions(
            terapeutas.map((t) => ({ id: t.id, label: t.nome, sublabel: t.especialidade || '' }))
        );
        input.disabled = false;
        input.placeholder = 'Digite o nome do terapeuta...';
    } catch (error) {
        console.error(error);
        input.placeholder = 'Erro ao carregar terapeutas';
        input.disabled = true;
        showToast(error.message || 'Erro ao carregar lista de terapeutas.', 'error');
    }
}

async function loadEquipesOptions() {
    const select = document.getElementById('usuario-equipe');

    try {
        const url = `${CONFIG.API_BASE}${CONFIG.ENDPOINTS.LISTAR_EQUIPES}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Erro ao carregar equipes (${response.status})`);

        const data = await response.json();
        const equipes = Array.isArray(data) ? data : data.records || [];
        const nomes = equipes.map((e) => (e.fields || e).Nome_Equipe).filter(Boolean);

        nomes.forEach((nome) => {
            const option = document.createElement('option');
            option.value = nome;
            option.textContent = nome;
            select.appendChild(option);
        });
    } catch (error) {
        console.error(error);
        // Falha silenciosa proposital: Equipe é opcional no cadastro, não
        // vale travar a tela inteira por causa disso.
    }
}

window.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();
    terapeutaAutocomplete = attachAutocomplete(document.getElementById('paciente-terapeuta-responsavel'), { options: [] });
    loadTerapeutasOptions();
    loadEquipesOptions();
});
