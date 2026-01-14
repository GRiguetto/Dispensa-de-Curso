// ============================================================================
// DASHBOARD.JS - CORRIGIDO PARA O SEU HTML ORIGINAL
// ============================================================================

const API_URL = 'http://127.0.0.1:8000/api/';
let usuarioLogado = null;

// --- 1. INICIALIZAÇÃO SEGURA ---
document.addEventListener('DOMContentLoaded', () => {
    // A. Tema
    try {
        const savedTheme = localStorage.getItem('theme') || 'light';
        document.documentElement.setAttribute('data-theme', savedTheme);
        const icon = document.getElementById('themeIcon');
        if(icon) icon.className = savedTheme === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
    } catch(e) {}

    // B. Login Check
    const usuarioSalvo = localStorage.getItem('usuarioLogado');
    if (!usuarioSalvo) {
        window.location.href = 'login.html';
        return;
    }
    usuarioLogado = JSON.parse(usuarioSalvo);

    // C. Header (Preenche Nome)
    if(document.getElementById('headerNome')) {
        document.getElementById('headerNome').innerText = usuarioLogado.nome;
    }

    // D. Carregar Dados
    carregarSolicitacoes();
});

// --- 2. FUNÇÕES GERAIS ---
function toggleTheme() {
    const html = document.documentElement;
    const newTheme = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    const icon = document.getElementById('themeIcon');
    if(icon) icon.className = newTheme === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
}

function fazerLogout() {
    localStorage.removeItem('usuarioLogado');
    window.location.href = 'login.html';
}

// --- 3. CARREGAR DADOS ---
async function carregarSolicitacoes() {
    try {
        const response = await fetch(`${API_URL}solicitacoes/`, {
            headers: { 'Authorization': `Token ${usuarioLogado.token}` }
        });
        
        if (response.ok) {
            const lista = await response.json();
            
            // AQUI ESTÁ A CORREÇÃO:
            // Usamos renderizarLista (para seus cards) e não renderizarTabela
            renderizarLista(lista); 
            atualizarStats(lista);
        } else {
            document.getElementById('listaSolicitacoes').innerHTML = '<p style="text-align:center; padding:20px; color:red">Erro ao carregar dados.</p>';
        }
    } catch (error) {
        console.error("Erro de conexão:", error);
        document.getElementById('listaSolicitacoes').innerHTML = '<p style="text-align:center; padding:20px; color:red">Erro de conexão com o servidor.</p>';
    }
}

// --- 4. ATUALIZAR ESTATÍSTICAS (SEUS IDs ORIGINAIS) ---
function atualizarStats(lista) {
    // IDs do seu HTML: countAnalise, countAprovados, countCancelados
    const analiseEl = document.getElementById('countAnalise');
    const aprovadosEl = document.getElementById('countAprovados');
    const canceladosEl = document.getElementById('countCancelados');

    if (analiseEl && aprovadosEl && canceladosEl) {
        const pendentes = lista.filter(i => i.status.includes('PENDENTE')).length;
        const aprovados = lista.filter(i => i.status === 'APROVADO').length;
        const cancelados = lista.filter(i => i.status === 'INDEFERIDO').length;

        analiseEl.innerText = pendentes;
        aprovadosEl.innerText = aprovados;
        canceladosEl.innerText = cancelados;
    }
}

