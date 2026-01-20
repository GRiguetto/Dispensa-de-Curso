from pathlib import Path
import os

BASE_DIR = Path(__file__).resolve().parent.parent
SECRET_KEY = "django-insecure-chave-secreta-trocar-em-producao"
DEBUG = True
ALLOWED_HOSTS = ['*']

INSTALLED_APPS = [
    "jazzmin",
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # Nossos Apps
    "rest_framework.authtoken",
    "rest_framework",
    "corsheaders",
    "dispensas",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",  # Importante estar no topo
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware", # <--- Adicione aqui
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

# Permite que o Frontend (HTML) converse com o Backend
CORS_ALLOWED_ORIGINS = [
    "http://127.0.0.1:5500",
    "http://localhost:5500",
    "https://solicitacaodispensa.netlify.app"
]

ROOT_URLCONF = "core.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "core.wsgi.application"

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": BASE_DIR / "db.sqlite3",
    }
}

AUTH_PASSWORD_VALIDATORS = []
# (Deixei vazio pra facilitar testes com senhas simples, em produção use os validadores)

LANGUAGE_CODE = "pt-br"
TIME_ZONE = "America/Sao_Paulo"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# --- CONFIGURAÇÃO DO REST FRAMEWORK (PARA LER TOKENS) ---
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework.authentication.TokenAuthentication",
        "rest_framework.authentication.SessionAuthentication",  # Mantém o admin funcionando
    ],
}

# --- CONFIGURAÇÃO DE E-MAIL (DEV) ---
# Em produção, usaremos SMTP (Gmail/Outlook).
# Por enquanto, o e-mail "finge" que foi enviado e aparece no terminal.
EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"
EMAIL_HOST_USER = "sistema@saude.riopreto.sp.gov.br"  # Remetente fictício

# --- CONFIGURAÇÃO DO JAZZMIN (PAINEL BONITO) ---

JAZZMIN_SETTINGS = {
    # Títulos e Logos
    "site_title": "Dispensa Digital",
    "site_header": "Gestão de Dispensas",
    "site_brand": "SMS Rio Preto",
    "welcome_sign": "Bem-vindo ao Painel Administrativo",
    "copyright": "Secretaria Municipal de Saúde - Rio Preto",
    # Ícones do Menu (Usando FontAwesome, igual você já usa no front)
    "icons": {
        "auth": "fas fa-users-cog",
        "auth.user": "fas fa-user",
        "auth.Group": "fas fa-users",
        # Nossos Apps
        "dispensas.Solicitacao": "fas fa-file-signature",
        "dispensas.Departamento": "fas fa-building",  # Coordenadores
        "dispensas.Setor": "fas fa-hospital-user",  # Gerentes
        "dispensas.UserProfile": "fas fa-id-card",
    },
    # Ordem do Menu Lateral
    "order_with_respect_to": ["dispensas", "auth"],
    # Visual
    "show_ui_builder": True,  # Deixa um botãozinho pra você trocar as cores ao vivo e testar
}

# Cores e Estilo (Tema Dark/Moderno)
JAZZMIN_UI_TWEAKS = {
    "navbar_small_text": False,
    "footer_small_text": False,
    "body_small_text": False,
    "brand_small_text": False,
    "brand_colour": "navbar-primary",
    "accent": "accent-primary",
    "navbar": "navbar-dark",
    "no_navbar_border": False,
    "navbar_fixed": False,
    "layout_boxed": False,
    "footer_fixed": False,
    "sidebar_fixed": False,
    "sidebar": "sidebar-dark-primary",
    "sidebar_nav_small_text": False,
    "theme": "flatly",  # Temas bons: flatly, simplex, darkly, slate
    "dark_mode_theme": None,
    "button_classes": {
        "primary": "btn-primary",
        "secondary": "btn-secondary",
        "info": "btn-info",
        "warning": "btn-warning",
        "danger": "btn-danger",
        "success": "btn-success",
    },
}

# Configuração de Arquivos de Mídia (Uploads)
MEDIA_URL = '/media/'
MEDIA_ROOT = os.path.join(BASE_DIR, 'media')
