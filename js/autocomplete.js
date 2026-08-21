// Componente de autocomplete reutilizável e sem dependências.
// Transforma um <input type="text"> num campo de "digite e sugere",
// filtrando uma lista de opções já carregada em memória (sem round-trip
// à API a cada tecla).
//
// Uso:
//   const ac = attachAutocomplete(document.getElementById('meu-input'), {
//       options: [{ id: 'rec1', label: 'Dra. Camila Torres', sublabel: 'Fisioterapia' }, ...],
//       onSelect: (opt) => { ... },
//   });
//   ac.setOptions(novasOpcoes); // pra atualizar a lista depois (ex: quando a API responder)

// Monta a regex de marcas diacríticas (acentos combinantes pós-NFD) via
// charCodes em vez de escapes literais no source, pra evitar qualquer
// corrupção de encoding ao salvar/transferir este arquivo.
var DIACRITICS_REGEX = new RegExp(
    String.fromCharCode(91) + String.fromCharCode(0x0300) + '-' + String.fromCharCode(0x036f) + String.fromCharCode(93),
    'g'
);

function attachAutocomplete(inputEl, config) {
    let options = config.options || [];
    let filtered = [];
    let activeIndex = -1;
    let selected = null;

    inputEl.setAttribute('autocomplete', 'off');

    const wrapper = document.createElement('div');
    wrapper.className = 'relative';
    inputEl.parentNode.insertBefore(wrapper, inputEl);
    wrapper.appendChild(inputEl);

    const panel = document.createElement('div');
    panel.className = 'hidden absolute left-0 right-0 z-30 mt-1 max-h-56 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-lg py-1';
    wrapper.appendChild(panel);

    function normalize(str) {
        return String(str || '')
            .toLowerCase()
            .normalize('NFD')
            .replace(DIACRITICS_REGEX, '');
    }

    function closePanel() {
        panel.classList.add('hidden');
        panel.innerHTML = '';
        filtered = [];
        activeIndex = -1;
    }

    function render() {
        panel.innerHTML = '';

        if (filtered.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'px-3 py-2 text-xs text-slate-400';
            empty.textContent = 'Nenhum resultado encontrado.';
            panel.appendChild(empty);
            panel.classList.remove('hidden');
            return;
        }

        filtered.forEach((opt, idx) => {
            const item = document.createElement('div');
            item.className = `px-3 py-2 text-sm cursor-pointer transition ${
                idx === activeIndex ? 'bg-clinical-50' : 'hover:bg-slate-50'
            }`;
            item.innerHTML = `
                <span class="block text-slate-800 font-medium">${escapeHtml(opt.label)}</span>
                ${opt.sublabel ? `<span class="block text-xs text-slate-400">${escapeHtml(opt.sublabel)}</span>` : ''}
            `;
            // mousedown (não click) roda antes do blur do input, senão o
            // painel fecha antes do clique registrar a seleção.
            item.addEventListener('mousedown', (e) => {
                e.preventDefault();
                select(opt);
            });
            panel.appendChild(item);
        });

        panel.classList.remove('hidden');
    }

    function select(opt) {
        inputEl.value = opt.label;
        selected = opt;
        closePanel();
        if (typeof config.onSelect === 'function') config.onSelect(opt);
    }

    function search(term) {
        const normalizedTerm = normalize(term);
        if (!normalizedTerm) {
            closePanel();
            return;
        }
        filtered = options.filter((opt) => normalize(opt.label).includes(normalizedTerm)).slice(0, 8);
        activeIndex = -1;
        render();
    }

    inputEl.addEventListener('input', () => {
        selected = null;
        search(inputEl.value);
    });

    inputEl.addEventListener('focus', () => {
        if (inputEl.value) search(inputEl.value);
    });

    inputEl.addEventListener('keydown', (e) => {
        if (panel.classList.contains('hidden') || filtered.length === 0) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            activeIndex = Math.min(activeIndex + 1, filtered.length - 1);
            render();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            activeIndex = Math.max(activeIndex - 1, 0);
            render();
        } else if (e.key === 'Enter') {
            if (activeIndex >= 0) {
                e.preventDefault();
                select(filtered[activeIndex]);
            }
        } else if (e.key === 'Escape') {
            closePanel();
        }
    });

    inputEl.addEventListener('blur', () => {
        // pequeno atraso pra dar tempo do mousedown do item rodar primeiro
        setTimeout(closePanel, 120);
    });

    return {
        setOptions(newOptions) {
            options = newOptions || [];
        },
        getSelected: () => selected,
        clear() {
            inputEl.value = '';
            selected = null;
            closePanel();
        },
    };
}
