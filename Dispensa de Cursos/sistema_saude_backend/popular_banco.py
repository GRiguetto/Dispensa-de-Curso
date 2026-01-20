import os
from django.contrib.auth.models import User, Group
from dispensas.models import UserProfile, Departamento, Setor

# ==============================================================================
# SCRIPT DE POPULAÇÃO MANUAL (SEM ARQUIVO CSV)
# ==============================================================================

SENHA_PADRAO = '123456'
MATRICULA_ADMIN = 1
MATRICULA_COORD = 100
MATRICULA_GERENTE = 1000

# 1. Limpeza Inicial (Opcional, se quiser garantir zero duplicidade suja)
print("="*50)
print("INICIANDO CADASTRO MANUAL DOS USUÁRIOS")
print("="*50)

# Cria os grupos obrigatórios
grupo_coord, _ = Group.objects.get_or_create(name="Coordenadores")
grupo_gerente, _ = Group.objects.get_or_create(name="Gerentes")

# Cache para vincular gerentes aos departamentos certos
deptos_cache = {}

# --- FUNÇÃO DE CRIAÇÃO ---
def criar_usuario(nome, cargo, unidade, papel, depto_pai_nome=None):
    global MATRICULA_ADMIN, MATRICULA_COORD, MATRICULA_GERENTE
    
    # 1. Define Matrícula
    if papel == 'ADMIN':
        matricula = str(MATRICULA_ADMIN)
        MATRICULA_ADMIN += 1
    elif papel == 'COORDENADOR':
        matricula = str(MATRICULA_COORD)
        MATRICULA_COORD += 1
    else:
        matricula = str(MATRICULA_GERENTE)
        MATRICULA_GERENTE += 1

    # 2. Cria Usuário Django (Evita duplicar se já existir)
    username = matricula
    if User.objects.filter(username=username).exists():
        user = User.objects.get(username=username)
        print(f"♻️  JÁ EXISTE: {nome} ({username})")
    else:
        user = User.objects.create_user(username=username, password=SENHA_PADRAO)
        user.first_name = nome[:30] # Corta nome muito longo
        if papel == 'ADMIN':
            user.is_superuser = True
            user.is_staff = True
        print(f"✅ CRIADO: {nome} ({username}) - {papel}")
    
    user.save()

    # 3. Adiciona ao Grupo
    if papel == 'COORDENADOR':
        grupo_coord.user_set.add(user)
    elif papel == 'GERENTE':
        grupo_gerente.user_set.add(user)

    # 4. Cria Perfil
    profile, _ = UserProfile.objects.get_or_create(user=user)
    profile.cargo = cargo
    profile.unidade = unidade
    profile.save()

    # 5. Cria Estrutura (Departamento/Setor)
    if papel == 'COORDENADOR':
        # Coordenador cria o Departamento
        # Usamos o 'unidade' como nome do departamento se for o principal
        nome_depto = depto_pai_nome if depto_pai_nome else unidade
        
        # Verifica se o departamento já existe (para casos de 2 coordenadores)
        if nome_depto in deptos_cache:
            depto = deptos_cache[nome_depto]
            # Cria um setor especial para esse segundo coordenador
            Setor.objects.get_or_create(nome=unidade, departamento=depto, defaults={'responsavel': user})
        else:
            depto = Departamento.objects.create(nome=nome_depto, responsavel=user)
            deptos_cache[nome_depto] = depto
            
    elif papel == 'GERENTE':
        # Gerente é vinculado a um Departamento Pai
        if depto_pai_nome in deptos_cache:
            depto = deptos_cache[depto_pai_nome]
            Setor.objects.update_or_create(
                nome=unidade,
                departamento=depto,
                defaults={'responsavel': user}
            )
        else:
            print(f"⚠️  ERRO: Departamento '{depto_pai_nome}' não encontrado para {nome}")

# ==============================================================================
# DADOS DUROS (HARDCODED) DA SUA PLANILHA
# ==============================================================================

# 1. ADMIN
criar_usuario("JOAO PAULO GONCALVES DA SILVA", "SECRETARIO", "SECRETARIA DA SAUDE", "ADMIN")

# ------------------------------------------------------------------------------
# 2. ATENÇÃO BÁSICA
# ------------------------------------------------------------------------------
print("\n--- ATENÇÃO BÁSICA ---")
# Coordenadora
criar_usuario("ALESSANDRA GARCIA", "COORDENADORA", "Departamento de Atenção Básica", "COORDENADOR", "ATENCAO BASICA")

