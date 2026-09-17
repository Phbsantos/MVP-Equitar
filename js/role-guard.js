// Controla o acesso às telas de acordo com o Perfil_Role do usuário logado.
// Inclua este script logo após auth-guard.js, em todas as telas exceto login.html.
//
// Coordenador e Admin não têm agenda própria de atendimentos — "Minha
// Agenda" (index.html) é a tela de trabalho do Terapeuta/Supervisor. Por
// isso os dois perfis administrativos ficam de fora dela e caem direto em
// Coordenação (primeiro item da lista) após o login.
(function () {
    const session = window.currentSession || AuthApi.getSession();
    if (!session) return; // auth-guard.js já cuida do redirect sem sessão

    const ROLE_PAGES = {
        Terapeuta: ['index.html'],
        Supervisor: ['index.html', 'supervisor.html'],
        Coordenador: ['coordenacao.html', 'cadastros.html', 'relatorios.html', 'supervisor.html'],
        Admin: ['coordenacao.html', 'cadastros.html', 'relatorios.html', 'supervisor.html'],
    };

    const allowed = ROLE_PAGES[session.perfilRole];
    if (!allowed) return; // perfil sem restrição definida ainda

    const currentPage = window.location.pathname.split('/').pop() || 'index.html';

    if (!allowed.includes(currentPage)) {
        window.location.href = allowed[0];
        return;
    }

    // Some só os links do menu principal que o perfil não pode acessar.
    function filterNav() {
        document.querySelectorAll('nav a[href$=".html"]').forEach((link) => {
            const href = link.getAttribute('href');
            if (!allowed.includes(href)) {
                link.remove();
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', filterNav);
    } else {
        filterNav();
    }
})();
