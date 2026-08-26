// Pequenos construtores de HTML reaproveitados entre páginas — hoje só o
// cartão de estatística do estilo dashboard (usado em index.html; dá pra
// reusar em coordenacao.html quando os indicadores agregados existirem).
//
// Uso:
//   document.getElementById('stats-root').innerHTML = [
//       UI.statCard({ id: 'stat-total', label: 'Agendados Hoje', icon: 'users', accent: true }),
//       UI.statCard({ id: 'stat-completed', label: 'Realizados', icon: 'check-circle-2' }),
//   ].join('');
//   lucide.createIcons();
//
// Importante: `trend` só deve ser passado quando houver um número real por
// trás (ex: comparação com um período anterior calculado de verdade) — não
// inventamos "↑ aumentou desde o mês passado" só porque fica bonito.
const UI = {
    statCard({ id, label, icon, initialValue = '0', accent = false, trend = '' }) {
        const cardClass = `stat-card${accent ? ' stat-card--accent' : ''}`;

        return `
            <div class="${cardClass}">
                <div class="stat-card-top">
                    <p class="stat-card-label">${label}</p>
                    <div class="stat-card-icon-btn">
                        <i data-lucide="${icon}" class="w-4 h-4"></i>
                    </div>
                </div>
                <p id="${id}" class="stat-card-value">${initialValue}</p>
                ${trend ? `<p class="stat-card-trend"><i data-lucide="trending-up" class="w-3.5 h-3.5"></i> ${trend}</p>` : ''}
            </div>
        `;
    },

    badge(text, variant = 'neutral') {
        return `<span class="badge badge--${variant}">${text}</span>`;
    },
};
