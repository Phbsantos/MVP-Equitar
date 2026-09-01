// Topbar compartilhada — título da página, ações específicas da página
// (slot livre) e o chip do usuário logado.
//
// Uso: no lugar do <header> antigo, deixe
//   <header id="topbar-root"></header>
// e depois de carregar este script:
//   Topbar.mount('topbar-root', {
//       title: 'Minha Agenda',
//       subtitle: 'Plano, prioridades e evolução de hoje.',   // aceita HTML
//       actionsHtml: '<button ...>...</button>',              // opcional, livre
//   });
//
// Os elementos #user-chip-name/#user-chip-role/#user-chip-initials/
// #user-chip-especialidade continuam sendo preenchidos pelo auth-guard.js
// já existente — nada muda lá, só quem desenha o HTML em volta deles.
const Topbar = {
    render({ title = '', subtitle = '', actionsHtml = '' } = {}) {
        return `
            <div class="px-5 sm:px-8 py-5 flex items-center justify-between gap-4 flex-wrap">
                <div class="flex items-center gap-3 min-w-0">
                    <button type="button" class="topbar-menu-btn" onclick="Sidebar.toggleMobile()" title="Abrir menu" aria-label="Abrir menu">
                        <i data-lucide="menu" class="w-5 h-5"></i>
                    </button>
                    <div class="min-w-0">
                        <h1 class="text-xl sm:text-2xl font-extrabold" style="color:var(--ink)">${title}</h1>
                        ${subtitle ? `<p class="text-sm mt-0.5" style="color:var(--ink-soft)">${subtitle}</p>` : ''}
                    </div>
                </div>

                <div class="flex items-center gap-2 sm:gap-3 shrink-0">
                    ${actionsHtml}

                    <div class="hidden md:flex items-center gap-3 pl-3 ml-1" style="border-left:1px solid var(--border)">
                        <div class="avatar-chip-initials" id="user-chip-initials">--</div>
                        <div class="text-right">
                            <span class="block text-sm font-semibold" id="user-chip-name" style="color:var(--ink)">—</span>
                            <span class="badge badge--brand" id="user-chip-role">—</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    mount(containerId, options = {}) {
        const container = document.getElementById(containerId);
        if (!container) return;

        container.className = 'topbar';
        container.innerHTML = this.render(options);

        if (window.lucide) lucide.createIcons();
    },
};
