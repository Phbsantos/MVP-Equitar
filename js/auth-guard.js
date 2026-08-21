// Inclua este script logo após config.js e auth-api.js, em TODAS as telas
// exceto login.html. Ele redireciona pra login.html se ninguém estiver
// logado, e preenche automaticamente qualquer elemento #user-chip-* que
// existir na página com os dados de quem está logado.
(function () {
    const session = AuthApi.requireLogin();
    if (!session) return; // AuthApi.requireLogin() já disparou o redirect

    window.currentSession = session;

    function fillUserChip() {
        const nameEl = document.getElementById('user-chip-name');
        const roleEl = document.getElementById('user-chip-role');
        const especialidadeEl = document.getElementById('user-chip-especialidade');
        const initialsEl = document.getElementById('user-chip-initials');

        if (nameEl) nameEl.textContent = session.nome || 'Usuário';
        if (roleEl) roleEl.textContent = session.perfilRole || 'Usuário';
        if (especialidadeEl) especialidadeEl.textContent = session.especialidade || session.perfilRole || '';

        if (initialsEl) {
            const initials = (session.nome || '')
                .split(' ')
                .filter(Boolean)
                .map((n) => n[0])
                .slice(0, 2)
                .join('')
                .toUpperCase();
            initialsEl.textContent = initials || 'U';
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', fillUserChip);
    } else {
        fillUserChip();
    }
})();
