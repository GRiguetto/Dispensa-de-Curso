// CONFIGURAÇÕES GERAIS
const API_URL = "http://127.0.0.1:8000/api/";
let usuarioLogado = null;

// INICIALIZAÇÃO
document.addEventListener("DOMContentLoaded", () => {
  // A. Carregar Tema
  const savedTheme = localStorage.getItem("theme") || "light";
  document.documentElement.setAttribute("data-theme", savedTheme);
  const icon = document.getElementById("themeIcon");
  if (icon)
    icon.className =
      savedTheme === "dark" ? "fa-solid fa-sun" : "fa-solid fa-moon";

  // B. Verificar Login
  const usuarioSalvo = localStorage.getItem("usuarioLogado");
  if (!usuarioSalvo) {
    alert("Você precisa estar logado para acessar esta página.");
    window.location.href = "login.html";
    return;
  }

  usuarioLogado = JSON.parse(usuarioSalvo);

  // C. Validação de Token (Segurança Extra)
  if (!usuarioLogado.token) {
    alert("Sessão expirada. Faça login novamente.");
    localStorage.clear();
    window.location.href = "login.html";
    return;
  }

  // D. Preenchimento Automático (Header e Dados do Usuário)
  if (document.getElementById("headerNome")) {
      document.getElementById("headerNome").innerText = usuarioLogado.nome || "Usuário";
  }

  // Chama a função nova para buscar dados atualizados e preencher o Dropdown
  carregarDadosUsuario();
});

// CARREGAR DADOS DO SERVIDOR E DROPDOWN
async function carregarDadosUsuario() {
  try {
    const response = await fetch(`${API_URL}meus-dados/`, {
      headers: { Authorization: `Token ${usuarioLogado.token}` },
    });

    if (!response.ok) throw new Error("Erro ao buscar dados do perfil");

    const dados = await response.json();

    if (document.getElementById("campoNome"))
      document.getElementById("campoNome").value = dados.nome;
    if (document.getElementById("campoMatricula"))
      document.getElementById("campoMatricula").value = dados.matricula;
    if (document.getElementById("campoCargo"))
      document.getElementById("campoCargo").value = dados.cargo;

    // Sugere o nome na assinatura
    if (document.getElementById("campoAssinatura"))
      document.getElementById("campoAssinatura").value = dados.nome;

    // Preenche o Dropdown de Unidades
    const selectUnidade = document.getElementById("unidade");

    if (selectUnidade) {
      selectUnidade.innerHTML =
        '<option value="" selected disabled>Selecione a unidade solicitante...</option>';

      if (dados.unidades) {
        const listaUnidades = dados.unidades.split(",");

        listaUnidades.forEach((unidade) => {
          const nomeLimpo = unidade.trim();
          if (nomeLimpo) {
            const option = document.createElement("option");
            option.value = nomeLimpo;
            option.innerText = nomeLimpo;
            selectUnidade.appendChild(option);
          }
        });
      } else {
        const option = document.createElement("option");
        option.value = "Não definida";
        option.innerText = "Nenhuma unidade cadastrada (Atualize seu Perfil)";
        selectUnidade.appendChild(option);
      }
    }
  } catch (error) {
    console.error("Erro ao carregar perfil:", error);
  }
}

// VERIFICAR PRAZO (REGRA DOS 15 DIAS)
function verificarPrazo() {
  const inputData = document.getElementById("dataInicio").value;
  const aviso = document.getElementById("avisoPrazo");

  if (!inputData) return;

  const dataEvento = new Date(inputData);
  const hoje = new Date();

  // Zera as horas para comparar apenas os dias
  hoje.setHours(0, 0, 0, 0);
  dataEvento.setHours(0, 0, 0, 0);

  // Calcula diferença em dias
  const diffTime = dataEvento - hoje;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  // Se for menor que 15 dias e não for data passada
  if (diffDays < 15 && diffDays >= 0) {
    if (aviso) aviso.style.display = "block";
  } else {
    if (aviso) aviso.style.display = "none";
  }
}

// ALTERNAR TEMA
function toggleTheme() {
  const html = document.documentElement;
  const currentTheme = html.getAttribute("data-theme");
  const newTheme = currentTheme === "dark" ? "light" : "dark";

  html.setAttribute("data-theme", newTheme);
  localStorage.setItem("theme", newTheme);

  const icon = document.getElementById("themeIcon");
  if (icon)
    icon.className =
      newTheme === "dark" ? "fa-solid fa-sun" : "fa-solid fa-moon";
}