// --- 5. RENDERIZAR LISTA (VISUAL DE CARDS ORIGINAIS) ---
function renderizarLista(lista) {
    const container = document.getElementById('listaSolicitacoes'); // Seu ID correto
    if(!container) return;

    container.innerHTML = ''; // Limpa o "Carregando..."

    if (lista.length === 0) {
        container.innerHTML = '<p style="text-align:center; padding:20px; color:gray">Nenhuma solicitação encontrada.</p>';
        return;
    }

    lista.forEach(pedido => {
        // Formatar Data
        let dataF = pedido.data_inicio;
        try { dataF = new Date(pedido.data_inicio).toLocaleDateString('pt-BR'); } catch(e){}

        // Ícones e Cores
        let statusClass = '';
        let statusTexto = pedido.status;
        let iconClass = 'fa-file-lines'; 

        if(pedido.status.includes('PENDENTE')) { 
            statusClass = 'status-pending'; // Precisa ter no CSS ou ficará padrão
            statusTexto = 'Em Análise'; 
            iconClass = 'fa-clock';
        }
        else if(pedido.status === 'APROVADO') { 
            statusClass = 'status-approved'; 
            statusTexto = 'Aprovado'; 
            iconClass = 'fa-check-circle';
        }
        else if(pedido.status === 'INDEFERIDO') { 
            statusClass = 'status-rejected'; 
            statusTexto = 'Indeferido'; 
            iconClass = 'fa-xmark-circle';
        }

       // MUDANÇA AQUI: Adicionei a classe "view" no botão do olho
       let botoesAcao = `
       <button onclick="verDetalhes(${pedido.id})" class="btn-icon-small view" title="Ver Detalhes">
           <i class="fa-solid fa-eye"></i>
       </button>
   `;

   const role = usuarioLogado.role;
   
   // Botões de Chefia (Aprovar/Reprovar)
   if (
       (role === 'manager' && pedido.status === 'PENDENTE_GERENTE') ||
       (role === 'coordinator' && pedido.status === 'PENDENTE_COORD') ||
       (role === 'admin' && pedido.status === 'PENDENTE_ADMIN')
   ) {
       botoesAcao += `
           <button onclick="aprovarSolicitacao(${pedido.id})" class="btn-icon-small approve" title="Aprovar">
               <i class="fa-solid fa-check"></i>
           </button>
           <button onclick="reprovarSolicitacao(${pedido.id})" class="btn-icon-small reject" title="Negar">
               <i class="fa-solid fa-xmark"></i>
           </button>
       `;
   }

   // Botão PDF (Download)
   if (pedido.status === 'APROVADO') {
       botoesAcao += `
           <button onclick="gerarPDF(${pedido.id})" class="btn-icon-small download" title="Baixar PDF Oficial">
               <i class="fa-solid fa-file-pdf"></i>
           </button>
       `;
   }

        // Cria o Card (Usando seu estilo de div)
        const item = document.createElement('div');
        item.className = 'request-card'; // Se tiver essa classe no CSS
        // Estilo inline para garantir que fique bonito caso falte CSS
        item.style.cssText = `
            background: var(--surface-color);
            padding: 15px;
            margin-bottom: 10px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.05);
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-left: 4px solid var(--primary-color);
        `;

        item.innerHTML = `
            <div style="display:flex; align-items:center; gap:15px;">
                <div style="font-size:1.2rem; color:var(--text-secondary); width:40px; text-align:center;">
                    <i class="fa-solid ${iconClass}"></i>
                </div>
                <div>
                    <h4 style="margin:0; font-size:1rem; color:var(--text-primary);">
                        ${pedido.nome_evento || 'Solicitação'}
                    </h4>
                    <small style="color:var(--text-secondary);">
                        ${dataF} • ${pedido.unidade || 'Unidade'}
                    </small>
                </div>
            </div>

            <div style="display:flex; align-items:center; gap:15px;">
                <span style="font-size:0.85rem; font-weight:600; color:var(--text-primary);">
                    ${statusTexto}
                </span>
                <div style="display:flex; gap:8px;">
                    ${botoesAcao}
                </div>
            </div>
        `;
        
        container.appendChild(item);
    });
}

// --- 6. AÇÕES (APROVAR/REPROVAR/PDF) ---
async function aprovarSolicitacao(id) {
    if(!confirm("Confirmar aprovação?")) return;
    callApi(id, 'aprovar');
}

async function reprovarSolicitacao(id) {
    if(!confirm("Confirmar reprovação?")) return;
    callApi(id, 'reprovar');
}

async function callApi(id, action) {
    try {
        const response = await fetch(`${API_URL}solicitacoes/${id}/${action}/`, {
            method: 'POST',
            headers: {
                'Authorization': `Token ${usuarioLogado.token}`,
                'Content-Type': 'application/json'
            }
        });
        if(response.ok) {
            alert("Sucesso!");
            carregarSolicitacoes();
        } else {
            alert("Erro ao processar.");
        }
    } catch(e) { console.error(e); }
}

