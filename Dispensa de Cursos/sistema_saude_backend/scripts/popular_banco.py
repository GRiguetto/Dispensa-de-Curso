import os
import sys
import django

# Configura o Django
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
django.setup()

from django.contrib.auth.models import User, Group
from dispensas.models import Departamento, Setor, UserProfile

# Contadores para gerar matrículas falsas organizadas
# 5000+ = Coordenadores
# 6000+ = Gerentes
MATRICULA_COORD = 5000
MATRICULA_GERENTE = 6000

def criar_usuario(nome_completo, tipo):
    """Cria usuário com matrícula numérica sequencial"""
    global MATRICULA_COORD, MATRICULA_GERENTE
    
    if tipo == "coord":
        MATRICULA_COORD += 1
        matricula = str(MATRICULA_COORD)
        cargo = "Coordenador"
    else:
        MATRICULA_GERENTE += 1
        matricula = str(MATRICULA_GERENTE)
        cargo = "Gerente"

    # Tenta pegar ou criar (caso rode o script 2x)
    user, created = User.objects.get_or_create(username=matricula)
    
    if created:
        user.first_name = nome_completo
        user.set_password("Saude@123") # Senha padrão
        user.save()
        
        # Cria o Perfil Extra com o Cargo
        UserProfile.objects.create(user=user, cargo=cargo, unidade="Administrativo")
        
        print(f"   👤 Usuário criado: {nome_completo} -> Matrícula: {matricula}")
    else:
        print(f"   ℹ️ Usuário já existe: {nome_completo} ({matricula})")
        
    return user

def run():
    print("--- 🚀 INICIANDO POPULAÇÃO (CORRIGIDO: MATRÍCULAS NUMÉRICAS) ---")

    # DADOS DA HIERARQUIA
    dados = {
        "Departamento de Atenção Básica": ["Alessandra Garcia", [
            ("UBS São Deocleciano", "Viviani Cristina Lino"),
            ("UBS Central", "Giseli Mara Pires"),
            ("UBS Santo Antonio", "Daniela Ferreira Lima"),
            ("UBS Caic / Cristo Rei", "Renata Cristina Padin"),
            ("UBS Maria Lucia", "Simone da Silveira"),
            ("UBS Estoril", "Maria Raquel More"),
            ("UBS Vila Toninho", "Laryssa Silva Lui"),
            ("UBS Eldorado", "Fabiana Maria Martins"),
            ("UBS Vetorazzo", "Gerente Vetorazzo"),
            ("UBS Solo Sagrado", "Gerente Solo"),
        ]],
        "Departamento de Urgência e Emergência": ["Coordenador Urgencia", [
            ("UPA Norte", "Gerente UPA Norte"),
            ("UPA Sul", "Gerente UPA Sul"),
            ("UPA Jaguaré", "Gerente UPA Jaguare"),
            ("UPA Tangará", "Gerente UPA Tangara"),
            ("SAMU", "Gerente SAMU"),
        ]],
        "Departamento de Vigilância em Saúde": ["Coordenador Vigilancia", [
            ("Vigilância Sanitária", "Gerente VISA"),
            ("Vigilância Epidemiológica", "Gerente Epidemiologica"),
            ("Vigilância Ambiental", "Gerente Ambiental"),
        ]],
        "Departamento de Assistência Farmacêutica": ["Maria Silvia Araujo", [
            ("Almoxarifado Central", "Gerente Almoxarifado"),
            ("Farmácia Municipal", "Gerente Farmacia"),
        ]],
        "Departamento de Gestão de Pessoas": ["Joao Paulo Goncalves", [
            ("Recursos Humanos", "Gerente RH"),
            ("SESMT", "Gerente SESMT"),
        ]]
    }

    grupo_gerentes, _ = Group.objects.get_or_create(name='Gerentes')
    grupo_coordenadores, _ = Group.objects.get_or_create(name='Coordenadores')

    for nome_dep, info in dados.items():
        nome_coord = info[0]
        lista_setores = info[1]

        # 1. Cria Coordenador (Matrícula 5001, 5002...)
        user_coord = criar_usuario(nome_coord, "coord")
        user_coord.groups.add(grupo_coordenadores)

        dep, _ = Departamento.objects.get_or_create(nome=nome_dep)
        dep.responsavel = user_coord
        dep.save()
        
        print(f"\n🏢 DEPARTAMENTO: {nome_dep}")
        print(f"   👑 Chefe: {user_coord.first_name} (Matrícula: {user_coord.username})")

        # 2. Cria Gerentes (Matrícula 6001, 6002...)
        for nome_setor, nome_gerente in lista_setores:
            user_gerente = criar_usuario(nome_gerente, "gerente")
            user_gerente.groups.add(grupo_gerentes)

            setor, _ = Setor.objects.get_or_create(nome=nome_setor, departamento=dep)
            setor.responsavel = user_gerente
            setor.save()
            print(f"      └─ 🏥 {nome_setor} -> Gerente: {user_gerente.username}")

    print("\n--- ✅ TUDO PRONTO! USE AS MATRÍCULAS ACIMA PARA LOGAR ---")

if __name__ == "__main__":
    run()