const API_URL = "http://127.0.0.1:8000/api/";
let usuarioLogado = null;

//INICIALIZAÇÃO---
document.addEventListener("DOMContentLoaded", () => {
  // A. Tema
  try {
    const savedTheme = localStorage.getItem("theme") || "light";
    document.documentElement.setAttribute("data-theme", savedTheme);
    const icon = document.getElementById("themeIcon");
    if (icon)
      icon.className =
        savedTheme === "dark" ? "fa-solid fa-sun" : "fa-solid fa-moon";
  } catch (e) {}

  // B. Login Check
  const usuarioSalvo = localStorage.getItem("usuarioLogado");
  if (!usuarioSalvo) {
    window.location.href = "login.html";
    return;
  }
  usuarioLogado = JSON.parse(usuarioSalvo);

  // C. Header (Preenche Nome)
  if (document.getElementById("headerNome")) {
    document.getElementById("headerNome").innerText = usuarioLogado.nome;
  }

  // D. Carregar Dados
  carregarSolicitacoes();
});

//FUNÇÕES GERAIS
function toggleTheme() {
  const html = document.documentElement;
  const newTheme =
    html.getAttribute("data-theme") === "dark" ? "light" : "dark";
  html.setAttribute("data-theme", newTheme);
  localStorage.setItem("theme", newTheme);
  const icon = document.getElementById("themeIcon");
  if (icon)
    icon.className =
      newTheme === "dark" ? "fa-solid fa-sun" : "fa-solid fa-moon";
}

function fazerLogout() {
  localStorage.removeItem("usuarioLogado");
  window.location.href = "index.html";
}

async function carregarSolicitacoes() {
  try {
    const response = await fetch(`${API_URL}solicitacoes/`, {
      headers: { Authorization: `Token ${usuarioLogado.token}` },
    });

    if (response.ok) {
      const lista = await response.json();
      renderizarLista(lista);
      atualizarStats(lista);
    } else {
      document.getElementById("listaSolicitacoes").innerHTML =
        '<p style="text-align:center; padding:20px; color:red">Erro ao carregar dados.</p>';
    }
  } catch (error) {
    console.error("Erro de conexão:", error);
    document.getElementById("listaSolicitacoes").innerHTML =
      '<p style="text-align:center; padding:20px; color:red">Erro de conexão com o servidor.</p>';
  }
}

function atualizarStats(lista) {
  // IDs do seu HTML: countAnalise, countAprovados, countCancelados
  const analiseEl = document.getElementById("countAnalise");
  const aprovadosEl = document.getElementById("countAprovados");
  const canceladosEl = document.getElementById("countCancelados");

  if (analiseEl && aprovadosEl && canceladosEl) {
    const pendentes = lista.filter((i) => i.status.includes("PENDENTE")).length;
    const aprovados = lista.filter((i) => i.status === "APROVADO").length;
    const cancelados = lista.filter((i) => i.status === "INDEFERIDO").length;

    analiseEl.innerText = pendentes;
    aprovadosEl.innerText = aprovados;
    canceladosEl.innerText = cancelados;
  }
}

