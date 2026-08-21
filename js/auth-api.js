const AuthApi = {
    SESSION_KEY: 'clinicasaas_session',

    async login(email, senha) {
        const url = `${CONFIG.API_BASE}${CONFIG.ENDPOINTS.USUARIO_LOGIN}`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, senha }),
        });

        // Login errado / e-mail inexistente hoje volta 200 com corpo vazio.
        // Um registro válido vem no formato cru do Airtable ({ id, fields }).
        let data = null;
        try {
            data = await response.json();
        } catch (e) {
            data = null;
        }

        if (!response.ok || !data || !data.id || !data.fields) {
            throw new Error('E-mail ou senha inválidos.');
        }

        const fields = data.fields;

        // Só repassamos os campos que a UI precisa — o campo de senha (Senhas)
        // nunca é lido aqui, mesmo que a API o inclua na resposta.
        return {
            id: data.id,
            nome: fields.Nome || '',
            email: fields.Email || '',
            perfilRole: fields.Perfil_Role || '',
            especialidade: fields.Especialidade || '',
            status: fields.Status || 'Ativo',
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
