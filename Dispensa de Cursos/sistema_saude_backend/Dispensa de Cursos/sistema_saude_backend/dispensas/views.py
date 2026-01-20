import os
import io
import traceback
from django.conf import settings
from django.http import FileResponse, HttpResponse
from django.shortcuts import get_object_or_404
from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from django.db.models import Q
from django.contrib.auth.tokens import default_token_generator
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.utils.encoding import force_bytes, force_str
from django.core.mail import send_mail # Para o futuro
import random

# Framework REST
from rest_framework import viewsets, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.authtoken.models import Token
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated, AllowAny

# ReportLab (Gerador de PDF)
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.lib.utils import ImageReader

# Imports Locais
from .models import Solicitacao, UserProfile, Setor, Departamento
from .serializers import SolicitacaoSerializer


# ====================================================================
# 1. VIEWSET PRINCIPAL: SOLICITAÇÕES
# Responsável por Listar, Criar, Atualizar e Aprovar pedidos
# ====================================================================
class SolicitacaoViewSet(viewsets.ModelViewSet):
    serializer_class = SolicitacaoSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        """
        Filtra as solicitações baseado no cargo do usuário (Hierarquia).
        """
        user = self.request.user

        # 0. Se não estiver logado (proteção extra), retorna nada
        if user.is_anonymous:
            return Solicitacao.objects.none()

        # 1. ADMIN: Vê absolutamente tudo
        if user.is_superuser:
            return Solicitacao.objects.all().order_by("-id")

        # Filtro base: O usuário sempre vê seus próprios pedidos
        filtro_final = Q(usuario=user)

        # 2. GERENTE: Vê seus pedidos + pedidos dos setores que ele gerencia
        try:
            # Verifica se é gerente (pelo Grupo ou se é responsável por algum setor)
            if (
                user.groups.filter(name="Gerentes").exists()
                or Setor.objects.filter(responsavel=user).exists()
            ):
                setores_gerenciados = Setor.objects.filter(
                    responsavel=user
                ).values_list("nome", flat=True)
                # Adiciona ao filtro: Unidade do pedido está na lista de setores dele
                filtro_final = filtro_final | Q(unidade__in=setores_gerenciados)
        except Exception as e:
            print(f"Erro filtro Gerente: {e}")

        # 3. COORDENADOR: Vê seus pedidos + pedidos de todos os setores dos seus departamentos
        try:
            if (
                user.groups.filter(name="Coordenadores").exists()
                or Departamento.objects.filter(responsavel=user).exists()
            ):
                deptos_coordenados = Departamento.objects.filter(responsavel=user)
                # Pega todos os setores vinculados a esses departamentos
                setores_sob_jurisdicao = Setor.objects.filter(
                    departamento__in=deptos_coordenados
                ).values_list("nome", flat=True)
                filtro_final = filtro_final | Q(unidade__in=setores_sob_jurisdicao)
        except Exception as e:
            print(f"Erro filtro Coordenador: {e}")

        # Aplica o filtro acumulado e ordena pelo mais recente
        return Solicitacao.objects.filter(filtro_final).distinct().order_by("-id")

    def perform_create(self, serializer):
        """Ao criar, define o dono da solicitação como o usuário logado"""
        serializer.save(usuario=self.request.user)

    # --- AÇÕES DE APROVAÇÃO (Máquina de Estados) ---

    @action(detail=True, methods=["post"])
    def aprovar(self, request, pk=None):
        try:
            solicitacao = self.get_object()
            user = request.user
            status_atual = solicitacao.status

            # Lógica do Gerente
            if (
                user.groups.filter(name="Gerentes").exists()
                and status_atual == "PENDENTE_GERENTE"
            ):
                solicitacao.status = "PENDENTE_COORD"
                solicitacao.assinatura_gerente = user.first_name  # <--- FALTAVA ISSO
                solicitacao.save()
                return Response({"status": "Aprovado p/ Coordenação"})

            # Lógica do Coordenador
            if (
                user.groups.filter(name="Coordenadores").exists()
                and status_atual == "PENDENTE_COORD"
            ):
                solicitacao.status = "PENDENTE_ADMIN"
                solicitacao.assinatura_coordenador = (
                    user.first_name
                )  # <--- O ERRO ESTAVA AQUI (FALTAVA ESSA LINHA)
                solicitacao.save()
                return Response({"status": "Aprovado p/ Admin"})

            # Lógica do Admin
            if user.is_superuser:
                solicitacao.status = "APROVADO"
                # Só assina se ainda não tiver assinado (para não sobrescrever se for só ajuste)
                if not solicitacao.assinatura_admin:
                    solicitacao.assinatura_admin = user.first_name
                solicitacao.save()
                return Response({"status": "Processo Finalizado"})

            return Response(
                {"erro": "Ação não permitida ou status incorreto."}, status=403
            )
        except Exception as e:
            return Response({"erro": str(e)}, status=500)
        try:
            solicitacao = self.get_object()
            user = request.user
            status_atual = solicitacao.status

            # GARANTIA DE NOME: Se não tiver first_name, usa o username (matrícula)
            # Isso evita que a assinatura fique em branco no banco de dados
            nome_assinatura = user.first_name if user.first_name else user.username

            # Lógica do Gerente (Aprova PENDENTE_GERENTE -> PENDENTE_COORD)
            is_gerente = user.groups.filter(name="Gerentes").exists()
            if is_gerente and status_atual == "PENDENTE_GERENTE":
                solicitacao.status = "PENDENTE_COORD"
                solicitacao.assinatura_gerente = nome_assinatura
                solicitacao.save()
                return Response({"status": "Aprovado! Enviado para Coordenação."})

            # Lógica do Coordenador (Aprova PENDENTE_COORD -> PENDENTE_ADMIN)
            is_coord = user.groups.filter(name="Coordenadores").exists()
            if is_coord and status_atual == "PENDENTE_COORD":
                solicitacao.status = "PENDENTE_ADMIN"
                solicitacao.assinatura_coordenador = nome_assinatura
                solicitacao.save()
                return Response(
                    {"status": "Aprovado! Enviado para Secretaria de Saúde."}
                )

            # Lógica do Admin (Aprova PENDENTE_ADMIN -> APROVADO)
            if user.is_superuser:
                # Admin pode aprovar em qualquer fase se necessário
                solicitacao.status = "APROVADO"
                solicitacao.assinatura_admin = nome_assinatura
                solicitacao.save()
                return Response({"status": "Solicitação Finalizada e Aprovada."})

            return Response(
                {"erro": "Você não tem permissão para aprovar nesta fase."}, status=403
            )
        except Exception as e:
            return Response({"erro": str(e)}, status=500)

    @action(detail=True, methods=["post"])
    def reprovar(self, request, pk=None):
        """Cancela a solicitação em qualquer etapa"""
        solicitacao = self.get_object()
        user = request.user

        # Garante nome de quem cancelou
        nome_cancelou = user.first_name if user.first_name else user.username

        solicitacao.status = "INDEFERIDO"
        solicitacao.motivo_cancelamento = f"Reprovado por {nome_cancelou}"
        solicitacao.save()
        return Response({"status": "Solicitação Indeferida/Cancelada."})