# Gerentes
gerentes_ab = [
    ("VIVIANI CRISTINA LINO BRANCINI", "São Deocleciano"),
    ("GISELI MARA PIRES BORELLI", "Central"),
    ("DANIELA FERREIRA LIMA", "Santo Antonio"),
    ("RENATA CRISTINA PADIN ANTONIO", "Caic / Cristo Rei"),
    ("SIMONE DA SILVEIRA VASCONCELOS BRAGA", "Maria Lucia"),
    ("MARIA RAQUEL MORE DE MATTOS", "Estoril"),
    ("LARYSSA SILVA LUI", "Vila Toninho"),
    ("FABIANA MARIA MARTINS", "Eldorado"),
    ("LUCIANA GARBELINI SOARES SIQUEIRA", "Vetorazzo"),
    ("GABRIELA APARECIDA DE OLIVEIRA CAMARGO", "Jaguare"),
    ("SORAIA FERNANDES DE CASTRO", "Solo Sagrado"),
    ("DANIELA CRISTINA DE OLIVEIRA", "Lealdade / Amizade"),
    ("FLAVIA MARIA VERONEZE PEREIRA", "Cidade Jardim"),
    ("CIBELE DE FATIMA DALOCA PEREIRA", "Engenheiro Schmitt"),
    ("ANA CLAUDIA FONTANA", "Talhado"),
    ("DAIANE CRISTINA DE SOUZA RAMOS", "Gonzaga de Campos"),
    ("SILVIA HELENA POLOTTO", "Rio Preto I"),
    ("VANESSA CRISTINA SILVA", "Anchieta"),
    ("REGINA CELIA DE OLIVEIRA", "Vila Elvira"),
    ("ROSELI FERNANDES MENDES", "Americano"),
    ("ELEN CRISTINA DE PAULA", "Parque Industrial"),
    ("PRISCILA HELENA BERTAZONI MENEZES", "Vila Mayor"),
    ("CIBELI CRISTINE BRAGA", "Gabriela"),
    ("KARINA ROCHA", "Santo Eduardo"),
    ("GISLEINE BIANCHI PIRES", "Renascer"),
    ("MARISTELA MARQUES", "Nova Esperanca"),
    ("LIGIA MARIA DE SOUZA", "Jardim Simoes"),
]
for nome, unidade in gerentes_ab:
    criar_usuario(nome, "GERENTE DE UNIDADE", unidade, "GERENTE", "ATENCAO BASICA")

# ------------------------------------------------------------------------------
# 3. URGÊNCIA
# ------------------------------------------------------------------------------
print("\n--- URGÊNCIA ---")
criar_usuario("MICHELE PEREIRA DA SILVA", "COORDENADORA", "Departamento de Urgencia e Emergencia", "COORDENADOR", "URGENCIA")

gerentes_urg = [
    ("MARIA AUGUSTA G. M. DE SOUZA", "UPA Norte"),
    ("RENATA ALVES M. DOS SANTOS", "UPA Tangara"),
    ("GERALDO ANTONIO DE OLIVEIRA", "UPA Jaguare"),
    ("SOLANGE DE FATIMA SANCHES", "UPA Vila Toninho"),
    ("GISLAINE MARA SPIGAROLI", "UPA Santo Antonio"),
]
for nome, unidade in gerentes_urg:
    criar_usuario(nome, "GERENTE DE UNIDADE", unidade, "GERENTE", "URGENCIA")

# ------------------------------------------------------------------------------
# 4. ESPECIALIZADA
# ------------------------------------------------------------------------------
print("\n--- ESPECIALIZADA ---")
criar_usuario("SIMONE CRISTINA MARQUES", "COORDENADORA", "Departamento de Atenção Especializada", "COORDENADOR", "ESPECIALIZADA")

gerentes_esp = [
    ("JULIANA APARECIDA M. DE FREITAS", "CSE Estoril"),
    ("NATALIA DA SILVA CUNHA", "CDI"),
    ("MARCIA REGINA LUIZ", "Melhor em Casa"),
    ("FABIANA PATRICIA DO NASCIMENTO", "SAE"),
    ("PATRICIA HELENA DE O. BIANCHI", "Centro de Saude do Idoso"),
    ("ANA PAULA DE O. DA SILVA", "Tisiologia / Hanseniase"),
    ("ELAINE CRISTINA DOS SANTOS", "Saude da Mulher"),
    ("ADRIANA CRISTINA B. VALENTIM", "CEO - Centro Especializado Odontologico"),
    ("PRISCILA THEVENARD DA SILVA", "Banco de Leite Humano"),
    ("RITA DE CASSIA A. P. C. TEIXEIRA", "CER II"),
    ("ADRIANA MAIRA DE PAULA", "EMAD"),
    ("MARIA HELENA DA SILVA", "Servico Social"),
    ("MIRIAN CRISTINA PEREIRA", "NGA"),
    ("CLAUDIA REGINA DE SOUZA", "CAAS"),
]
for nome, unidade in gerentes_esp:
    criar_usuario(nome, "GERENTE DE UNIDADE", unidade, "GERENTE", "ESPECIALIZADA")

