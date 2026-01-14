# ====================================================================
# VIEWS.PY - VERSÃO CORRIGIDA E COMPLETA
# ====================================================================
from django.shortcuts import render
from rest_framework import viewsets, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.authtoken.models import Token
from django.contrib.auth import authenticate
from django.contrib.auth.models import User, Group

# --- IMPORTS CRÍTICOS (NÃO APAGUE) ---
from django.db.models import Q  # Essencial para os filtros
from rest_framework.decorators import action # Essencial para os botões aprovar
from django.http import FileResponse # Essencial para o PDF

# Imports do PDF
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
import io

# Seus Models e Serializers
from .models import Solicitacao, UserProfile, Setor, Departamento
from .serializers import SolicitacaoSerializer


# --- VIEWSET PRINCIPAL (SOLICITAÇÕES) ---
class SolicitacaoViewSet(viewsets.ModelViewSet):
    serializer_class = SolicitacaoSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        # 1. Tenta pegar o usuário. Se der erro, retorna lista vazia.
        try:
            user = self.request.user
            if user.is_anonymous:
                return Solicitacao.objects.none()
        except:
            return Solicitacao.objects.none()

        # 2. ADMIN VÊ TUDO
        if user.is_superuser: 
            return Solicitacao.objects.all().order_by('-id')
        
        # 3. FILTRO BÁSICO (Meus Pedidos)
        filtro = Q(usuario=user)

        # 4. LÓGICA DE GERENTE
        # (Usa try/except para não travar se o Setor não existir)
        try:
            if user.groups.filter(name='Gerentes').exists():
                setores_do_gerente = Setor.objects.filter(responsavel=user).values_list('nome', flat=True)
                filtro = filtro | Q(unidade__in=setores_do_gerente)
        except Exception as e:
            print(f"Erro no filtro de Gerente: {e}")

        # 5. LÓGICA DE COORDENADOR
        try:
            if user.groups.filter(name='Coordenadores').exists():
                deptos_do_coord = Departamento.objects.filter(responsavel=user)
                setores_sob_jurisdicao = Setor.objects.filter(departamento__in=deptos_do_coord).values_list('nome', flat=True)
                filtro = filtro | Q(unidade__in=setores_sob_jurisdicao)
        except Exception as e:
            print(f"Erro no filtro de Coordenador: {e}")

        # Retorna o resultado final
        return Solicitacao.objects.filter(filtro).distinct().order_by('-id')

    def perform_create(self, serializer):
        serializer.save(usuario=self.request.user)

    # --- AÇÕES ESPECIAIS (APROVAR/REPROVAR) ---
    @action(detail=True, methods=['post'])
    def aprovar(self, request, pk=None):
        try:
            solicitacao = self.get_object()
            user = request.user
            
            # Gerente
            if user.groups.filter(name='Gerentes').exists():
                if solicitacao.status == 'PENDENTE_GERENTE':
                    solicitacao.status = 'PENDENTE_COORD'
                    solicitacao.save()
                    return Response({'status': 'Aprovado pelo Gerente -> Enviado ao Coord'})
            
            # Coordenador
            if user.groups.filter(name='Coordenadores').exists():
                if solicitacao.status == 'PENDENTE_COORD':
                    solicitacao.status = 'PENDENTE_ADMIN'
                    solicitacao.save()
                    return Response({'status': 'Aprovado pelo Coord -> Enviado ao Admin'})

            # Admin
            if user.is_superuser or user.is_staff:
                solicitacao.status = 'APROVADO'
                solicitacao.save()
                return Response({'status': 'Processo Finalizado com Sucesso'})

            return Response({'erro': 'Sem permissão ou status incorreto.'}, status=403)
        except Exception as e:
             return Response({'erro': str(e)}, status=500)
    
    @action(detail=True, methods=['post'])
    def reprovar(self, request, pk=None):
        solicitacao = self.get_object()
        solicitacao.status = 'INDEFERIDO'
        solicitacao.save()
        return Response({'status': 'Solicitação Indeferida'})


# --- LOGIN ---
class CustomLoginView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        username = request.data.get('username')
        password = request.data.get('password')
        user = authenticate(username=username, password=password)

        if user is not None:
            token, created = Token.objects.get_or_create(user=user)
            
            # Verifica Cargo/Unidade de forma segura
            cargo_real = "Servidor"
            unidade_real = ""
            try:
                if hasattr(user, 'profile'):
                    cargo_real = user.profile.cargo
                    unidade_real = user.profile.unidade
            except:
                pass

            role = 'user'
            if user.is_superuser: role = 'admin'
            elif user.groups.filter(name='Coordenadores').exists(): role = 'coordinator'
            elif user.groups.filter(name='Gerentes').exists(): role = 'manager'
            
            return Response({
                "mensagem": "Login realizado!",
                "usuario": {
                    "id": user.id, "token": token.key, "nome": user.first_name,
                    "matricula": user.username, "role": role,
                    "cargo": cargo_real, "unidade": unidade_real
                }
            }, status=status.HTTP_200_OK)
        else:
            return Response({"erro": "Credenciais inválidas"}, status=status.HTTP_401_UNAUTHORIZED)


