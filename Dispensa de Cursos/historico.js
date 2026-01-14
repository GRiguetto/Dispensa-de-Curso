// historico.js - Histórico com Token e PDF Oficial

const API_URL = 'http://127.0.0.1:8000/api/solicitacoes/';
let todosPedidos = [];
let usuarioLogado = null;

// --- INICIALIZAÇÃO ---
document.addEventListener('DOMContentLoaded', () => {
    // Tema
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    const icon = document.getElementById('themeIcon');
    if(icon) icon.className = savedTheme === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';

    // Login e Token
    const usuarioSalvo = localStorage.getItem('usuarioLogado');
    if (!usuarioSalvo) { window.location.href = 'login.html'; return; }
    
    usuarioLogado = JSON.parse(usuarioSalvo);
    
    if (!usuarioLogado.token) {
        alert("Sessão expirada. Faça login novamente.");
        window.location.href = 'login.html';
        return;
    }

    document.getElementById('headerNome').innerText = usuarioLogado.nome;
    carregarHistorico();
});

function toggleTheme() {
    const html = document.documentElement;
    const newTheme = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    document.getElementById('themeIcon').className = newTheme === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
}

// --- BUSCAR DADOS (COM TOKEN) ---
async function carregarHistorico() {
    const tbody = document.getElementById('tabelaHistorico');
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center"><i class="fa-solid fa-spinner fa-spin"></i> Carregando dados...</td></tr>';

    try {
        const response = await fetch(API_URL, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Token ${usuarioLogado.token}` // <--- Token Aqui!
            }
        });

        if (!response.ok) {
            if (response.status === 401) { alert("Sessão inválida."); window.location.href = 'login.html'; return; }
            throw new Error("Erro de conexão");
        }

        todosPedidos = await response.json();
        aplicarFiltros();

    } catch (error) {
        console.error(error);
        tbody.innerHTML = '<tr><td colspan="6" style="color:var(--danger-color); text-align:center">Erro ao carregar histórico. Verifique a conexão.</td></tr>';
    }
}

// --- FILTROS (Mantido igual) ---
function aplicarFiltros() {
    const texto = document.getElementById('buscaTexto').value.toLowerCase();
    const statusFiltro = document.getElementById('buscaStatus').value;
    const ordem = document.getElementById('ordenacao').value;

    let listaFiltrada = todosPedidos.filter(pedido => {
        const nomeUser = pedido.usuario_dados?.first_name?.toLowerCase() || "";
        const matricula = pedido.matricula?.toLowerCase() || "";
        const matchTexto = nomeUser.includes(texto) || matricula.includes(texto);

        let matchStatus = true;
        if (statusFiltro === 'APROVADO') matchStatus = (pedido.status === 'APROVADO');
        else if (statusFiltro === 'CANCELADO') matchStatus = (pedido.status === 'CANCELADO');
        else if (statusFiltro === 'PENDENTE') matchStatus = (pedido.status.includes('PENDENTE'));

        return matchTexto && matchStatus;
    });

    listaFiltrada.sort((a, b) => {
        const dataA = new Date(a.data_criacao);
        const dataB = new Date(b.data_criacao);
        return ordem === 'recente' ? dataB - dataA : dataA - dataB;
    });

    renderizarTabela(listaFiltrada);
}

function renderizarTabela(lista) {
    const tbody = document.getElementById('tabelaHistorico');
    const msgVazio = document.getElementById('msgVazio');
    tbody.innerHTML = '';

    if (lista.length === 0) {
        msgVazio.style.display = 'block';
        return;
    }
    msgVazio.style.display = 'none';

    lista.forEach(pedido => {
        const nomeUser = pedido.usuario_dados?.first_name || 'Servidor';
        const dataFmt = new Date(pedido.data_criacao).toLocaleDateString('pt-BR');
        
        let badgeClass = 'secondary';
        let statusTexto = pedido.status;
        if(pedido.status === 'PENDENTE_GERENTE') { badgeClass = 'warning'; statusTexto = 'Aguardando Gerente'; }
        else if(pedido.status === 'PENDENTE_COORD') { badgeClass = 'info'; statusTexto = 'Coordenação'; }
        else if(pedido.status === 'PENDENTE_ADMIN') { badgeClass = 'primary'; statusTexto = 'Secretaria'; }
        else if(pedido.status === 'APROVADO') { badgeClass = 'success'; statusTexto = 'Concluído'; }
        else if(pedido.status === 'CANCELADO') { badgeClass = 'danger'; statusTexto = 'Indeferido'; }

        // Botão PDF só se estiver APROVADO
        let btnPDF = '';
        if (pedido.status === 'APROVADO') {
            btnPDF = `<button class="btn-action" onclick="gerarPDF(${pedido.id})" title="Baixar PDF"><i class="fa-solid fa-file-pdf"></i> PDF</button>`;
        } else {
            btnPDF = `<span style="color:var(--text-secondary); font-size:0.8rem">-</span>`;
        }

        const row = `
            <tr>
                <td>${dataFmt}</td>
                <td><strong>${nomeUser}</strong><br><small>${pedido.matricula}</small></td>
                <td>${pedido.nome_evento}</td>
                <td>${pedido.unidade}</td>
                <td><span class="badge badge-${badgeClass}">${statusTexto}</span></td>
                <td style="text-align: right;">${btnPDF}</td>
            </tr>
        `;
        tbody.innerHTML += row;
    });
}

// --- GERAR PDF (Mesma lógica do Dashboard) ---
async function gerarPDF(id) {
    try {
        const response = await fetch(`${API_URL}${id}/`, {
            headers: { 'Authorization': `Token ${usuarioLogado.token}` } // Token aqui também!
        });
        const pedido = await response.json();

        // Preencher PDF
        const nomeUser = pedido.usuario_dados?.first_name || "Servidor";
        const dataIni = new Date(pedido.data_inicio).toLocaleDateString('pt-BR');
        const dataFim = new Date(pedido.data_fim).toLocaleDateString('pt-BR');
        const hoje = new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });

        document.getElementById('pdfProtocolo').innerText = pedido.protocolo_sigm || `SIGM-${pedido.id}/2026`;
        document.getElementById('pdfNome').innerText = nomeUser;
        document.getElementById('pdfMatricula').innerText = pedido.matricula;
        document.getElementById('pdfCargo').innerText = pedido.cargo;
        document.getElementById('pdfUnidade').innerText = pedido.unidade;
        
        document.getElementById('pdfEvento').innerText = pedido.nome_evento;
        document.getElementById('pdfObjetivo').innerText = pedido.objetivo;
        document.getElementById('pdfPeriodo').innerText = `${dataIni} a ${dataFim}`;
        document.getElementById('pdfCidade').innerText = pedido.cidade;
        document.getElementById('pdfEstado').innerText = pedido.estado;

        // Checkboxes
        document.getElementById('checkConvite').innerText = "( ) Convite";
        document.getElementById('checkProgramacao').innerText = "( ) Programação";
        document.getElementById('checkConvocacao').innerText = "( ) Convocação";
        document.getElementById('checkOutros').innerText = "( ) Outros";

        if (pedido.tipo_convite) document.getElementById('checkConvite').innerText = "(X) Convite";
        if (pedido.tipo_programacao) document.getElementById('checkProgramacao').innerText = "(X) Programação";
        if (pedido.tipo_convocacao) document.getElementById('checkConvocacao').innerText = "(X) Convocação";
        if (pedido.tipo_outros) document.getElementById('checkOutros').innerText = "(X) Outros";

        // Assinaturas
        document.getElementById('signServidor').innerText = nomeUser;
        document.getElementById('signGerente').innerText = pedido.assinatura_gerente || '';
        document.getElementById('signAdmin').innerText = pedido.assinatura_admin || '';
        document.getElementById('pdfDataAssinatura').innerText = hoje;

        // Gerar
        const element = document.getElementById('modeloPDF');
        element.style.display = 'block';
        const opt = {
            margin: 0,
            filename: `Dispensa_${id}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2 },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };
        
        html2pdf().set(opt).from(element).save().then(() => {
            element.style.display = 'none';
        });

    } catch (e) { 
        console.error(e);
        alert("Erro ao gerar PDF."); 
    }
}

