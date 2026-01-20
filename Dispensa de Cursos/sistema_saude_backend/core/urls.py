from django.contrib import admin
from django.urls import path, include
from rest_framework import routers
from django.conf import settings
from django.conf.urls.static import static
from dispensas.views import (
    SolicitacaoViewSet,
    CustomLoginView,
    RegisterView,
    UserProfileView,
    SetorListView,
    gerar_pdf_solicitacao,
    ChangePasswordView,
    SolicitarResetSenhaView,
    ConfirmarResetSenhaView,
)

router = routers.DefaultRouter()
router.register(r"solicitacoes", SolicitacaoViewSet, basename="solicitacao")

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include(router.urls)),
    # Rotas de Autenticação e Perfil
    path("api/login/", CustomLoginView.as_view(), name="login"),
    path("api/register/", RegisterView.as_view(), name="register"),
    path("api/meus-dados/", UserProfileView.as_view(), name="meus_dados"),
    path("api/setores/", SetorListView.as_view(), name="lista_setores"),
    # Rota do PDF
    path("api/solicitacoes/<int:pk>/pdf/", gerar_pdf_solicitacao, name="gerar_pdf"),
    #Rotas de senhas
    path("api/alterar-senha/", ChangePasswordView.as_view(), name="alterar-senha"),
    path('api/recuperar-senha/solicitar/', SolicitarResetSenhaView.as_view(), name='recuperar_solicitar'),
    path('api/recuperar-senha/confirmar/', ConfirmarResetSenhaView.as_view(), name='recuperar_confirmar'),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