function renderizarLista(lista) {
  const container = document.getElementById("listaSolicitacoes"); // Seu ID correto
  if (!container) return;

  container.innerHTML = ""; // Limpa o "Carregando..."

  if (lista.length === 0) {
    container.innerHTML =
      '<p style="text-align:center; padding:20px; color:gray">Nenhuma solicitação encontrada.</p>';
    return;
  }

  lista.forEach((pedido) => {
    // Formatar Data
    let dataF = pedido.data_inicio;
    try {
      dataF = new Date(pedido.data_inicio).toLocaleDateString("pt-BR");
    } catch (e) {}

    // Ícones e Cores
    let statusClass = "";
    let statusTexto = pedido.status;
    let iconClass = "fa-file-lines";

    if (pedido.status.includes("PENDENTE")) {
      statusClass = "status-pending"; // Precisa ter no CSS ou ficará padrão
      statusTexto = "Em Análise";
      iconClass = "fa-clock";
    } else if (pedido.status === "APROVADO") {
      statusClass = "status-approved";
      statusTexto = "Aprovado";
      iconClass = "fa-check-circle";
    } else if (pedido.status === "INDEFERIDO") {
      statusClass = "status-rejected";
      statusTexto = "Indeferido";
      iconClass = "fa-xmark-circle";
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
      (role === "manager" && pedido.status === "PENDENTE_GERENTE") ||
      (role === "coordinator" && pedido.status === "PENDENTE_COORD") ||
      (role === "admin" && pedido.status === "PENDENTE_ADMIN")
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
    if (pedido.status === "APROVADO") {
      botoesAcao += `
           <button onclick="gerarPDF(${pedido.id})" class="btn-icon-small download" title="Baixar PDF Oficial">
               <i class="fa-solid fa-file-pdf"></i>
           </button>
       `;
    }

    // Cria o Card (Usando seu estilo de div)
    const item = document.createElement("div");
    item.className = "request-card"; // Se tiver essa classe no CSS
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
                        ${pedido.nome_evento || "Solicitação"}
                    </h4>
                    <small style="color:var(--text-secondary);">
                        ${dataF} • ${pedido.unidade || "Unidade"}
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

async function aprovarSolicitacao(id) {
  if (!confirm("Confirmar aprovação?")) return;
  callApi(id, "aprovar");
}

async function reprovarSolicitacao(id) {
  if (!confirm("Confirmar reprovação?")) return;
  callApi(id, "reprovar");
}

async function callApi(id, action) {
  try {
    const response = await fetch(`${API_URL}solicitacoes/${id}/${action}/`, {
      method: "POST",
      headers: {
        Authorization: `Token ${usuarioLogado.token}`,
        "Content-Type": "application/json",
      },
    });
    if (response.ok) {
      alert("Sucesso!");
      carregarSolicitacoes();
    } else {
      alert("Erro ao processar.");
    }
  } catch (e) {
    console.error(e);
  }
}

async function verDetalhes(id) {
  const modal = document.getElementById("modalDetalhes");
  const container = document.getElementById("detalhesPedido");

  // 1. Abre o modal e mostra Loading
  if (container) {
    container.innerHTML =
      '<div style="padding:40px; text-align:center;"><i class="fa-solid fa-spinner fa-spin fa-2x"></i><p>Carregando informações...</p></div>';

    modal.style.display = "flex";
    setTimeout(() => {
      modal.classList.add("active");
    }, 10);
  }

  try {
    const response = await fetch(`${API_URL}solicitacoes/${id}/`, {
      headers: { Authorization: `Token ${usuarioLogado.token}` },
    });
    const pedido = await response.json();

    // 2. Formatações
    const dataInicio = new Date(pedido.data_inicio).toLocaleDateString("pt-BR");
    const dataFim = new Date(pedido.data_fim).toLocaleDateString("pt-BR");

    // Lógica da Linha do Tempo
    let s1 = "", s2 = "", s3 = "";
    const st = pedido.status;

    if (st === "PENDENTE_GERENTE") { s1 = "active"; }
    else if (st === "PENDENTE_COORD") { s1 = "active"; s2 = "active"; }
    else if (st === "PENDENTE_ADMIN") { s1 = "active"; s2 = "active"; s3 = "active"; }
    else if (st === "APROVADO") { s1 = "active"; s2 = "active"; s3 = "active"; }

    // --- NOVO: LÓGICA DO ANEXO ---
    let htmlAnexo = "";
    if (pedido.anexo) {
        // Se tiver anexo, cria um botão bonito
        htmlAnexo = `
            <div class="info-item" style="margin-top: 20px; padding-top: 15px; border-top: 1px dashed var(--border-color);">
                <label style="margin-bottom:8px; display:block;">Comprovante / Anexo</label>
                <a href="${pedido.anexo}" target="_blank" style="
                    display: inline-flex;
                    align-items: center;
                    gap: 10px;
                    background-color: var(--bg-color);
                    color: var(--primary-color);
                    padding: 12px 20px;
                    border-radius: 8px;
                    text-decoration: none;
                    font-weight: 600;
                    border: 1px solid var(--border-color);
                    transition: all 0.2s;
                " onmouseover="this.style.borderColor='var(--primary-color)'" onmouseout="this.style.borderColor='var(--border-color)'">
                    <i class="fa-solid fa-paperclip"></i>
                    Visualizar Arquivo Anexado
                </a>
            </div>
        `;
    } else {
        htmlAnexo = `
            <div class="info-item" style="margin-top: 20px; padding-top: 15px; border-top: 1px dashed var(--border-color); opacity: 0.6;">
                <label>Comprovante / Anexo</label>
                <p><i class="fa-solid fa-ban"></i> Nenhum arquivo anexado</p>
            </div>
        `;
    }

    // 3. Monta o modal em HTML
    container.innerHTML = `
            <div class="modal-header-modern">
                <h3><i class="fa-regular fa-file-lines"></i> Solicitação #${pedido.id}</h3>
                <button onclick="fecharModalDetalhes()" class="btn-close-white" title="Fechar">
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
                        <p><strong>${pedido.nome_evento || "Não informado"}</strong></p>
                    </div>
                    <div class="info-item">
                        <label>Status Atual</label>
                        <p><span class="status-badge ${pedido.status === "APROVADO" ? "status-approved" : "status-pending"}">${pedido.status}</span></p>
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
                        <p><i class="fa-solid fa-hospital"></i> ${pedido.unidade || "..."}</p>
                    </div>
                     <div class="info-item">
                        <label>Local do Evento</label>
                        <p><i class="fa-solid fa-map-location-dot"></i> ${pedido.cidade || ""} - ${pedido.estado || ""}</p>
                    </div>
                </div>

                <div class="info-item">
                    <label style="margin-bottom:8px;">Objetivo / Justificativa</label>
                    <div class="info-block">
                        <p>${pedido.objetivo}</p>
                    </div>
                </div>

                ${htmlAnexo}

            </div>

            <div class="modal-footer">
                ${pedido.status === "APROVADO" ? 
                    `<button onclick="gerarPDF(${pedido.id})" class="btn-secondary" style="background:#fff; border:1px solid var(--border-color); color:var(--text-primary);">
                        <i class="fa-regular fa-file-pdf" style="color:red;"></i> Baixar PDF Oficial
                    </button>` 
                : ""}
                <button onclick="fecharModalDetalhes()" class="btn-primary">
                    Fechar
                </button>
            </div>
        `;
  } catch (erro) {
    console.error(erro);
    container.innerHTML = '<div style="padding:20px; text-align:center; color:red;">Erro ao carregar detalhes.</div>';
  }
}
function fecharModalDetalhes() {
  const modal = document.getElementById("modalDetalhes");

  // 1. Remove a opacidade (faz sumir suavemente)
  modal.classList.remove("active");

  // 2. Espera 300ms (tempo da transição CSS) para tirar da tela
  setTimeout(() => {
    modal.style.display = "none";
  }, 300);
}
// Fechar ao clicar fora (Serve para todos os modais)
window.onclick = function (event) {
  if (event.target.classList.contains("modal-overlay")) {
    // Fecha o modal clicado
    event.target.classList.remove("active");
    setTimeout(() => {
      event.target.style.display = "none";
    }, 300);
  }
};

async function gerarPDF(id) {
  const btn = event.target.closest("button");
  const textoOriginal = btn ? btn.innerHTML : "Baixar";

  if (btn) {
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> ...';
    btn.disabled = true;
  }

  try {
    const response = await fetch(`${API_URL}solicitacoes/${id}/`, {
      headers: { Authorization: `Token ${usuarioLogado.token}` },
    });
    const pedido = await response.json();

    // 1. DADOS BÁSICOS
    const setTxt = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.innerText = val;
    };

    let nomeServidor =
      pedido.usuario_dados?.first_name ||
      (usuarioLogado.id === pedido.usuario ? usuarioLogado.nome : "---");

    setTxt("pdfNome", nomeServidor);
    setTxt("pdfMatricula", pedido.matricula || "---");
    setTxt("pdfUnidade", pedido.unidade || "---");
    setTxt("pdfEvento", pedido.nome_evento || pedido.evento || "---");
    setTxt("pdfLocal", `${pedido.cidade || ""} - ${pedido.estado || ""}`);
    setTxt("pdfObjetivo", pedido.objetivo || "---");

    const fmt = (s) => (s ? s.split("-").reverse().join("/") : "---");
    setTxt("pdfDataInicio", fmt(pedido.data_inicio));
    setTxt("pdfDataFim", fmt(pedido.data_fim));

    [
      "checkConvite",
      "checkProgramacao",
      "checkConvocacao",
      "checkOutros",
    ].forEach((id) => {
      setTxt(id, `( ) ${id.replace("check", "")}`);
    });
    if (pedido.tipo_convite) setTxt("checkConvite", "(X) Convite");
    if (pedido.tipo_programacao) setTxt("checkProgramacao", "(X) Programação");
    if (pedido.tipo_convocacao) setTxt("checkConvocacao", "(X) Convocação");
    if (pedido.tipo_outros) setTxt("checkOutros", "(X) Outros");

    // 2. ASSINATURAS
    const assinar = (
      idNome,
      idStatus,
      assinaturaBanco,
      statusPedido,
      fasesAprovadas
    ) => {
      const el =
        document.getElementById(idNome) || document.getElementById(idStatus);
      if (!el) return;

      if (assinaturaBanco) {
        el.innerText = assinaturaBanco;
        el.style.color = "black";
        el.style.fontWeight = "bold";
        el.style.fontFamily = "Courier New";
      } else if (fasesAprovadas.includes(statusPedido)) {
        el.innerText = "APROVADO DIGITALMENTE";
        el.style.color = "green";
        el.style.fontWeight = "bold";
        el.style.fontFamily = "Arial";
      } else if (
        statusPedido.includes("PENDENTE") &&
        !fasesAprovadas.includes(statusPedido)
      ) {
        // Simplificado para status pendente
        if (idNome.includes("Coord") && statusPedido === "PENDENTE_COORD") {
          el.innerText = "EM ANÁLISE";
          el.style.color = "orange";
        } else if (
          idNome.includes("Admin") &&
          statusPedido === "PENDENTE_ADMIN"
        ) {
          el.innerText = "EM ANÁLISE";
          el.style.color = "orange";
        } else {
          el.innerText = "";
        }
      } else {
        el.innerText = "";
      }
    };

    setTxt("signServidor", nomeServidor);
    setTxt("signData", `Data: ${new Date().toLocaleDateString("pt-BR")}`);

    assinar(
      "signGerente",
      "signGerenteStatus",
      pedido.assinatura_gerente,
      pedido.status,
      ["PENDENTE_COORD", "PENDENTE_ADMIN", "APROVADO"]
    );
    assinar(
      "signCoord",
      "signCoordStatus",
      pedido.assinatura_coordenador,
      pedido.status,
      ["PENDENTE_ADMIN", "APROVADO"]
    );
    assinar(
      "signAdmin",
      "signAdminStatus",
      pedido.assinatura_admin,
      pedido.status,
      ["APROVADO"]
    );

    //DATA DE GERAÇÃO (RODAPÉ) - AQUI ESTÁ A CORREÇÃO
    const agora = new Date();
    const dataHoraFormatada = `${agora.toLocaleDateString(
      "pt-BR"
    )} às ${agora.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    })}`;

    // Procura o elemento e preenche
    const elRodape = document.getElementById("dataImpressao");
    if (elRodape) {
      elRodape.innerText = dataHoraFormatada;
    }

    // 3. GERAÇÃO
    const element = document.getElementById("modeloPDF");
    element.style.display = "block";

    const opt = {
      margin: 0,
      filename: `Dispensa_${id}.pdf`,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
    };

    await html2pdf().set(opt).from(element).save();
    element.style.display = "none";
  } catch (erro) {
    console.error(erro);
    alert("Erro ao gerar PDF.");
  } finally {
    if (btn) {
      btn.innerHTML = textoOriginal;
      btn.disabled = false;
    }
  }
}
