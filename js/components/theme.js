// Configuração compartilhada do Tailwind (CDN) — carregado por TODAS as
// páginas, sempre DEPOIS de <script src="https://cdn.tailwindcss.com">,
// no mesmo padrão que já funcionava quando esse bloco vivia duplicado
// inline em cada .html. Antes disto existiam 6 cópias praticamente
// idênticas deste objeto espalhadas pelo repositório.
//
// blue/indigo continuam espelhando a cor de marca (não os azuis padrão do
// Tailwind) porque várias telas já usam bg-blue-*/bg-indigo-* fora da
// barra de navegação (chip de usuário, ícones de card) contando com esse
// comportamento — mudar isso agora quebraria essas telas sem necessidade.
tailwind.config = {
    theme: {
        extend: {
            fontFamily: {
                sans: ['Plus Jakarta Sans', 'Inter', 'sans-serif'],
            },
            colors: {
                clinical: {
                    50: '#eaf3ec', 100: '#cfe6d5', 200: '#a3d0ae', 300: '#74b686',
                    400: '#4c9c65', 500: '#2f8049', 600: '#1f6b3b', 700: '#17532e',
                    800: '#113d23', 900: '#0b2a18',
                },
                blue: {
                    50: '#eaf3ec', 100: '#cfe6d5', 200: '#a3d0ae', 300: '#74b686',
                    400: '#4c9c65', 500: '#2f8049', 600: '#1f6b3b', 700: '#17532e',
                    800: '#113d23', 900: '#0b2a18',
                },
                indigo: {
                    50: '#eaf3ec', 100: '#cfe6d5', 200: '#a3d0ae', 300: '#74b686',
                    400: '#4c9c65', 500: '#2f8049', 600: '#1f6b3b', 700: '#17532e',
                    800: '#113d23', 900: '#0b2a18',
                },
                slate: {
                    50: '#f5f4ee', 100: '#efede3', 200: '#e7e4d9', 300: '#c9c6b8',
                    400: '#93968c', 500: '#787c72', 600: '#62685f', 700: '#454a41',
                    800: '#2b2f27', 900: '#1a1d19',
                },
            },
        },
    },
};
