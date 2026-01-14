from django.contrib import admin
from .models import Solicitacao, UserProfile, Departamento, Setor # <--- Importe as novas

# Configuração visual para facilitar sua vida
class SetorAdmin(admin.ModelAdmin):
    list_display = ('nome', 'responsavel_nome', 'departamento_nome')
    search_fields = ('nome',)
    list_filter = ('departamento',)

    def responsavel_nome(self, obj):
        return obj.responsavel.first_name if obj.responsavel else '-'
    responsavel_nome.short_description = 'Gerente'

    def departamento_nome(self, obj):
        return obj.departamento.nome
    departamento_nome.short_description = 'Departamento (Coordenação)'

class DepartamentoAdmin(admin.ModelAdmin):
    list_display = ('nome', 'responsavel_nome')
    
    def responsavel_nome(self, obj):
        return obj.responsavel.first_name if obj.responsavel else '-'
    responsavel_nome.short_description = 'Coordenador'

# Registra tudo
admin.site.register(Solicitacao)
# admin.site.register(UserProfile) # Opcional, se quiser ver os perfis crus
admin.site.register(Departamento, DepartamentoAdmin)
admin.site.register(Setor, SetorAdmin)