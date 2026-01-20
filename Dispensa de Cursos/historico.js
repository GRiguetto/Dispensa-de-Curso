
const API_URL = "http://127.0.0.1:8000/api/";
let todosPedidos = [];
let usuarioLogado = null;

// --- 1. INICIALIZAÇÃO ---
document.addEventListener("DOMContentLoaded", () => {
    // A. Tema
    const savedTheme = localStorage.getItem("theme") || "light";
    document.documentElement.setAttribute("data-theme", savedTheme);
    const icon = document.getElementById("themeIcon");
    if (icon) icon.className = savedTheme === "dark" ? "fa-solid fa-sun" : "fa-solid fa-moon";

    // B. Login Check
    const usuarioSalvo = localStorage.getItem("usuarioLogado");
    if (!usuarioSalvo) {
        window.location.href = "login.html";
        return;
    }
    usuarioLogado = JSON.parse(usuarioSalvo);

    // C. Header
    if(document.getElementById("headerNome")) {
        document.getElementById("headerNome").innerText = usuarioLogado.nome;
    }

    // D. Carregar Dados
    carregarHistorico();
});

// --- 2. FUNÇÕES GERAIS ---
function toggleTheme() {
    const html = document.documentElement;
    const newTheme = html.getAttribute("data-theme") === "dark" ? "light" : "dark";
    html.setAttribute("data-theme", newTheme);
    localStorage.setItem("theme", newTheme);
    
    const icon = document.getElementById("themeIcon");
    if(icon) icon.className = newTheme === "dark" ? "fa-solid fa-sun" : "fa-solid fa-moon";
}
function fazerLogout() {
    localStorage.removeItem('usuarioLogado');
    window.location.href = 'index.html';
}

// Helper para formatar data (yyyy-mm-dd -> dd/mm/yyyy)
function formatarData(dataString) {
    if (!dataString) return "---";
    try {
        // Se vier com hora (ISO), corta a hora
        if(dataString.includes('T')) dataString = dataString.split('T')[0];
        // Divide e inverte
        return dataString.split('-').reverse().join('/');
    } catch (e) {
        return dataString;
    }
}

