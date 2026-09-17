const AuthApi = {
    SESSION_KEY: 'clinicasaas_session',

    // 2026-09-08: backend novo (n8n local + Postgres, ver js/config.js)
    // devolve a sessão completa numa chamada só —
    // {"sucesso":true,"mensagem":"...","usuario":{"id":1,"nome":"...",
    // "email":"...","perfilRole":"...","especialidade":"...",
    // "equipeId":1,"status":"Ativo"}} — ou {"sucesso":false,"mensagem":"..."}
    // com HTTP 401 (credenciais inválidas) ou 403 (usuário inativo).
    // Isso elimina o workaround que existia na base antiga: lá a resposta
    // de sucesso vinha achatada e sem Perfil_Role/Email/Status, então era
    // preciso completar a sessão com uma segunda busca em /listar/usuarios
    // pelo id — não é mais necessário.
    async login(email, senha) {
        const url = `${CONFIG.API_BASE}${CONFIG.ENDPOINTS.USUARIO_LOGIN}`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, senha }),
        });

        let data = null;
        try {
            data = await response.json();
        } catch (e) {
            data = null;
        }

        if (!response.ok || !data || data.sucesso !== true || !data.usuario) {
            throw new Error((data && data.mensagem) || 'E-mail ou senha inválidos.');
        }

        const usuario = data.usuario;
        return {
            id: usuario.id,
            nome: usuario.nome || '',
            email: usuario.email || '',
            perfilRole: usuario.perfilRole || '',
            especialidade: usuario.especialidade || '',
            equipeId: usuario.equipeId ?? null,
            status: usuario.status || 'Ativo',
        };
    },

    saveSession(usuario) {
        localStorage.setItem(this.SESSION_KEY, JSON.stringify(usuario));
    },

    getSession() {
        try {
            return JSON.parse(localStorage.getItem(this.SESSION_KEY));
        } catch (e) {
            return null;
        }
    },

    clearSession() {
        localStorage.removeItem(this.SESSION_KEY);
    },

    // Chame no topo de qualquer tela que exija login.
    // Redireciona pra login.html se não houver sessão, e devolve o usuário logado.
    requireLogin() {
        const session = this.getSession();
        if (!session) {
            window.location.href = 'login.html';
            return null;
        }
        return session;
    },

    logout() {
        this.clearSession();
        window.location.href = 'login.html';
    },
};