// ENVIAR SOLICITAÇÃO (CORRIGIDA - INCLUI CAMPOS OBRIGATÓRIOS)
function toggleOutros() {
  const select = document.getElementById('tipoAfastamento');
  const divOutros = document.getElementById('divOutros');
  if (select.value === 'outros') {
      divOutros.style.display = 'block';
      document.getElementById('textoOutros').required = true;
  } else {
      divOutros.style.display = 'none';
      document.getElementById('textoOutros').required = false;
      document.getElementById('textoOutros').value = '';
  }
}
function toggleExterior() {
  const select = document.getElementById('estado');
  const divExt = document.getElementById('divExterior');
  if (select.value === 'EXTERIOR') {
      divExt.style.display = 'block';
      document.getElementById('paisExterior').required = true;
  } else {
      divExt.style.display = 'none';
      document.getElementById('paisExterior').required = false;
      document.getElementById('paisExterior').value = '';
  }
}

// --- FUNÇÃO DE ENVIAR---
async function enviarSolicitacao(event) {
event.preventDefault();

const btn = event.target.querySelector('button[type="submit"]') || event.target;
const txtOriginal = btn.innerHTML;
btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Enviando...';
btn.disabled = true;

const formData = new FormData();

// 1. DADOS BÁSICOS
const matricula = document.getElementById('campoMatricula').value;
const cargo = document.getElementById('campoCargo').value;

if (!usuarioLogado || !usuarioLogado.id) {
    alert("Sessão inválida. Faça login.");
    window.location.href = 'login.html';
    return;
}

formData.append('usuario', usuarioLogado.id);
formData.append('matricula', matricula);
formData.append('cargo', cargo);
formData.append('nome_evento', document.getElementById('nomeEvento').value);
formData.append('data_inicio', document.getElementById('dataInicio').value);
formData.append('data_fim', document.getElementById('dataFim').value);

// 2. LÓGICA DO TIPO DE AFASTAMENTO
// O banco espera True/False para cada tipo. O form dá uma escolha única.
const tipoSelecionado = document.getElementById('tipoAfastamento').value;

// Reseta todos para False primeiro (opcional, mas seguro)
formData.append('tipo_convite', 'False');
formData.append('tipo_programacao', 'False');
formData.append('tipo_convocacao', 'False');
formData.append('tipo_outros', 'False');

// Ativa apenas o escolhido
if (tipoSelecionado === 'convite') formData.set('tipo_convite', 'True');
if (tipoSelecionado === 'programacao') formData.set('tipo_programacao', 'True');
if (tipoSelecionado === 'convocacao') formData.set('tipo_convocacao', 'True');

// Se for Outros, ativa a flag E adiciona o texto ao objetivo (para não perder a informação)
let objetivoTexto = document.getElementById('objetivo').value;
if (tipoSelecionado === 'outros') {
    formData.set('tipo_outros', 'True');
    const especificacao = document.getElementById('textoOutros').value;
    objetivoTexto = `[TIPO: ${especificacao}] \n` + objetivoTexto;
}
formData.append('objetivo', objetivoTexto);

// 3. LÓGICA DE CIDADE / ESTADO / EXTERIOR
const estadoSelecionado = document.getElementById('estado').value;
if (estadoSelecionado === 'EXTERIOR') {
    // Se for exterior, salva o País como Estado e a Cidade digitada
    const pais = document.getElementById('paisExterior').value;
    const cidade = document.getElementById('cidade').value;
    formData.append('estado', 'Exterior'); 
    formData.append('cidade', `${cidade} (${pais})`);
} else {
    formData.append('estado', estadoSelecionado);
    formData.append('cidade', document.getElementById('cidade').value);
}

// 4. UNIDADE
const unidadeEl = document.getElementById('unidade');
formData.append('unidade', (unidadeEl && unidadeEl.value) ? unidadeEl.value : "Não definida");

// 5. ANEXO
const inputArquivo = document.getElementById('anexoArquivo');
if (inputArquivo && inputArquivo.files.length > 0) {
    formData.append('anexo', inputArquivo.files[0]);
}

// ENVIO
try {
    const response = await fetch(`${API_URL}solicitacoes/`, {
        method: 'POST',
        headers: { 'Authorization': `Token ${usuarioLogado.token}` },
        body: formData 
    });

    if (response.ok) {
        alert("✅ Solicitação enviada com sucesso!");
        document.getElementById('formDispensa').reset(); 
        window.location.href = "dashboard.html";
    } else {
        const data = await response.json();
        alert("Erro ao enviar: " + JSON.stringify(data));
    }
} catch (error) {
    console.error(error);
    alert("Erro de conexão.");
} finally {
    btn.innerHTML = txtOriginal;
    btn.disabled = false;
}
}