// --- 3. CARREGAR DADOS ---
async function carregarHistorico() {
    const tbody = document.getElementById("tabelaHistorico");
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center"><i class="fa-solid fa-spinner fa-spin"></i> Carregando...</td></tr>';

    try {
        const response = await fetch(`${API_URL}solicitacoes/`, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Token ${usuarioLogado.token}`
            },
        });

        if (!response.ok) {
            if (response.status === 401) {
                fazerLogout();
                return;
            }
            throw new Error("Erro de conexão");
        }

        todosPedidos = await response.json();
        aplicarFiltros(); // Renderiza a tabela inicial

    } catch (error) {
        console.error(error);
        tbody.innerHTML = '<tr><td colspan="6" style="color:var(--danger-color); text-align:center">Erro ao carregar dados.</td></tr>';
    }
}

// --- 4. FILTROS E RENDERIZAÇÃO ---
function aplicarFiltros() {
    const texto = document.getElementById("buscaTexto").value.toLowerCase();
    const statusFiltro = document.getElementById("buscaStatus").value;
    const ordem = document.getElementById("ordenacao").value;

    // Filtra
    let listaFiltrada = todosPedidos.filter((pedido) => {
        const nomeUser = pedido.usuario_dados?.first_name?.toLowerCase() || "";
        const matricula = pedido.matricula?.toLowerCase() || "";
        const matchTexto = nomeUser.includes(texto) || matricula.includes(texto);

        let matchStatus = true;
        if (statusFiltro) {
            if (statusFiltro === "PENDENTE") matchStatus = pedido.status.includes("PENDENTE");
            else matchStatus = pedido.status === statusFiltro;
        }

        return matchTexto && matchStatus;
    });

    // Ordena
    listaFiltrada.sort((a, b) => {
        const idA = a.id;
        const idB = b.id;
        return ordem === "recente" ? idB - idA : idA - idB;
    });

    renderizarTabela(listaFiltrada);
}
function renderizarTabela(lista) {
    const tbody = document.getElementById("tabelaHistorico");
    const msgVazio = document.getElementById("msgVazio");
    tbody.innerHTML = "";

    if (lista.length === 0) {
        msgVazio.style.display = "block";
        return;
    }
    msgVazio.style.display = "none";

    lista.forEach((pedido) => {
        // Dados para a linha
        const dataFmt = formatarData(pedido.data_inicio); // Usa nossa função segura
        const nomeUser = pedido.usuario_dados?.first_name || "Servidor";
        const matricula = pedido.matricula || "";
        const evento = pedido.nome_evento || pedido.evento || "---";
        const unidade = pedido.unidade || "---";

        // Badges e Textos
        let badgeClass = "secondary";
        let statusTexto = pedido.status;

        if (pedido.status === "PENDENTE_GERENTE") {
            badgeClass = "warning"; statusTexto = "Gerência";
        } else if (pedido.status === "PENDENTE_COORD") {
            badgeClass = "info"; statusTexto = "Coordenação";
        } else if (pedido.status === "PENDENTE_ADMIN") {
            badgeClass = "primary"; statusTexto = "Secretaria";
        } else if (pedido.status === "APROVADO") {
            badgeClass = "success"; statusTexto = "Concluído";
        } else if (pedido.status === "INDEFERIDO") {
            badgeClass = "danger"; statusTexto = "Indeferido";
        }

        // Botão PDF (Aparece apenas se APROVADO)
        let btnPDF = "";
        if (pedido.status === "APROVADO") {
            btnPDF = `<button class="btn-action" onclick="gerarPDF(${pedido.id})" title="Baixar PDF"><i class="fa-solid fa-file-pdf"></i></button>`;
        } else {
            btnPDF = `<span style="color:var(--text-secondary); font-size:0.8rem">-</span>`;
        }

        const row = `
            <tr>
                <td>${dataFmt}</td>
                <td><strong>${nomeUser}</strong><br><small>${matricula}</small></td>
                <td>${evento}</td>
                <td>${unidade}</td>
                <td><span class="badge badge-${badgeClass}">${statusTexto}</span></td>
                <td style="text-align: right;">${btnPDF}</td>
            </tr>
        `;
        tbody.innerHTML += row;
    });
}

// --- 5. GERADOR DE PDF ---
async function gerarPDF(id) {
    const btn = event.target.closest("button");
    const textoOriginal = btn ? btn.innerHTML : "Baixar";

    if (btn) {
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
        btn.disabled = true;
    }

    try {
        const response = await fetch(`${API_URL}solicitacoes/${id}/`, {
            headers: { Authorization: `Token ${usuarioLogado.token}` },
        });
        const pedido = await response.json();

        // Helpers
        const setTxt = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.innerText = val;
        };
        const fmt = (s) => formatarData(s);

        // Preenchimento
        let nomeServidor = pedido.usuario_dados?.first_name || (usuarioLogado.id === pedido.usuario ? usuarioLogado.nome : "---");

        setTxt("pdfNome", nomeServidor);
        setTxt("pdfMatricula", pedido.matricula || "---");
        setTxt("pdfUnidade", pedido.unidade || "---");
        setTxt("pdfEvento", pedido.nome_evento || pedido.evento || "---");
        setTxt("pdfLocal", `${pedido.cidade || ""} - ${pedido.estado || ""}`);
        setTxt("pdfObjetivo", pedido.objetivo || "---");
        setTxt("pdfDataInicio", fmt(pedido.data_inicio));
        setTxt("pdfDataFim", fmt(pedido.data_fim));

        // Checkboxes
        ["checkConvite", "checkProgramacao", "checkConvocacao", "checkOutros"].forEach((id) => {
            setTxt(id, `( ) ${id.replace("check", "")}`);
        });
        if (pedido.tipo_convite) setTxt("checkConvite", "(X) Convite");
        if (pedido.tipo_programacao) setTxt("checkProgramacao", "(X) Programação");
        if (pedido.tipo_convocacao) setTxt("checkConvocacao", "(X) Convocação");
        if (pedido.tipo_outros) setTxt("checkOutros", "(X) Outros");

        // Assinaturas
        const assinar = (idNome, idStatus, assinaturaBanco, statusPedido, fasesAprovadas) => {
            const el = document.getElementById(idNome) || document.getElementById(idStatus);
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
            } else if (statusPedido.includes("PENDENTE") && !fasesAprovadas.includes(statusPedido)) {
                 if(idNome.includes("Coord") && statusPedido === "PENDENTE_COORD") {
                     el.innerText = "EM ANÁLISE"; el.style.color = "orange";
                 } else if(idNome.includes("Admin") && statusPedido === "PENDENTE_ADMIN") {
                     el.innerText = "EM ANÁLISE"; el.style.color = "orange";
                 } else {
                     el.innerText = "";
                 }
            } else {
                el.innerText = "";
            }
        };

        setTxt("signServidor", nomeServidor);
        setTxt("signData", `Data: ${new Date().toLocaleDateString("pt-BR")}`);

        assinar("signGerente", "signGerenteStatus", pedido.assinatura_gerente, pedido.status, ["PENDENTE_COORD", "PENDENTE_ADMIN", "APROVADO"]);
        assinar("signCoord", "signCoordStatus", pedido.assinatura_coordenador, pedido.status, ["PENDENTE_ADMIN", "APROVADO"]);
        assinar("signAdmin", "signAdminStatus", pedido.assinatura_admin, pedido.status, ["APROVADO"]);

        // Data Rodapé
        const agora = new Date();
        const dataHora = `${agora.toLocaleDateString("pt-BR")} às ${agora.toLocaleTimeString("pt-BR", {hour: "2-digit", minute: "2-digit"})}`;
        if(document.getElementById("dataImpressao")) document.getElementById("dataImpressao").innerText = dataHora;

        // Gerar
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