# ------------------------------------------------------------------------------
# 5. VIGILÂNCIA EM SAÚDE
# ------------------------------------------------------------------------------
print("\n--- VIGILÂNCIA ---")
criar_usuario("PRISCILA THEVENARD DA SILVA", "COORDENADORA", "Departamento de Vigilancia em Saude", "COORDENADOR", "VIGILANCIA")

gerentes_vig = [
    ("ANDREIA NEGRI R. DOS SANTOS", "Vigilancia Epidemiologica"),
    ("KAROLINE BUENO DE CAMARGO", "Centro de Controle de Zoonoses"),
    ("MARIA CRISTINA V. C. DE OLIVEIRA", "Vigilancia Sanitaria"),
    ("DANIELLA C. M. DE OLIVEIRA", "Saude do Trabalhador"),
]
for nome, unidade in gerentes_vig:
    criar_usuario(nome, "GERENTE DE SETOR", unidade, "GERENTE", "VIGILANCIA")

# ------------------------------------------------------------------------------
# 6. SAÚDE MENTAL
# ------------------------------------------------------------------------------
print("\n--- SAÚDE MENTAL ---")
criar_usuario("FABIANA DE OLIVEIRA BEZERRA", "COORDENADORA", "Departamento de Saude Mental", "COORDENADOR", "SAUDE MENTAL")

gerentes_sm = [
    ("MURILO HENRIQUE B. DE SOUZA", "CAPS AD III"),
    ("SORAIA APARECIDA R. DE OLIVEIRA", "CAPS II Infanto Juvenil"),
    ("MARINA ALVES DE OLIVEIRA", "CAPS II Sul"),
    ("DANIELA C. F. DE OLIVEIRA", "CAPS II Norte"),
    ("ALINE CRISTINA DE SOUZA", "Residencias Terapeuticas"),
]
for nome, unidade in gerentes_sm:
    criar_usuario(nome, "GERENTE DE SETOR", unidade, "GERENTE", "SAUDE MENTAL")

# ------------------------------------------------------------------------------
# 7. ASSISTÊNCIA FARMACÊUTICA (Caso Especial: 2 Coordenadores)
# ------------------------------------------------------------------------------
print("\n--- ASSISTÊNCIA FARMACÊUTICA ---")
# Coord 1 (Principal)
criar_usuario("ANDREA CARNEIRO DE MENEZES NEVES", "COORDENADORA", "Departamento de Assistencia Farmaceutica", "COORDENADOR", "FARMACIA")
# Coord 2 (Vinculada ao mesmo grupo)
criar_usuario("MARIA SILVIA ARAUJO PEREIRA", "COORDENADORA", "Centro de Abastecimento Farmaceutico - CAF", "COORDENADOR", "FARMACIA")

# ------------------------------------------------------------------------------
# 8. OUTROS DEPARTAMENTOS (TI, JURÍDICO, FUNDO, MONITORAMENTO, OBRAS)
# ------------------------------------------------------------------------------
print("\n--- OUTROS DEPARTAMENTOS ---")

# Fundo Municipal
criar_usuario("PAULO CESAR DOS ANJOS GASQUES", "COORDENADOR", "Departamento Orçamentária e Financeira", "COORDENADOR", "FUNDO MUNICIPAL")

# Monitoramento (2 Coordenadores)
criar_usuario("VANESSA DA COSTA NASCIMENTO", "COORDENADORA", "Departamento de Monitoramento e Avaliação", "COORDENADOR", "MONITORAMENTO")
criar_usuario("PAULA ALVES MONTEIRO", "COORDENADORA", "Departamento de Custos", "COORDENADOR", "MONITORAMENTO")

# Tecnologia
criar_usuario("LEANDRO MUNHOZ DE BRITO", "COORDENADOR", "Departamento de Tecnologia e Informação", "COORDENADOR", "TI")

# Jurídico
criar_usuario("MATHEUS DA CRUZ COSTA", "COORDENADOR", "Departamento de Apoio Jurídico", "COORDENADOR", "JURIDICO")
gerentes_jur = [
    ("PATRICIA DE LUCAS RODRIGUES LIMA", "Departamento de Auditoria"),
    ("JESSICA LOPES PEREIRA MENDONCA", "Orienta SUS"),
]
for nome, unidade in gerentes_jur:
    criar_usuario(nome, "ASSISTENTE", unidade, "GERENTE", "JURIDICO")

# Obras
criar_usuario("ADRIANA DE CASSIA SANCHES", "COORDENADORA", "Departamento de Obras e Manutenção", "COORDENADOR", "OBRAS")


print("\n" + "="*50)
print("✅ CONCLUÍDO! TODOS OS USUÁRIOS FORAM CRIADOS.")
print("SENHA PARA TODOS: 123456")
print("="*50)