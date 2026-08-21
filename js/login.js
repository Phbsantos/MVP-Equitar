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
        window.location.href = 'index.html';
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
    if (AuthApi.getSession()) {
        window.location.href = 'index.html';
    }
});
