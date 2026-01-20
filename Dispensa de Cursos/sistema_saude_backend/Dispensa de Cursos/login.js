const API_URL = "https://NOME-DO-SEU-APP-NO-RENDER.onrender.com/api/";

function alternarFormulario(tipo) {
  const formLogin = document.getElementById("formLogin");
  const formCadastro = document.getElementById("formCadastro");
  const titulo = document.getElementById("tituloPagina");

  if (tipo === "cadastro") {
    formLogin.classList.remove("form-active");
    formLogin.classList.add("form-toggle");

    formCadastro.classList.remove("form-toggle");
    formCadastro.classList.add("form-active");

    titulo.innerText = "Criar Nova Conta";
  } else {
    formCadastro.classList.remove("form-active");
    formCadastro.classList.add("form-toggle");

    formLogin.classList.remove("form-toggle");
    formLogin.classList.add("form-active");

    titulo.innerText = "Acesse sua conta";
  }
}

async function fazerLogin(event) {
  event.preventDefault();

  const matricula = document.getElementById("matricula").value;
  const senha = document.getElementById("password").value;
  const btn = document.querySelector("#formLogin button");

  // Pequena validação no front também
  if (isNaN(matricula) && matricula.toLowerCase() !== "admin") {
    alert("A matrícula deve conter apenas números.");
    return;
  }

  const textoOriginal = btn.innerHTML;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Entrando...';
  btn.disabled = true;

  try {
    const response = await fetch(`${API_URL}login/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: matricula, password: senha }),
    });

    const data = await response.json();

    if (response.ok) {
      localStorage.setItem("usuarioLogado", JSON.stringify(data.usuario));
      window.location.href = "dashboard.html";
    } else {
      alert(data.erro || "Falha no login.");
    }
  } catch (error) {
    alert("Erro de conexão com o servidor.");
    console.error(error);
  } finally {
    btn.innerHTML = textoOriginal;
    btn.disabled = false;
  }
}

async function fazerCadastro(event) {
  event.preventDefault();

  const nome = document.getElementById("cadNome").value;
  const email = document.getElementById("cadEmail").value;
  const matricula = document.getElementById("cadMatricula").value;
  const senha = document.getElementById("cadSenha").value;
  const confirma = document.getElementById("cadSenhaConfirma").value;

  const btn = document.querySelector("#formCadastro button");

  // Validações de Front-end
  if (senha !== confirma) {
    alert("As senhas não coincidem!");
    document.getElementById("cadSenhaConfirma").focus();
    return;
  }

  if (senha.length < 6) {
    alert("A senha deve ter pelo menos 6 caracteres.");
    return;
  }

  const textoOriginal = btn.innerHTML;
  btn.innerHTML =
    '<i class="fa-solid fa-spinner fa-spin"></i> Criando conta...';
  btn.disabled = true;

  try {
    const response = await fetch(`${API_URL}register/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        first_name: nome,
        email: email,
        username: matricula,
        password: senha,
      }),
    });

    const data = await response.json();

    if (response.ok) {
      alert("Cadastro realizado com sucesso! Você será redirecionado.");
      // Já salva o login e entra direto
      localStorage.setItem("usuarioLogado", JSON.stringify(data.usuario));
      window.location.href = "dashboard.html";
    } else {
      // Mostra o erro que veio do Python (ex: "Matrícula já existe")
      alert(data.erro || "Erro ao criar conta.");
    }
  } catch (error) {
    alert("Erro de conexão ao tentar cadastrar.");
    console.error(error);
  } finally {
    btn.innerHTML = textoOriginal;
    btn.disabled = false;
  }
}

//Mostrar senha
function toggleSenha() {
  const input = document.getElementById('password');
  const icon = document.getElementById('btnVerSenha');

  if (input.type === "password") {
      input.type = "text";
      icon.classList.remove('fa-eye');
      icon.classList.add('fa-eye-slash'); // Troca para olho cortado
  } else {
      input.type = "password";
      icon.classList.remove('fa-eye-slash');
      icon.classList.add('fa-eye'); // Volta para olho normal
  }
}

async function confirmarTroca() {
  const token = document.getElementById("recupToken").value;
  const novaSenha = document.getElementById("recupNovaSenha").value;
  const confirmarSenha = document.getElementById("recupConfirmarSenha").value;
  const btn = event.target;

  if (!token || !novaSenha || !confirmarSenha) return alert("Preencha todos os campos.");

  if (novaSenha !== confirmarSenha) return alert("As senhas não conferem.");

  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Alterando...';
  btn.disabled = true;

  try {
    const response = await fetch(
      `${API_BASE}recuperar-senha/confirmar/`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uid: uidUsuario,
          token: token,
          new_password: novaSenha,
        }),
      }
    );
    const data = await response.json();

    if (response.ok) {
      alert("✅ Sucesso! " + data.mensagem);
      window.location.reload(); // Recarrega a página IMEDIATAMENTE
      return; // Impede que qualquer código abaixo execute
    } else {
      alert("❌ Erro: " + data.erro);
    }
  } catch (e) {
    console.error(e);
    // Só mostra erro genérico se não foi sucesso
    alert("Erro técnico ao alterar senha.");
  } finally {
    // Só reabilita o botão se a página não estiver recarregando
    if (!btn.disabled) { 
       btn.innerHTML = "Alterar Senha";
       btn.disabled = false;
    }
  }
}

