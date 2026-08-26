const AuthApi = {
    SESSION_KEY: 'clinicasaas_session',

    // 2026-08-26: formato da resposta na base nova (phbsantos1) —
    // confirmado testando os 3 casos:
    //   sucesso:  {"sucesso":true,"mensagem":"...","id":"rec...","Nome":"...","Especialidade":"..."}
    //   erro:     {"sucesso":false,"mensagem":"E-mail ou senha inválidos."}
    // Não é mais o registro cru do Airtable ({id, fields}) como na base
    // antiga. Repare que a resposta de sucesso NÃO traz Perfil_Role, Email
    // nem Status — sem Perfil_Role o role-guard.js não tem como restringir
    // nada. Por isso, depois de confirmado o login, buscamos o registro
    // completo em /listar/usuarios (por isso login.html agora também
    // carrega usuarios-api.js).
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

        if (!response.ok || !data || data.sucesso !== true || !data.id) {
            throw new Error((data && data.mensagem) || 'E-mail ou senha inválidos.');
        }

        let usuarioCompleto = null;
        try {
            const usuarios = await UsuariosApi.fetchUsuarios();
            usuarioCompleto = usuarios.find((u) => u.id === data.id) || null;
        } catch (e) {
            console.error('Falha ao buscar dados completos do usuário após login:', e);
        }

        if (!usuarioCompleto) {
            console.warn(
                `Login de ${data.id} confirmado, mas não achei o registro completo em /listar/usuarios — ` +
                    'perfilRole/email/status vão ficar vazios nesta sessão.'
            );
        }

        return {
            id: data.id,
            nome: (usuarioCompleto && usuarioCompleto.nome) || data.Nome || '',
            email: (usuarioCompleto && usuarioCompleto.email) || '',
            perfilRole: (usuarioCompleto && usuarioCompleto.perfilRole) || '',
            especialidade: (usuarioCompleto && usuarioCompleto.especialidade) || data.Especialidade || '',
            status: (usuarioCompleto && usuarioCompleto.status) || 'Ativo',
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