# --- CADASTRO ---
class RegisterView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        data = request.data
        if User.objects.filter(username=data.get('username')).exists():
            return Response({"erro": "Matrícula já cadastrada."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            user = User.objects.create_user(
                username=data.get('username'),
                password=data.get('password'),
                email=data.get('email'),
                first_name=data.get('first_name')
            )
            # Cria perfil extra
            UserProfile.objects.create(
                user=user,
                cargo=data.get('cargo', 'Servidor'),
                unidade=data.get('unidade', '')
            )
            token, _ = Token.objects.get_or_create(user=user)

            return Response({
                "mensagem": "Cadastro ok!",
                "usuario": {
                    "id": user.id, "token": token.key, "nome": user.first_name, 
                    "matricula": user.username, "role": "user"
                }
            }, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            return Response({"erro": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# --- MEUS DADOS ---
class UserProfileView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        try:
            profile = user.profile
        except:
            profile = UserProfile.objects.create(user=user)
        return Response({
            "nome": user.first_name, "email": user.email,
            "matricula": user.username, "cargo": profile.cargo, "unidades": profile.unidade
        })

    def patch(self, request):
        user = request.user
        data = request.data
        try:
            profile = user.profile
        except:
            profile = UserProfile.objects.create(user=user)

        if 'nome' in data: user.first_name = data['nome']
        if 'email' in data: user.email = data['email']
        user.save()

        if 'cargo' in data: profile.cargo = data['cargo']
        if 'unidades' in data: profile.unidade = data['unidades']
        profile.save()

        return Response({"mensagem": "Dados atualizados!"})


# --- LISTA SETORES (AUTOCOMPLETE) ---
class SetorListView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    def get(self, request):
        setores = Setor.objects.all().order_by('nome').values_list('nome', flat=True)
        return Response(list(setores))


# --- GERADOR DE PDF (CORRIGIDO PARA NÃO TRAVAR EM DATA) ---
def gerar_pdf_solicitacao(request, pk):
    try:
        solicitacao = Solicitacao.objects.get(pk=pk)
    except Solicitacao.DoesNotExist:
        return Response({'erro': 'Solicitação não encontrada'}, status=404)

    buffer = io.BytesIO()
    p = canvas.Canvas(buffer, pagesize=A4)
    
    # Cabeçalho
    p.setFont("Helvetica-Bold", 14)
    p.drawString(2*cm, 28*cm, "PREFEITURA DE SÃO JOSÉ DO RIO PRETO")
    p.setFont("Helvetica", 10)
    p.drawString(2*cm, 27.5*cm, "Secretaria Municipal de Saúde - SMS")
    p.line(2*cm, 27*cm, 19*cm, 27*cm)
    
    # Título (Trata erro de ano)
    p.setFont("Helvetica-Bold", 16)
    p.drawCentredString(10.5*cm, 25*cm, "SOLICITAÇÃO DE DISPENSA / AFASTAMENTO")
    p.setFont("Helvetica", 10)
    
    try:
        ano = solicitacao.data_inicio.year
    except:
        ano = "2026"
    p.drawCentredString(10.5*cm, 24.5*cm, f"Protocolo Digital Nº: {solicitacao.id}/{ano}")

    # Dados
    y = 22*cm
    p.setFont("Helvetica-Bold", 12)
    p.drawString(2*cm, y, "1. DADOS DO SERVIDOR")
    y -= 1*cm
    p.setFont("Helvetica", 11)
    p.drawString(2*cm, y, f"Nome: {solicitacao.usuario.first_name}")
    p.drawString(12*cm, y, f"Matrícula: {solicitacao.matricula}")
    
    y -= 2*cm
    p.setFont("Helvetica-Bold", 12)
    p.drawString(2*cm, y, "2. DADOS DO AFASTAMENTO")
    y -= 1*cm
    p.setFont("Helvetica", 11)
    p.drawString(2*cm, y, f"Evento: {solicitacao.nome_evento}")
    
    # Assinaturas
    y -= 3*cm
    p.setFont("Helvetica-Bold", 12)
    p.drawString(2*cm, y, "3. APROVAÇÕES")
    y -= 1.5*cm
    
    p.rect(2*cm, y, 17*cm, 1.2*cm)
    p.setFont("Helvetica", 10)
    if solicitacao.status == 'APROVADO':
        p.drawString(2.5*cm, y+0.4*cm, "✅ DEFERIDO E FINALIZADO PELO ADMIN")
    else:
        p.drawString(2.5*cm, y+0.4*cm, f"STATUS ATUAL: {solicitacao.status}")

    p.showPage()
    p.save()
    buffer.seek(0)
    
    return FileResponse(buffer, as_attachment=True, filename=f'dispensa_{pk}.pdf')