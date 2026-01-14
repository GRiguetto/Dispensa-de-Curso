// ============================================================================
// FORMULARIO.JS - ENVIO DE SOLICITAÇÕES COM DROPDOWN DE UNIDADES
// ============================================================================

const BASE_API_URL = 'http://127.0.0.1:8000/api/'; // Base para facilitar troca de rotas
let usuarioLogado = null;

// --- 1. INICIALIZAÇÃO E SEGURANÇA ---
document.addEventListener('DOMContentLoaded', () => {
    // A. Carregar Tema
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    const icon = document.getElementById('themeIcon');
    if(icon) icon.className = savedTheme === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';

    // B. Verificar Login
    const usuarioSalvo = localStorage.getItem('usuarioLogado');
    if (!usuarioSalvo) {
        alert("Você precisa estar logado para acessar esta página.");
        window.location.href = 'login.html';
        return;
    }
    
    usuarioLogado = JSON.parse(usuarioSalvo);

    // C. Validação de Token (Segurança Extra)
    if (!usuarioLogado.token) {
        alert("Sessão expirada. Faça login novamente.");
        localStorage.clear();
        window.location.href = 'login.html';
        return;
    }
    
    // D. Preenchimento Automático (Header e Dados do Usuário)
    document.getElementById('headerNome').innerText = usuarioLogado.nome || "Usuário";
    
    // Chama a função nova para buscar dados atualizados e preencher o Dropdown
    carregarDadosUsuario();
});

// --- 2. CARREGAR DADOS DO SERVIDOR E POPULAR DROPDOWN ---
async function carregarDadosUsuario() {
    try {
        // Busca perfil atualizado no backend (para pegar a lista de unidades nova)
        const response = await fetch(`${BASE_API_URL}meus-dados/`, {
            headers: { 'Authorization': `Token ${usuarioLogado.token}` }
        });

        if (!response.ok) throw new Error("Erro ao buscar dados do perfil");

        const dados = await response.json();

        // 1. Preenche os campos de texto (Readonly)
        // Nota: Mantive os IDs que vi no seu arquivo original (campoNome, campoMatricula, etc.)
        // Se no HTML estiver diferente, avise que ajustamos.
        if(document.getElementById('campoNome')) document.getElementById('campoNome').value = dados.nome;
        if(document.getElementById('campoMatricula')) document.getElementById('campoMatricula').value = dados.matricula;
        if(document.getElementById('campoCargo')) document.getElementById('campoCargo').value = dados.cargo;

        // Sugere o nome na assinatura
        if(document.getElementById('campoAssinatura')) document.getElementById('campoAssinatura').value = dados.nome;

        // 2. Preenche o Dropdown de Unidades
        const selectUnidade = document.getElementById('unidade');
        
        if (selectUnidade) {
            selectUnidade.innerHTML = '<option value="" selected disabled>Selecione a unidade solicitante...</option>';
            
            if (dados.unidades) {
                // O backend manda string: "UBS Central, SAMU" -> transformamos em lista
                const listaUnidades = dados.unidades.split(','); 
                
                listaUnidades.forEach(unidade => {
                    const nomeLimpo = unidade.trim();
                    if (nomeLimpo) {
                        const option = document.createElement('option');
                        option.value = nomeLimpo;
                        option.innerText = nomeLimpo;
                        selectUnidade.appendChild(option);
                    }
                });
            } else {
                // Caso o usuário não tenha cadastrado nenhuma unidade ainda
                const option = document.createElement('option');
                option.value = "Não definida";
                option.innerText = "Nenhuma unidade cadastrada (Atualize seu Perfil)";
                selectUnidade.appendChild(option);
            }
        }

    } catch (error) {
        console.error("Erro ao carregar perfil:", error);
        alert("Erro ao carregar seus dados. Tente recarregar a página.");
    }
}

// --- 3. VERIFICAR PRAZO (REGRA DOS 15 DIAS) ---
function verificarPrazo() {
    const inputData = document.getElementById('dataInicio').value;
    const aviso = document.getElementById('avisoPrazo');
    
    if (!inputData) return;

    const dataEvento = new Date(inputData);
    const hoje = new Date();
    
    // Zera as horas para comparar apenas os dias
    hoje.setHours(0,0,0,0);
    dataEvento.setHours(0,0,0,0);

    // Calcula diferença em dias
    const diffTime = dataEvento - hoje;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    // Se for menor que 15 dias e não for data passada
    if (diffDays < 15 && diffDays >= 0) {
        if(aviso) aviso.style.display = 'block';
    } else {
        if(aviso) aviso.style.display = 'none';
    }
}

// --- 4. ALTERNAR TEMA (DARK MODE) ---
function toggleTheme() {
    const html = document.documentElement;
    const currentTheme = html.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    html.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    
    const icon = document.getElementById('themeIcon');
    if(icon) icon.className = newTheme === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
}

// --- 5. ENVIAR SOLICITAÇÃO ---
async function enviarSolicitacao(event) {
    event.preventDefault();

    // A. Validações Locais
    const assinatura = document.getElementById('campoAssinatura').value;
    const unidadeSelecionada = document.getElementById('unidade').value;

    if(!unidadeSelecionada) {
        alert("Por favor, selecione sua Unidade de Lotação.");
        document.getElementById('unidade').focus();
        return;
    }

    if(!assinatura || assinatura.trim() === "") {
        alert("Atenção: A Assinatura Digital é obrigatória.");
        document.getElementById('campoAssinatura').focus();
        return;
    }

    const checkTermos = document.getElementById('checkTermos');
    if(checkTermos && !checkTermos.checked) {
        alert("Você deve aceitar os termos para prosseguir.");
        return;
    }

    // B. Feedback Visual (Loading)
    const btn = document.querySelector('.btn-submit');
    const textoOriginal = btn.innerHTML;
    
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Enviando...';
    btn.disabled = true;

    // C. Prepara os Dados
    const dadosPedido = {
        usuario: usuarioLogado.id,
        matricula: usuarioLogado.matricula,
        
        // Pega o cargo do campo (caso tenha sido atualizado)
        cargo: document.getElementById('campoCargo').value || "Servidor",
        
        // IMPORTANTE: Agora pega a unidade escolhida no Dropdown
        unidade: unidadeSelecionada,
        
        nome_evento: document.getElementById('nomeEvento').value,
        objetivo: document.getElementById('objetivo').value,
        data_inicio: document.getElementById('dataInicio').value,
        data_fim: document.getElementById('dataFim').value,
        cidade: document.getElementById('cidade').value,
        estado: document.getElementById('estado').value,
        
        assinatura_servidor: assinatura, 
        status: 'PENDENTE_GERENTE'
    };

    // D. Envio para o Backend
    try {
        const response = await fetch(`${BASE_API_URL}solicitacoes/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Token ${usuarioLogado.token}`
            },
            body: JSON.stringify(dadosPedido)
        });

        if (response.ok) {
            const resultado = await response.json();
            alert(`✅ Solicitação enviada com sucesso! \nProtocolo: ${resultado.id}`);
            window.location.href = 'dashboard.html';
        } else {
            const erro = await response.json();
            console.error("Erro do servidor:", erro);
            alert("Erro ao processar solicitação. Verifique os campos.");
        }

    } catch (error) {
        console.error("Erro de rede:", error);
        alert("Erro de conexão com o servidor.");
    } finally {
        btn.innerHTML = textoOriginal;
        btn.disabled = false;
    }
}