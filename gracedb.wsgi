#!/usr/bin/python

import sys
import os
#import logging

# Make something appear in error log if the WSGI is run at all
#raise ValueError()

# Path to your project

# Шлях до вашого додатка
BASE_DIR = os.path.dirname(__file__)

sys.path.insert(0, BASE_DIR)

# Активуємо віртуальне середовище
#activate_this = os.path.join(BASE_DIR, 'venv/bin/activate_this.py')

# Якщо файлу activate_this.py немає (у нових версіях venv), використовуйте:
sys.path.insert(1, os.path.join(BASE_DIR, 'venv/lib/python3.10/site-packages'))


#sys.path.insert(0,'/var/www/blagodat.org.ua/html/gracedb/venv/lib/python3.10/site-packages')

from app import app as application
