const API_URL = 'http://127.0.0.1:8000/api/';
let usuarioLogado = null;
let unidadesSelecionadas = []; 
let listaSetoresBanco = []; // <--- AQUI VAMOS GUARDAR OS DADOS DO BANCO

// --- INICIALIZAÇÃO ---
document.addEventListener('DOMContentLoaded', () => {
    // 1. Tema
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    const icon = document.getElementById('themeIcon');
    if(icon) icon.className = savedTheme === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';

    // 2. Login
    const usuarioSalvo = localStorage.getItem('usuarioLogado');
    if (!usuarioSalvo) { window.location.href = 'login.html'; return; }
    usuarioLogado = JSON.parse(usuarioSalvo);
    document.getElementById('headerNome').innerText = usuarioLogado.nome;

    // 3. Carrega tudo
    carregarMeusDados();   // Dados do Usuário
    buscarSetoresDoBanco(); // Dados da Lista de Pesquisa
});

// --- FUNÇÕES DE SISTEMA ---
function toggleTheme() {
    const html = document.documentElement;
    const newTheme = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    document.getElementById('themeIcon').className = newTheme === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
}

function fazerLogout() {
    localStorage.removeItem('usuarioLogado');
    window.location.href = 'login.html';
}

// --- 1. BUSCAR A LISTA DE SETORES DO DJANGO ---
async function buscarSetoresDoBanco() {
    try {
        const response = await fetch(`${API_URL}setores/`, {
            headers: { 'Authorization': `Token ${usuarioLogado.token}` }
        });
        if(response.ok) {
            listaSetoresBanco = await response.json(); // Salva a lista real na memória
            console.log("Setores carregados:", listaSetoresBanco.length);
        }
    } catch (error) {
        console.error("Erro ao buscar setores:", error);
        // Fallback: Se der erro, deixa lista vazia ou avisa
        listaSetoresBanco = []; 
    }
}

// --- 2. CARREGAR DADOS DO USUÁRIO ---
async function carregarMeusDados() {
    try {
        const response = await fetch(`${API_URL}meus-dados/`, {
            headers: { 'Authorization': `Token ${usuarioLogado.token}` }
        });
        
        if (!response.ok) throw new Error("Erro ao buscar dados");

        const dados = await response.json();

        document.getElementById('perfilNome').value = dados.nome;
        document.getElementById('perfilEmail').value = dados.email;
        document.getElementById('perfilCargo').value = dados.cargo;
        document.getElementById('perfilMatricula').value = dados.matricula;

        if (dados.unidades) {
            unidadesSelecionadas = dados.unidades.split(',').map(u => u.trim()).filter(u => u !== "");
        } else {
            unidadesSelecionadas = [];
        }
        
        atualizarVisualizacaoUnidades();

    } catch (error) {
        console.error(error);
        alert("Erro ao carregar seus dados.");
    }
}

// --- LÓGICA DO MODAL DE SELEÇÃO ---

function abrirModalUnidades() {
    document.getElementById('modalBuscaUnidade').style.display = 'flex';
    document.getElementById('inputBuscaUnidade').value = '';
    filtrarUnidades(); 
    document.getElementById('inputBuscaUnidade').focus();
}

function fecharModalUnidades() {
    document.getElementById('modalBuscaUnidade').style.display = 'none';
}

// Renderiza a lista no modal (Usando a listaSetoresBanco agora!)
function filtrarUnidades() {
    const termo = document.getElementById('inputBuscaUnidade').value.toLowerCase();
    const listaContainer = document.getElementById('listaUnidadesScroll');
    listaContainer.innerHTML = '';

    // Usa a lista que veio do Backend
    const fonteDados = listaSetoresBanco.length > 0 ? listaSetoresBanco : ["Carregando..."];

    fonteDados.forEach(unidade => {
        // Se bater com a busca E ainda não tiver sido selecionada
        if (unidade.toLowerCase().includes(termo) && !unidadesSelecionadas.includes(unidade)) {
            const div = document.createElement('div');
            div.className = 'modal-list-item';
            div.innerText = unidade;
            // Só adiciona o clique se não for mensagem de carregando
            if(unidade !== "Carregando...") {
                div.onclick = () => selecionarUnidade(unidade);
            }
            listaContainer.appendChild(div);
        }
    });

    if (listaContainer.innerHTML === '') {
        listaContainer.innerHTML = '<div style="padding:15px; color:var(--text-secondary); text-align:center;">Nenhum setor encontrado.</div>';
    }
}

function selecionarUnidade(unidade) {
    unidadesSelecionadas.push(unidade);
    unidadesSelecionadas.sort();
    atualizarVisualizacaoUnidades();
    filtrarUnidades(); // Remove da lista de busca
    document.getElementById('inputBuscaUnidade').value = ''; 
    document.getElementById('inputBuscaUnidade').focus();
}

function removerUnidade(unidade) {
    unidadesSelecionadas = unidadesSelecionadas.filter(u => u !== unidade);
    atualizarVisualizacaoUnidades();
}

function atualizarVisualizacaoUnidades() {
    const container = document.getElementById('containerUnidades');
    container.innerHTML = '';

    if (unidadesSelecionadas.length === 0) {
        container.innerHTML = '<span style="color:var(--text-secondary); font-size:0.85rem; padding:10px;">Nenhuma unidade selecionada.</span>';
        return;
    }

    unidadesSelecionadas.forEach(unidade => {
        const tag = document.createElement('div');
        tag.className = 'unit-tag';
        tag.innerHTML = `
            ${unidade} 
            <i class="fa-solid fa-times" onclick="removerUnidade('${unidade}')" title="Remover"></i>
        `;
        container.appendChild(tag);
    });
}

// --- SALVAR DADOS ---
async function salvarMeusDados(event) {
    event.preventDefault();
    const btn = event.target.querySelector('button[type="submit"]');
    const textoOriginal = btn.innerHTML;
    
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Salvando...';
    btn.disabled = true;

    const stringUnidades = unidadesSelecionadas.join(', ');

    const payload = {
        nome: document.getElementById('perfilNome').value,
        email: document.getElementById('perfilEmail').value,
        cargo: document.getElementById('perfilCargo').value,
        unidades: stringUnidades
    };

    try {
        const response = await fetch(`${API_URL}meus-dados/`, {
            method: 'PATCH',
            headers: { 
                'Authorization': `Token ${usuarioLogado.token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            alert("Dados atualizados com sucesso!");
            document.getElementById('headerNome').innerText = payload.nome;
            usuarioLogado.nome = payload.nome;
            localStorage.setItem('usuarioLogado', JSON.stringify(usuarioLogado));
        } else {
            alert("Erro ao salvar dados.");
        }
    } catch (error) {
        console.error(error);
        alert("Erro de conexão.");
    } finally {
        btn.innerHTML = textoOriginal;
        btn.disabled = false;
    }
}