// --- FUNÇÃO VER DETALHES (MODAL COMPLETO) ---
function verDetalhes(id) {
    // Mostra carregando enquanto busca
    const modal = document.getElementById('modalDetalhes');
    const container = document.getElementById('detalhesPedido');
    
    // Mostra o modal vazio com loading
    if(container) {
        container.innerHTML = '<div style="padding:40px; text-align:center;"><i class="fa-solid fa-spinner fa-spin fa-2x"></i><p>Carregando informações...</p></div>';
        modal.style.display = 'flex';
    }

    // Busca os dados
    fetch(`${API_URL}solicitacoes/${id}/`, {
        headers: { 'Authorization': `Token ${usuarioLogado.token}` }
    })
    .then(r => r.json())
    .then(pedido => {
        // Formatações
        const dataInicio = new Date(pedido.data_inicio).toLocaleDateString('pt-BR');
        const dataFim = new Date(pedido.data_fim).toLocaleDateString('pt-BR');
        
        // Lógica da Linha do Tempo (Status)
        let s1 = '', s2 = '', s3 = ''; // Classes CSS active
        const st = pedido.status;
        
        if(st === 'PENDENTE_GERENTE') { s1 = 'active'; }
        else if(st === 'PENDENTE_COORD') { s1 = 'active'; s2 = 'active'; }
        else if(st === 'PENDENTE_ADMIN') { s1 = 'active'; s2 = 'active'; s3 = 'active'; }
        else if(st === 'APROVADO') { s1 = 'active'; s2 = 'active'; s3 = 'active'; }
        
        // Monta o HTML Bonito
        container.innerHTML = `
            <div class="modal-header-modern">
                <h3><i class="fa-regular fa-file-lines"></i> Solicitação #${pedido.id}</h3>
                <button onclick="document.getElementById('modalDetalhes').style.display='none'" class="btn-close-white" title="Fechar">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>

            <div class="modal-body-scroll">
                
                <div class="status-timeline">
                    <div class="step ${s1}">
                        <div class="step-circle"><i class="fa-solid fa-user-tie"></i></div>
                        <div class="step-label">Gerência</div>
                    </div>
                    <div class="step ${s2}">
                        <div class="step-circle"><i class="fa-solid fa-building-user"></i></div>
                        <div class="step-label">Coordenação</div>
                    </div>
                    <div class="step ${s3}">
                        <div class="step-circle"><i class="fa-solid fa-check"></i></div>
                        <div class="step-label">Aprovação Final</div>
                    </div>
                </div>

                <hr style="border:0; border-top:1px solid var(--border-color); margin: 20px 0;">

                <div class="info-grid">
                    <div class="info-item">
                        <label>Evento</label>
                        <p><strong>${pedido.nome_evento}</strong></p>
                    </div>
                    <div class="info-item">
                        <label>Status Atual</label>
                        <p><span class="status-badge ${pedido.status === 'APROVADO' ? 'status-approved' : 'status-pending'}">${pedido.status}</span></p>
                    </div>
                    <div class="info-item">
                        <label>Data de Início</label>
                        <p><i class="fa-regular fa-calendar"></i> ${dataInicio}</p>
                    </div>
                    <div class="info-item">
                        <label>Data de Fim</label>
                        <p><i class="fa-regular fa-calendar-check"></i> ${dataFim}</p>
                    </div>
                    <div class="info-item">
                        <label>Solicitante</label>
                        <p><i class="fa-regular fa-user"></i> ${pedido.matricula}</p>
                    </div>
                    <div class="info-item">
                        <label>Unidade / Lotação</label>
                        <p><i class="fa-solid fa-hospital"></i> ${pedido.unidade}</p>
                    </div>
                     <div class="info-item">
                        <label>Local do Evento</label>
                        <p><i class="fa-solid fa-map-location-dot"></i> ${pedido.cidade} - ${pedido.estado}</p>
                    </div>
                </div>

                <div class="info-item">
                    <label style="margin-bottom:8px;">Objetivo / Justificativa</label>
                    <div class="info-block">
                        <p>${pedido.objetivo}</p>
                    </div>
                </div>

            </div>

            <div class="modal-footer">
                ${pedido.status === 'APROVADO' ? 
                    `<button onclick="gerarPDF(${pedido.id})" class="btn-secondary" style="background:#fff; border:1px solid var(--border-color); color:var(--text-primary);">
                        <i class="fa-regular fa-file-pdf" style="color:red;"></i> Baixar PDF
                    </button>` : ''
                }
                <button onclick="document.getElementById('modalDetalhes').style.display='none'" class="btn-primary">
                    Fechar
                </button>
            </div>
        `;
    })
    .catch(erro => {
        console.error(erro);
        container.innerHTML = '<div style="padding:20px; text-align:center; color:red;">Erro ao carregar detalhes.</div>';
    });
}

function gerarPDF(id) {
    fetch(`${API_URL}solicitacoes/${id}/pdf/`, {
        method: 'GET',
        headers: { 'Authorization': `Token ${usuarioLogado.token}` }
    })
    .then(r => r.blob())
    .then(blob => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `pedido_${id}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
    });
}