# ====================================================================
# 2. SISTEMA DE AUTENTICAÇÃO (LOGIN / REGISTRO / SENHA)
# ====================================================================


class CustomLoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        username = request.data.get("username")
        password = request.data.get("password")

        # Tenta autenticar
        user = authenticate(username=username, password=password)

        if user is not None:
            token, _ = Token.objects.get_or_create(user=user)

            # Define o papel (Role) para o Frontend desenhar os botões certos
            role = "user"
            if user.is_superuser:
                role = "admin"
            elif user.groups.filter(name="Coordenadores").exists():
                role = "coordinator"
            elif user.groups.filter(name="Gerentes").exists():
                role = "manager"

            # Recupera dados do Perfil Estendido (Cargo/Unidade)
            cargo_real = "Servidor"
            unidade_real = ""
            try:
                # Tenta acessar profile ou userprofile (dependendo de como foi criado no models)
                if hasattr(user, "profile"):
                    cargo_real = user.profile.cargo
                    unidade_real = user.profile.unidade
                elif hasattr(user, "userprofile"):
                    cargo_real = user.userprofile.cargo
                    unidade_real = user.userprofile.unidade
            except Exception as e:
                print(f"Aviso Login: Perfil não encontrado: {e}")

            return Response(
                {
                    "mensagem": "Login realizado com sucesso",
                    "usuario": {
                        "id": user.id,
                        "token": token.key,
                        "nome": user.first_name if user.first_name else user.username,
                        "matricula": user.username,
                        "role": role,
                        "cargo": cargo_real,
                        "unidade": unidade_real,
                    },
                },
                status=status.HTTP_200_OK,
            )
        else:
            return Response(
                {"erro": "Matrícula ou senha incorretos."},
                status=status.HTTP_401_UNAUTHORIZED,
            )


class RegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        data = request.data

        # Validação básica
        if User.objects.filter(username=data.get("username")).exists():
            return Response(
                {"erro": "Esta matrícula já possui cadastro."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            # Cria o usuário base do Django
            user = User.objects.create_user(
                username=data.get("username"),
                password=data.get("password"),
                email=data.get("email", ""),
                first_name=data.get("first_name", ""),
            )

            # Cria o perfil estendido
            UserProfile.objects.create(
                user=user,
                cargo=data.get("cargo", "Servidor"),
                unidade=data.get("unidade", "Não definida"),
            )

            # Já gera o token para login automático
            token, _ = Token.objects.get_or_create(user=user)

            return Response(
                {
                    "mensagem": "Cadastro realizado!",
                    "usuario": {
                        "id": user.id,
                        "token": token.key,
                        "nome": user.first_name,
                        "matricula": user.username,
                        "role": "user",
                    },
                },
                status=status.HTTP_201_CREATED,
            )

        except Exception as e:
            return Response(
                {"erro": f"Erro interno ao cadastrar: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class ChangePasswordView(APIView):
    """View para o usuário trocar a própria senha (Gerente/Coord/Admin)"""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        data = request.data

        old_password = data.get("old_password")
        new_password = data.get("new_password")
        confirm_password = data.get("confirm_password")

        if not old_password or not new_password:
            return Response({"erro": "Preencha todos os campos."}, status=400)

        if new_password != confirm_password:
            return Response({"erro": "As novas senhas não conferem."}, status=400)

        # Valida senha antiga
        if not user.check_password(old_password):
            return Response({"erro": "A senha atual está incorreta."}, status=400)

        try:
            user.set_password(new_password)
            user.save()
            return Response({"mensagem": "Senha alterada com sucesso!"}, status=200)
        except Exception as e:
            return Response({"erro": str(e)}, status=500)


# ====================================================================
# 3. VIEWS AUXILIARES (PERFIL E LISTAS)
# ====================================================================


class UserProfileView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        # Tenta pegar ou criar o perfil para evitar erro 500
        try:
            profile = user.profile
        except:
            profile, _ = UserProfile.objects.get_or_create(user=user)

        return Response(
            {
                "nome": user.first_name,
                "email": user.email,
                "matricula": user.username,
                "cargo": profile.cargo,
                "unidades": profile.unidade,
            }
        )

    def patch(self, request):
        user = request.user
        data = request.data

        # Atualiza User
        if "nome" in data:
            user.first_name = data["nome"]
        if "email" in data:
            user.email = data["email"]
        user.save()

        # Atualiza Profile
        try:
            profile = user.profile
        except:
            profile, _ = UserProfile.objects.get_or_create(user=user)

        if "cargo" in data:
            profile.cargo = data["cargo"]
        if "unidades" in data:
            profile.unidade = data["unidades"]
        profile.save()

        return Response({"mensagem": "Perfil atualizado!"})


class SetorListView(APIView):
    """Retorna lista de setores para popular combobox no frontend"""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        setores = Setor.objects.all().order_by("nome").values_list("nome", flat=True)
        return Response(list(setores))


# ====================================================================
# 4. GERADOR DE PDF BLINDADO (COM BRASÃO E ASSINATURAS)
# ====================================================================


def gerar_pdf_solicitacao(request, pk):
    try:
        solicitacao = Solicitacao.objects.get(pk=pk)

        buffer = io.BytesIO()
        c = canvas.Canvas(buffer, pagesize=A4)
        width, height = A4

        # --- CABEÇALHO ---
        # (Código da imagem do brasão permanece o mesmo...)

        c.setFont("Helvetica-Bold", 12)
        c.drawCentredString(
            width / 2, height - 2 * cm, "PREFEITURA DE SÃO JOSÉ DO RIO PRETO"
        )
        c.setFont("Helvetica", 10)
        c.drawCentredString(
            width / 2, height - 2.5 * cm, "Secretaria Municipal de Saúde - SMS"
        )
        c.line(2 * cm, height - 2.8 * cm, 19 * cm, height - 2.8 * cm)

        c.setFont("Helvetica-Bold", 14)
        c.drawCentredString(width / 2, height - 4 * cm, "REQUERIMENTO DE DISPENSA")

        # Protocolo (Correção do Erro 4)
        c.setFont("Helvetica", 10)
        c.drawRightString(
            19 * cm, height - 4.5 * cm, f"Protocolo SIGM: {solicitacao.id}"
        )

        # --- DADOS DO SERVIDOR ---
        y = height - 6 * cm

        # Recupera dados com segurança (Correção do Erro 1 e 2)
        nome_user = (
            solicitacao.usuario.first_name
            if solicitacao.usuario.first_name
            else solicitacao.usuario.username
        )

        try:
            profile = solicitacao.usuario.profile
            cargo_txt = profile.cargo if profile.cargo else "---"
            unidade_txt = profile.unidade if profile.unidade else "---"
        except:
            cargo_txt = "---"
            unidade_txt = "---"

        c.setFont("Helvetica-Bold", 10)
        c.drawString(2 * cm, y, "1. DADOS DO SERVIDOR")
        y -= 0.8 * cm
        c.setFont("Helvetica", 10)
        c.drawString(2 * cm, y, f"Nome: {nome_user}")
        c.drawString(12 * cm, y, f"Matrícula: {solicitacao.matricula}")
        y -= 0.6 * cm
        c.drawString(2 * cm, y, f"Cargo: {cargo_txt}")  # Agora mostra "---" se vazio
        c.drawString(12 * cm, y, f"Unidade: {unidade_txt}")

        # --- DADOS DO EVENTO ---
        y -= 1.5 * cm
        c.setFont("Helvetica-Bold", 10)
        c.drawString(2 * cm, y, "2. DADOS DO AFASTAMENTO")
        y -= 0.8 * cm

        # Formata Datas (Correção do Erro 2)
        try:
            d1 = solicitacao.data_inicio.strftime("%d/%m/%Y")
            d2 = solicitacao.data_fim.strftime("%d/%m/%Y")
            periodo = f"{d1} a {d2}"
        except:
            periodo = "Datas não definidas"

        # Local (Correção do Erro 3)
        cidade = getattr(solicitacao, "cidade", "---")
        estado = getattr(solicitacao, "estado", "SP")
        local_txt = f"{cidade}/{estado}" if cidade else "---"

        c.setFont("Helvetica", 10)
        c.drawString(2 * cm, y, f"Evento: {solicitacao.nome_evento}")
        y -= 0.6 * cm
        c.drawString(2 * cm, y, f"Período: {periodo}")
        y -= 0.6 * cm
        c.drawString(2 * cm, y, f"Local: {local_txt}")
        y -= 0.6 * cm
        c.drawString(2 * cm, y, "Objetivo:")

        # Quebra de linha para texto longo
        text_obj = c.beginText(4 * cm, y)
        text_obj.setFont("Helvetica", 10)
        text_obj.textLines((solicitacao.objetivo or "---")[:300])
        c.drawText(text_obj)

        # --- 4 ÁREAS DE ASSINATURA (CORREÇÃO FINAL) ---
        # Ajustamos a posição Y para garantir que caiba na página
        y_sig = 9 * cm

        # Função auxiliar para desenhar box
        def draw_box(x, y, titulo, nome_assinatura, cargo_assinatura):
            c.rect(x, y, 8 * cm, 3 * cm)
            c.setFont("Helvetica-Bold", 7)
            c.drawString(x + 0.2 * cm, y + 2.6 * cm, titulo)

            c.setFont("Helvetica", 8)
            if nome_assinatura:
                c.drawCentredString(x + 4 * cm, y + 1.5 * cm, nome_assinatura)
                c.setFont("Helvetica-Oblique", 7)
                c.drawCentredString(x + 4 * cm, y + 1.1 * cm, "Assinado Digitalmente")
                if cargo_assinatura:
                    c.drawCentredString(x + 4 * cm, y + 0.7 * cm, cargo_assinatura)
            else:
                c.drawCentredString(
                    x + 4 * cm, y + 1.5 * cm, "__________________________"
                )
                c.drawCentredString(x + 4 * cm, y + 1.0 * cm, "Assinatura Manual")

        # 1. SERVIDOR
        draw_box(2 * cm, y_sig, "SERVIDOR SOLICITANTE", nome_user, cargo_txt)

        # 2. GERENTE (Usa o nome salvo ou deixa linha para assinar)
        nome_gerente = (
            solicitacao.assinatura_gerente if solicitacao.assinatura_gerente else ""
        )
        if not nome_gerente and solicitacao.status in [
            "PENDENTE_COORD",
            "PENDENTE_ADMIN",
            "APROVADO",
        ]:
            nome_gerente = "(Aprovado no Sistema)"  # Fallback se não tiver nome gravado
        draw_box(11 * cm, y_sig, "CHEFIA IMEDIATA", nome_gerente, "Gerente")

        y_sig -= 3.5 * cm  # Desce para a próxima linha

        # 3. COORDENADOR
        nome_coord = (
            solicitacao.assinatura_coordenador
            if solicitacao.assinatura_coordenador
            else ""
        )
        if not nome_coord and solicitacao.status in ["PENDENTE_ADMIN", "APROVADO"]:
            nome_coord = "(Autorizado no Sistema)"
        draw_box(2 * cm, y_sig, "COORDENAÇÃO / DIRETORIA", nome_coord, "Coordenador")

        # 4. SECRETARIA (ADMIN) - O CAMPO QUE FALTAVA
        nome_admin = (
            solicitacao.assinatura_admin if solicitacao.assinatura_admin else ""
        )
        if not nome_admin and solicitacao.status == "APROVADO":
            nome_admin = "Secretaria Municipal de Saúde"
        draw_box(11 * cm, y_sig, "SECRETARIA DE SAÚDE", nome_admin, "Autorização Final")

        # Rodapé
        c.setFont("Helvetica", 8)
        c.drawCentredString(
            width / 2,
            2 * cm,
            "Documento gerado eletronicamente pelo Sistema Dispensa Digital.",
        )

        c.showPage()
        c.save()
        buffer.seek(0)
        return FileResponse(buffer, as_attachment=True, filename=f"dispensa_{pk}.pdf")

    except Exception as e:
        return HttpResponse(f'{{"erro": "{str(e)}"}}', status=500)
   
   

   # ====================================================================
# 5. RECUPERAÇÃO DE SENHA (API)
# ====================================================================

class SolicitarResetSenhaView(APIView):
    permission_classes = [permissions.AllowAny] # Qualquer um pode tentar recuperar

    def post(self, request):
        matricula = request.data.get('matricula')
        
        try:
            user = User.objects.get(username=matricula)
        except User.DoesNotExist:
            # Por segurança, fingimos que enviamos para não revelar se o usuário existe
            return Response({'mensagem': 'Se a matrícula existir, um código foi enviado.', 'email_mascarado': '******@****.com'})

        # 1. Mascara o e-mail para exibir no front (ex: ga***@gmail.com)
        email = user.email
        if email:
            try:
                user_part, domain = email.split('@')
                masked = user_part[:2] + "*" * (len(user_part)-2) + "@" + domain
            except:
                masked = email # Fallback se o email for estranho
        else:
            masked = "email***@naocadastrado.com"

        # 2. Gera um código simples de 6 dígitos (Simulação de Token)
        # Em produção, usaríamos tokens JWT ou o default_token_generator complexo.
        # Aqui vamos usar o cache ou salvar no user temporariamente. 
        # Para simplificar seu teste AGORA, vamos usar o token nativo do Django.
        token = default_token_generator.make_token(user)
        
        # --- SIMULAÇÃO DE ENVIO DE E-MAIL ---
        print("\n" + "="*40)
        print(f"📧 SIMULAÇÃO DE EMAIL PARA: {user.first_name}")
        print(f"🔐 CÓDIGO DE RECUPERAÇÃO: {token}") 
        print("Copie este código acima para testar no site.")
        print("="*40 + "\n")
        
        # Retorna o e-mail mascarado para o front mostrar
        return Response({
            'mensagem': 'Código enviado!',
            'email_mascarado': masked,
            'uid': urlsafe_base64_encode(force_bytes(user.pk)) # Identificador seguro
        })

class ConfirmarResetSenhaView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        uidb64 = request.data.get('uid')
        token = request.data.get('token')
        new_password = request.data.get('new_password')

        if not uidb64 or not token or not new_password:
            return Response({'erro': 'Dados incompletos.'}, status=400)

        try:
            # Decodifica o ID do usuário
            uid = force_str(urlsafe_base64_decode(uidb64))
            user = User.objects.get(pk=uid)

            # Verifica se o token (código) é válido para este usuário
            if default_token_generator.check_token(user, token):
                # TROCA A SENHA (sem precisar da antiga!)
                user.set_password(new_password)
                user.save()
                return Response({'mensagem': 'Senha alterada com sucesso! Faça login.'})
            else:
                return Response({'erro': 'Código inválido ou expirado.'}, status=400)

        except Exception as e:
            return Response({'erro': 'Erro ao processar solicitação.'}, status=400)
   
    # """
    # Gera o PDF da solicitação. 
    # """
    # try:
    #     # 1. Busca Dados
    #     try:
    #         solicitacao = Solicitacao.objects.get(pk=pk)
    #     except Solicitacao.DoesNotExist:
    #         return HttpResponse(
    #             '{"erro": "Solicitação não encontrada"}',
    #             status=404,
    #             content_type="application/json",
    #         )

    #     # 2. Configura Buffer e Canvas
    #     buffer = io.BytesIO()
    #     c = canvas.Canvas(buffer, pagesize=A4)
    #     width, height = A4

    #     # 3. Tratamento da Imagem (Brasão)
    #     try:
    #         base_dir = os.path.dirname(
    #             os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    #         )
    #         img_path = os.path.join(
    #             base_dir, "img", "Coat_of_arms_of_São_José_do_Rio_Preto_SP.png"
    #         )

    #         if os.path.exists(img_path):
    #             # Desenha o brasão
    #             c.drawImage(
    #                 ImageReader(img_path),
    #                 2 * cm,
    #                 height - 3.5 * cm,
    #                 width=2 * cm,
    #                 height=2.5 * cm,
    #                 mask="auto",
    #             )
    #         else:
    #             print(f"AVISO PDF: Brasão não encontrado em {img_path}")
    #     except Exception as e:
    #         print(f"ERRO PDF (Imagem ignorada): {e}")

    #     # 4. Cabeçalho Oficial
    #     c.setFont("Helvetica-Bold", 12)
    #     c.drawString(4.5 * cm, height - 2 * cm, "PREFEITURA DE SÃO JOSÉ DO RIO PRETO")
    #     c.setFont("Helvetica", 10)
    #     c.drawString(4.5 * cm, height - 2.5 * cm, "Secretaria Municipal de Saúde - SMS")
    #     c.setFont("Helvetica-Bold", 14)
    #     c.drawCentredString(
    #         width / 2, height - 5 * cm, "SOLICITAÇÃO DE DISPENSA DE PONTO"
    #     )

    #     # 5. Bloco: Dados do Servidor
    #     y = height - 7 * cm
    #     c.setFont("Helvetica-Bold", 10)
    #     c.drawString(2 * cm, y, "1. DADOS DO SERVIDOR:")
    #     c.line(2 * cm, y - 0.2 * cm, 19 * cm, y - 0.2 * cm)
    #     y -= 1 * cm

    #     # Nome e Matrícula (Proteção contra None)
    #     nome = (
    #         solicitacao.usuario.first_name
    #         if solicitacao.usuario.first_name
    #         else solicitacao.usuario.username
    #     )
    #     c.setFont("Helvetica", 10)
    #     c.drawString(2 * cm, y, f"Nome: {nome}")
    #     c.drawString(12 * cm, y, f"Matrícula: {solicitacao.matricula}")

    #     y -= 0.6 * cm
    #     # Unidade (Busca segura em UserProfile)
    #     unidade_txt = "---"
    #     try:
    #         unidade_txt = solicitacao.usuario.profile.unidade
    #     except:
    #         try:
    #             unidade_txt = solicitacao.usuario.userprofile.unidade
    #         except:
    #             pass
    #     c.drawString(2 * cm, y, f"Unidade / Lotação: {unidade_txt}")

    #     # 6. Bloco: Dados do Evento
    #     y -= 1.5 * cm
    #     c.setFont("Helvetica-Bold", 10)
    #     c.drawString(2 * cm, y, "2. DADOS DO EVENTO:")
    #     c.line(2 * cm, y - 0.2 * cm, 19 * cm, y - 0.2 * cm)
    #     y -= 1 * cm

    #     c.setFont("Helvetica", 10)
    #     # Campo 'nome_evento'
    #     evento_txt = getattr(solicitacao, "nome_evento", "Evento não especificado")
    #     c.drawString(2 * cm, y, f"Evento: {evento_txt}")

    #     y -= 0.6 * cm
    #     # Formata Datas
    #     try:
    #         d1 = solicitacao.data_inicio.strftime("%d/%m/%Y")
    #         d2 = solicitacao.data_fim.strftime("%d/%m/%Y")
    #         c.drawString(2 * cm, y, f"Período: {d1} a {d2}")
    #     except:
    #         c.drawString(2 * cm, y, "Período: Datas inválidas")

    #     y -= 0.6 * cm
    #     local = (
    #         getattr(solicitacao, "cidade", "")
    #         + " - "
    #         + getattr(solicitacao, "estado", "")
    #     )
    #     c.drawString(2 * cm, y, f"Local: {local}")

    #     y -= 0.6 * cm
    #     c.drawString(2 * cm, y, "Justificativa:")

    #     # Quebra de texto automática para justificativa
    #     text_obj = c.beginText(4.2 * cm, y)
    #     text_obj.setFont("Helvetica", 10)
    #     justificativa = solicitacao.objetivo[:350] if solicitacao.objetivo else "---"
    #     text_obj.textLines(justificativa)
    #     c.drawText(text_obj)

    #     # 7. Bloco: Assinaturas (4 Caixas Rigorosas)
    #     y_sig = 8 * cm

    #     # [Caixa 1] Servidor (Sempre Assinado)
    #     c.rect(2 * cm, y_sig, 8 * cm, 3 * cm)
    #     c.setFont("Helvetica-Bold", 8)
    #     c.drawString(2.2 * cm, y_sig + 2.6 * cm, "SERVIDOR SOLICITANTE")
    #     c.setFont("Helvetica", 9)
    #     c.drawCentredString(6 * cm, y_sig + 1.3 * cm, f"{nome}")
    #     c.setFont("Helvetica", 7)
    #     c.drawCentredString(6 * cm, y_sig + 0.8 * cm, "Assinado Digitalmente")
    #     try:
    #         dt_sol = solicitacao.data_solicitacao.strftime("%d/%m/%Y")
    #         c.drawCentredString(6 * cm, y_sig + 0.4 * cm, f"Data: {dt_sol}")
    #     except:
    #         pass

    #     # [Caixa 2] Gerente
    #     c.rect(11 * cm, y_sig, 8 * cm, 3 * cm)
    #     c.setFont("Helvetica-Bold", 8)
    #     c.drawString(11.2 * cm, y_sig + 2.6 * cm, "CHEFIA IMEDIATA (Gerente)")

    #     if solicitacao.assinatura_gerente:
    #         c.setFont("Helvetica", 9)
    #         c.drawCentredString(
    #             15 * cm, y_sig + 1.3 * cm, f"{solicitacao.assinatura_gerente}"
    #         )
    #         c.setFont("Helvetica", 7)
    #         c.drawCentredString(15 * cm, y_sig + 0.8 * cm, "Autorizado")
    #     elif solicitacao.status in ["PENDENTE_COORD", "PENDENTE_ADMIN", "APROVADO"]:
    #         c.setFont("Helvetica", 9)
    #         c.drawCentredString(15 * cm, y_sig + 1.3 * cm, "Gerência da Unidade")
    #         c.setFont("Helvetica", 7)
    #         c.drawCentredString(15 * cm, y_sig + 0.8 * cm, "Autorizado Digitalmente")
    #     else:
    #         c.setFont("Helvetica-Oblique", 8)
    #         c.drawCentredString(15 * cm, y_sig + 1.5 * cm, "Aguardando Análise...")

    #     y_sig -= 3.5 * cm  # Desce para a linha de baixo

    #     # [Caixa 3] Coordenador
    #     c.rect(2 * cm, y_sig, 8 * cm, 3 * cm)
    #     c.setFont("Helvetica-Bold", 8)
    #     c.drawString(2.2 * cm, y_sig + 2.6 * cm, "COORDENAÇÃO / DIRETORIA")

    #     if solicitacao.assinatura_coordenador:
    #         c.setFont("Helvetica", 9)
    #         c.drawCentredString(
    #             6 * cm, y_sig + 1.3 * cm, f"{solicitacao.assinatura_coordenador}"
    #         )
    #         c.setFont("Helvetica", 7)
    #         c.drawCentredString(6 * cm, y_sig + 0.8 * cm, "Autorizado")
    #     elif solicitacao.status in ["PENDENTE_ADMIN", "APROVADO"]:
    #         c.setFont("Helvetica", 9)
    #         c.drawCentredString(6 * cm, y_sig + 1.3 * cm, "Coordenação")
    #         c.setFont("Helvetica", 7)
    #         c.drawCentredString(6 * cm, y_sig + 0.8 * cm, "Autorizado Digitalmente")
    #     elif solicitacao.status == "PENDENTE_COORD":
    #         c.setFont("Helvetica-Oblique", 8)
    #         c.drawCentredString(6 * cm, y_sig + 1.5 * cm, "Em Análise...")
    #     else:
    #         c.drawCentredString(6 * cm, y_sig + 1.5 * cm, "---")

    #     # [Caixa 4] Admin (Secretaria)
    #     c.rect(11 * cm, y_sig, 8 * cm, 3 * cm)
    #     c.setFont("Helvetica-Bold", 8)
    #     c.drawString(11.2 * cm, y_sig + 2.6 * cm, "SECRETARIA DE SAÚDE")

    #     if solicitacao.assinatura_admin:
    #         c.setFont("Helvetica", 9)
    #         c.drawCentredString(
    #             15 * cm, y_sig + 1.3 * cm, f"{solicitacao.assinatura_admin}"
    #         )
    #         c.setFont("Helvetica", 7)
    #         c.drawCentredString(15 * cm, y_sig + 0.8 * cm, "Deferimento Final")
    #     elif solicitacao.status == "APROVADO":
    #         c.setFont("Helvetica", 9)
    #         c.drawCentredString(15 * cm, y_sig + 1.3 * cm, "Secretaria Municipal")
    #         c.setFont("Helvetica", 7)
    #         c.drawCentredString(15 * cm, y_sig + 0.8 * cm, "Deferido Digitalmente")
    #     elif solicitacao.status == "PENDENTE_ADMIN":
    #         c.setFont("Helvetica-Oblique", 8)
    #         c.drawCentredString(15 * cm, y_sig + 1.5 * cm, "Em Análise...")
    #     else:
    #         c.drawCentredString(15 * cm, y_sig + 1.5 * cm, "---")

    #     # Finaliza
    #     c.showPage()
    #     c.save()
    #     buffer.seek(0)

    #     return FileResponse(buffer, as_attachment=True, filename=f"dispensa_{pk}.pdf")

    # except Exception as e:
    #     traceback.print_exc()
    #     return HttpResponse(
    #         f'{{"erro": "Falha na geração do PDF: {str(e)}"}}',
    #         status=500,
    #         content_type="application/json",
    #     )
