// Coordenador e Admin não têm agenda própria (ver js/role-guard.js) — mandar
// eles direto pra index.html só geraria um bounce imediato pra coordenacao.html.
// 2026-09-17: Indicadores virou a tela principal do Coordenador (era uma aba
// dentro de Coordenação) — só esse perfil muda de landing, Admin continua
// caindo em coordenacao.html.
function landingPageFor(perfilRole) {
    if (perfilRole === 'Coordenador') return 'indicadores.html';
    if (perfilRole === 'Admin') return 'coordenacao.html';
    return 'index.html';
}

function setLoginError(message) {
    const errorBox = document.getElementById('login-error');
    const errorText = document.getElementById('login-error-text');

    if (!message) {
        errorBox.classList.add('hidden');
        return;
    }

    errorText.textContent = message;
    errorBox.classList.remove('hidden');
}

function setLoginLoading(loading) {
    const btn = document.getElementById('login-submit-btn');
    btn.disabled = loading;
    btn.innerHTML = loading
        ? '<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> Entrando...'
        : '<i data-lucide="log-in" class="w-4 h-4"></i> Entrar';
    lucide.createIcons();
}

async function handleLoginSubmit(event) {
    event.preventDefault();
    setLoginError(null);

    const email = document.getElementById('login-email').value.trim();
    const senha = document.getElementById('login-senha').value;

    setLoginLoading(true);

    try {
        const usuario = await AuthApi.login(email, senha);
        AuthApi.saveSession(usuario);
        window.location.href = landingPageFor(usuario.perfilRole);
    } catch (error) {
        console.error(error);
        setLoginError(error.message || 'Não foi possível entrar. Tente novamente.');
    } finally {
        setLoginLoading(false);
    }
}

window.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();

    // Se já tem sessão salva, não precisa logar de novo.
    const session = AuthApi.getSession();
    if (session) {
        window.location.href = landingPageFor(session.perfilRole);
    }
});
