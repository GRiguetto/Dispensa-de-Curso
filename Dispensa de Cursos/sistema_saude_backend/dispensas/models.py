from django.db import models
from django.contrib.auth.models import User

class Solicitacao(models.Model):
    STATUS_CHOICES = [
        ('PENDENTE_GERENTE', 'Aguardando Gerente'),
        ('PENDENTE_COORD', 'Aguardando Coordenação'),
        ('PENDENTE_ADMIN', 'Aguardando Secretaria'),
        ('APROVADO', 'Concluído'),
        ('CANCELADO', 'Indeferido'),
    ]

    # Dados Básicos
    usuario = models.ForeignKey(User, on_delete=models.CASCADE)
    matricula = models.CharField(max_length=20)
    unidade = models.CharField(max_length=100)
    cargo = models.CharField(max_length=100)
    
    # Dados do Evento
    nome_evento = models.CharField(max_length=200)
    objetivo = models.TextField()
    data_inicio = models.DateField()
    data_fim = models.DateField()
    cidade = models.CharField(max_length=100)
    estado = models.CharField(max_length=50)

    # Campos Novos para o PDF (Protocolo e Checkboxes)
    protocolo_sigm = models.CharField(max_length=50, blank=True, null=True)
    tipo_convite = models.BooleanField(default=False)
    tipo_programacao = models.BooleanField(default=False)
    tipo_convocacao = models.BooleanField(default=False)
    tipo_outros = models.BooleanField(default=False)

    # Hierarquia de Assinaturas e Datas
    # 1. Servidor
    assinatura_servidor = models.CharField(max_length=100, blank=True, null=True)
    data_solicitacao = models.DateTimeField(auto_now_add=True)

    # 2. Gerente
    assinatura_gerente = models.CharField(max_length=100, blank=True, null=True)
    data_aprovacao_gerente = models.DateTimeField(blank=True, null=True)

    # 3. Coordenador
    assinatura_coordenador = models.CharField(max_length=100, blank=True, null=True)
    data_aprovacao_coordenador = models.DateTimeField(blank=True, null=True)

    # 4. Admin
    assinatura_admin = models.CharField(max_length=100, blank=True, null=True)
    data_aprovacao_admin = models.DateTimeField(blank=True, null=True)

    # Controle Final
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDENTE_GERENTE')
    motivo_cancelamento = models.TextField(blank=True, null=True)

    def __str__(self):
        return f"{self.nome_evento} - {self.usuario.username}"

class UserProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    cargo = models.CharField(max_length=100, default='Servidor')
    unidade = models.TextField(default='Não definida') 

    def __str__(self):
        return f"{self.user.username} - {self.cargo}"

# --- HIERARQUIA INTELIGENTE ---

class Departamento(models.Model):
    """
    Representa os COORDENADORES (Nível Intermediário - Marrom na planilha)
    Ex: Departamento de Atenção Básica, Departamento de Urgência...
    """
    nome = models.CharField(max_length=200, unique=True)
    responsavel = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='departamentos_coordenados')
    
    def __str__(self):
        return f"{self.nome} (Coord: {self.responsavel.first_name if self.responsavel else 'Vago'})"

class Setor(models.Model):
    """
    Representa os GERENTES (Nível Base - Cinza na planilha)
    Ex: UBS Central, UPA Norte, CAPS...
    """
    nome = models.CharField(max_length=200, unique=True)
    departamento = models.ForeignKey(Departamento, on_delete=models.CASCADE, related_name='setores')
    responsavel = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='setores_gerenciados')

    def __str__(self):
        return f"{self.nome} -> Pertence a: {self.departamento.nome}"