from rest_framework import serializers
from django.contrib.auth.models import User
from .models import Solicitacao

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'first_name', 'email']

class SolicitacaoSerializer(serializers.ModelSerializer):
    usuario_dados = UserSerializer(source='usuario', read_only=True)
    data_criacao_fmt = serializers.SerializerMethodField()
    
    class Meta:
        model = Solicitacao
        fields = '__all__'

    def get_data_criacao_fmt(self, obj):
        return obj.data_solicitacao.strftime('%d/%m/%Y')