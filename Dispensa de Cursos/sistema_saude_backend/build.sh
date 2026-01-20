#!/usr/bin/env bash
# Sair se der erro
set -o errexit

# Instalar dependências
pip install -r requirements.txt

# Coletar arquivos estáticos (CSS/JS do admin)
python manage.py collectstatic --no-input

# Criar/Atualizar o banco de dados
python manage.py migrate