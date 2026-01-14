from django.contrib import admin
from django.urls import path, include
from rest_framework import routers
from dispensas.views import (
    SolicitacaoViewSet, CustomLoginView, RegisterView, 
    UserProfileView, SetorListView, gerar_pdf_solicitacao 
)

router = routers.DefaultRouter()
router.register(r'solicitacoes', SolicitacaoViewSet, basename='solicitacao')

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include(router.urls)),
    
    # Rotas de Autenticação e Perfil
    path('api/login/', CustomLoginView.as_view(), name='login'),
    path('api/register/', RegisterView.as_view(), name='register'),
    path('api/meus-dados/', UserProfileView.as_view(), name='meus_dados'),
    path('api/setores/', SetorListView.as_view(), name='lista_setores'),
    
    # Rota do PDF
    path('api/solicitacoes/<int:pk>/pdf/', gerar_pdf_solicitacao, name='gerar_pdf'),
]