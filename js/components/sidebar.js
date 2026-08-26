// Sidebar de navegação compartilhada.
// Antes deste componente, cada página tinha seu próprio <nav> horizontal
// duplicado (5 cópias quase idênticas, com esquema de cor da aba ativa
// divergente entre páginas). Isso substitui todas elas por uma única
// implementação.
//
// Uso: em cada página autenticada, no lugar do <nav> antigo, deixe
//   <aside id="sidebar-root"></aside>
// e no fim do <body>, depois de carregar este script:
//   Sidebar.mount('sidebar-root');
//
// role-guard.js continua funcionando sem alterações: ele procura por
// `nav a[href$=".html"]` para esconder links que o perfil logado não pode
// acessar, e o <nav class="sidebar-nav"> gerado aqui atende esse seletor.
const Sidebar = {
    NAV_ITEMS: [
        { href: 'index.html', label: 'Minha Agenda', icon: 'calendar-check' },
        { href: 'relatorios.html', label: 'Relatórios', icon: 'file-text' },
        { href: 'supervisor.html', label: 'Supervisor', icon: 'users' },
        { href: 'coordenacao.html', label: 'Coordenação', icon: 'layout-dashboard' },
        { href: 'cadastros.html', label: 'Cadastros', icon: 'user-plus' },
    ],

    currentPage() {
        return window.location.pathname.split('/').pop() || 'index.html';
    },

    render(activeHref) {
        const active = activeHref || this.currentPage();

        const navHtml = this.NAV_ITEMS.map((item) => {
            const isActive = item.href === active;
            return `
                <a href="${item.href}" class="sidebar-nav-item${isActive ? ' active' : ''}">
                    <i data-lucide="${item.icon}" class="w-[18px] h-[18px]"></i>
                    <span>${item.label}</span>
                </a>
            `;
        }).join('');

        return `
            <div class="sidebar-logo">
                <div class="sidebar-logo-mark">
                    <i data-lucide="heart-pulse" class="w-5 h-5"></i>
                </div>
                <span class="sidebar-logo-word">Equitar</span>
            </div>

            <p class="sidebar-section-label">Menu</p>
            <nav class="sidebar-nav">
                ${navHtml}
            </nav>

            <div class="sidebar-footer">
                <p class="sidebar-section-label">Geral</p>
                <button onclick="AuthApi.logout()" class="sidebar-nav-item w-full text-left" style="border:none;background:none;cursor:pointer;">
                    <i data-lucide="log-out" class="w-[18px] h-[18px]"></i>
                    <span>Sair</span>
                </button>
            </div>
        `;
    },

    mount(containerId, options = {}) {
        const container = document.getElementById(containerId);
        if (!container) return;

        container.className = 'sidebar';
        container.innerHTML = this.render(options.active);

        if (window.lucide) lucide.createIcons();
    },
};
