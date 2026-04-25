import sqlite3
from flask import Flask, render_template, request, jsonify, session, redirect, url_for, send_file
from werkzeug.security import check_password_hash
import io
import os
import sys

# Якщо Flask не бачить підпапку від Apache/mod_wsgi
from werkzeug.middleware.proxy_fix import ProxyFix

import base64
from datetime import datetime, timedelta
from weasyprint import HTML # Потрібно встановити: pip install weasyprint

import pdfkit

from functools import wraps
from flask import abort


import logging
from logging.handlers import RotatingFileHandler

app = Flask(__name__)

BASE_DIR = os.path.dirname(os.path.abspath(__file__)) # Шлях до папки
DB_PATH = os.path.join(BASE_DIR, 'database', '_grace.sqlite')

print(DB_PATH)

app.config.update(
    SESSION_COOKIE_PATH='/gracedb/',  # Явно вказуємо шлях для кук
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE='Lax',
)

# 2. Налаштування сесій для підпапки
app.config['SESSION_COOKIE_PATH'] = '/gracedb/'


app.secret_key = 'super_secret_key_change_me' # Обов'язково змініть для безпеки

if not app.debug:
    # Шлях до файлу логів у вашій папці проекту
    log_path = os.path.join(BASE_DIR, 'error.log')
    
    file_handler = RotatingFileHandler(log_path, maxBytes=10240, backupCount=10)
    file_handler.setFormatter(logging.Formatter(
        '%(asctime)s %(levelname)s: %(message)s [in %(pathname)s:%(lineno)d]'
    ))
    file_handler.setLevel(logging.INFO)
    app.logger.addHandler(file_handler)
    app.logger.info('GraceDB startup')


DEBUG_LOG_PATH = os.path.join(BASE_DIR, 'debug.txt')

# Налаштування логера
logging.basicConfig(
    filename=DEBUG_LOG_PATH,
    level=logging.DEBUG, # Рівень: DEBUG, INFO, WARNING, ERROR, CRITICAL
    format='%(asctime)s %(levelname)s: %(message)s [в %(pathname)s:%(lineno)d]',
    encoding='utf-8'
)

# Створюємо об'єкт логера
logger = logging.getLogger('gracedb_debug')
logger.debug(f"Дебаг")

import subprocess

def get_build_number():
    try:
        with open(os.path.join(BASE_DIR, 'version.txt'), 'r') as f:
            return f.read().strip()
    except:
        return "0"
        
def get_build_number_n():
    try:
        # Отримуємо кількість комітів у гілці main
        build = subprocess.check_output(['git', 'rev-list', '--count', 'HEAD']).decode('utf-8').strip()
        # Отримуємо короткий хеш останнього коміту (опціонально)
        short_hash = subprocess.check_output(['git', 'rev-parse', '--short', 'HEAD']).decode('utf-8').strip()
        return f"b{build} ({short_hash})"
    except Exception:
        return "dev"


# В app.py поза функціями
BUILD_NUMBER = get_build_number()

# Додаємо це в контекст шаблонів, щоб версія була доступна скрізь
@app.context_processor
def inject_build():
    return dict(build_number=get_build_number())
    
    
def ukrainian_collation(string1, string2):
    # Специфічні символи для української мови
    alphabet = " абвгґдеєжзиіїйклмнопрстуфхцчшщьюя"
    
    s1, s2 = string1.lower(), string2.lower()
    
    # Порівнюємо посимвольно
    for char1, char2 in zip(s1, s2):
        idx1 = alphabet.find(char1)
        idx2 = alphabet.find(char2)
        
        if idx1 != idx2:
            return 1 if idx1 > idx2 else -1
    
    return len(s1) - len(s2)

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    # Реєструємо власну назву сортування 'UKRAINIAN_CUSTOM'
    conn.create_collation("UKRAINIAN_CUSTOM", ukrainian_collation)
    conn.row_factory = sqlite3.Row
    return conn
    
# --- АВТОРИЗАЦІЯ ---
@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        data = request.json
        username = data.get('username')
        password = data.get('password')
        
        conn = get_db_connection()
        # Таблицю app_users потрібно створити попередньо (як вказувалося раніше)
        user = conn.execute('SELECT * FROM app_users WHERE username = ?', (username,)).fetchone()
        conn.close()

        if user and check_password_hash(user['password_hash'], password):
            session['user_id'] = user['id']
            session['username'] = user['username']  # Зберігаємо ім'я
            session['role'] = user['role']  # Зберігаємо роль у сесії
            return jsonify({'success': True})
        return jsonify({'success': False, 'message': 'Невірний логін або пароль'}), 401
    
    return render_template('login.html')

@app.context_processor
def inject_user():
    user_name = session.get('username', 'гість')
    return dict(current_user_name=user_name)
    
    
@app.route('/logout')
def logout():
    session.pop('user_id', None)
    return redirect(url_for('login'))

# Декоратор для захисту маршрутів
def login_required(f):
    def wrap(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({'error': 'Неавторизовано'}), 401
        return f(*args, **kwargs)
    wrap.__name__ = f.__name__
    return wrap

# --- ГОЛОВНА СТОРІНКА ---
@app.route('/')
def index():
    if 'user_id' not in session:
        return redirect(url_for('login'))
    return render_template('index.html')

# --- API ДЛЯ ДОВІДНИКІВ (ЛУТ-ТАБЛИЦІ) ---
@app.route('/api/lists', methods=['GET'])
@login_required
def get_lists():
    conn = get_db_connection()
    lists = {}
    try:
        # Перевірте, чи назва колонки точно 'list_name' у вашій базі!
        # Якщо в таблиці інша назва, змініть 'list_name' на правильну.
        lists['gender'] = [dict(row) for row in conn.execute('SELECT id, list_name FROM list_gender').fetchall()]
        lists['fam_status'] = [dict(row) for row in conn.execute('SELECT id, list_name FROM list_family_status').fetchall()]
        lists['church_status'] = [dict(row) for row in conn.execute('SELECT id, list_name FROM list_church_status').fetchall()]
    except sqlite3.OperationalError as e:
        print(f"Помилка БД: {e}")
        # Повертаємо порожні списки, щоб JS не "падав"
        lists = {'gender': [], 'fam_status': [], 'church_status': []}
    finally:
        conn.close()
    return jsonify(lists)

# --- API ДЛЯ ТАБЛИЦІ PEOPLE ---
@app.route('/api/people')
@login_required
def get_people():
    logger.debug("--- Запит до /api/people_bd розпочато ---")
    # Додаємо сортування та ліміти
    try:
        logger.debug(f"Всі параметри запиту: {request.args.to_dict()}")
        # Параметри пагінації
        page = int(request.args.get('page', 1))
        limit = int(request.args.get('limit', 5))
        offset = (page - 1) * limit

        # Текстові фільтри
        f_name = request.args.get('name', '').strip()
        f_phone = request.args.get('phone', '').strip()
        f_address = request.args.get('address', '').strip()

        # Фільтри-масиви (з чекбоксів модального вікна)
        # Очікуємо формат від JS: ?genders[]=1&genders[]=2...
        f_genders = request.args.getlist('genders[]')
        f_church = request.args.getlist('church_status[]')
        f_family = request.args.getlist('family_status[]')

        # Додаємо перевірку на тиждень народжень
        birthday_week = request.args.get('birthday_week')
        
        query = "SELECT * FROM people WHERE 1=1"
        params = []

        # Пошук по імені
        if f_name:
            query += " AND name LIKE ?"
            params.append(f'%{f_name}%')

        # Пошук по всіх доступних телефонах у схемі
        if f_phone:
            query += " AND (Mobile_Phone LIKE ? OR Home_phone LIKE ? OR Work_phone LIKE ? OR Mobile_Phone_a LIKE ?)"
            params.extend([f'%{f_phone}%', f'%{f_phone}%', f'%{f_phone}%', f'%{f_phone}%'])

        # Пошук за адресою
        if f_address:
            query += " AND address LIKE ?"
            params.append(f'%{f_address}%')

        # Фільтр за статтю (колонка 'gender' у схемі)
        if f_genders:
            placeholders = ', '.join(['?'] * len(f_genders))
            query += f" AND gender IN ({placeholders})"
            params.extend(f_genders)

        # Фільтр за церковним статусом (колонка 'church_status')
        if f_church:
            placeholders = ', '.join(['?'] * len(f_church))
            query += f" AND church_status IN ({placeholders})"
            params.extend(f_church)

        # Фільтр за сімейним станом (колонка 'fam_status')
        if f_family:
            placeholders = ', '.join(['?'] * len(f_family))
            query += f" AND fam_status IN ({placeholders})"
            params.extend(f_family)

        if birthday_week=='true':
            # Вираховуємо межі поточного тижня
            today = datetime.now().date()
            start_week = today - timedelta(days=today.weekday())
            end_week = start_week + timedelta(days=6)
        
            # Форматуємо для SQLite (місяць-день)
            start_str = start_week.strftime('%m-%d')
            end_str = end_week.strftime('%m-%d')
            
            if start_str <= end_str:
                query += " AND strftime('%m-%d', Date_of_Birth) BETWEEN ? AND ?"
                params.extend([start_str, end_str])
            else:
                # Випадок переходу через Новий Рік
                query += " AND (strftime('%m-%d', Date_of_Birth) >= ? OR strftime('%m-%d', Date_of_Birth) <= ?)"
                params.extend([start_str, end_str])
 
       
        logger.debug(f"Запит query: {query}")
        conn = get_db_connection()
        
        
        # Рахуємо загальну кількість результатів для пагінації
        count_query = f"SELECT COUNT(*) FROM ({query})"
        total = conn.execute(count_query, params).fetchone()[0]

        
        # Додаємо сортування за днем народження (ігноруючи рік)
        order_query = " ORDER BY name COLLATE UKRAINIAN_CUSTOM ASC LIMIT ? OFFSET ?"
        
        if birthday_week=='true':
            order_query = f" ORDER BY strftime('%m-%d', Date_of_Birth) ASC  LIMIT ? OFFSET ?"
            

        final_query = query + order_query
        
        logger.debug(f"Запит final_query: {final_query}")
        
        print(f"DEBUG final_query: {final_query}", file=sys.stderr)
        
        logger.debug(f"Запит params: {params}")
        
        print(f"DEBUG PARAMS: {params}", file=sys.stderr)
        
        final_params = params + [limit, offset]
        
        logger.debug(f"Запит final_params: {final_params}")
        
        print(f"DEBUG final_params: {final_params}", file=sys.stderr)
        
         
        rows = conn.execute(final_query, final_params).fetchall()
        conn.close()

        return jsonify({
            'data': [dict(row) for row in rows],
            'total': total,
            'page': page,
            'limit': limit
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500
        
       
@app.route('/api/user/settings', methods=['GET', 'POST'])
@login_required
def user_settings():
    user_id = session.get('user_id')
    conn = get_db_connection()
    
    if request.method == 'POST':
        settings = request.json # Очікуємо словник {key: value}
        for key, value in settings.items():
            conn.execute('''INSERT OR REPLACE INTO user_settings (user_id, setting_key, setting_value) 
                            VALUES (?, ?, ?)''', (user_id, key, str(value)))
        conn.commit()
        return jsonify({'success': True})
    
    rows = conn.execute('SELECT setting_key, setting_value FROM user_settings WHERE user_id = ?', (user_id,)).fetchall()
    return jsonify({row['setting_key']: row['setting_value'] for row in rows})
    
@app.route('/api/people/<int:person_id>', methods=['GET'])
@login_required
def get_person(person_id):
    conn = get_db_connection()
    # Вибираємо всі потрібні поля згідно з твоєю схемою
    person = conn.execute('SELECT * FROM people WHERE id = ?', (person_id,)).fetchone()
    conn.close()
    
    if person:
        return jsonify(dict(person))
    return jsonify({'error': 'Особу не знайдено'}), 404
    
@app.route('/api/people/<int:person_id>', methods=['PUT'])
@login_required
def update_person(person_id):
    data = request.json
    
    # Витягуємо дані з JSON
    name = data.get('name')
    email = data.get('email')
    gender = data.get('gender')
    fam_status = data.get('fam_status')
    send_bd_sms = data.get('send_bd_sms')

    try:
        conn = get_db_connection()
        conn.execute('''
            UPDATE people 
            SET name = ?, email = ?, gender = ?, fam_status = ?, send_bd_sms = ?
            WHERE id = ?
        ''', (name, email, gender, fam_status, send_bd_sms, person_id))
        
        conn.commit()
        conn.close()
        
        return jsonify({'success': True, 'message': 'Дані успішно оновлено'})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500
        
        
    
# --- API ДЛЯ ФОТО (BLOB) ---
@app.route('/api/photos/<int:people_id>', methods=['GET'])
@login_required
def get_photos(people_id):
    conn = get_db_connection()
    # Беремо лише id та опис. Саме фото завантажимо окремим маршрутом
    photos = conn.execute('SELECT photo_id, descr FROM photos WHERE people_id = ?', (people_id,)).fetchall()
    conn.close()
    return jsonify([dict(row) for row in photos])

# Маршрут для відображення фото (використовується в тегу <img>)
@app.route('/api/photo_file/<int:photo_id>')
@login_required
def get_photo_file(photo_id):
    conn = get_db_connection()
    row = conn.execute('SELECT photo FROM photos WHERE photo_id = ?', (photo_id,)).fetchone()
    conn.close()
    
    if row and row['photo']:
        # Повертаємо бінарні дані як файл
        return send_file(
            io.BytesIO(row['photo']),
            mimetype='image/jpeg'
        )
    return "Фото не знайдено", 404

@app.route('/api/photos', methods=['POST'])
@login_required
def add_photo():
    if 'photo' not in request.files:
        return jsonify({'error': 'Файл не знайдено'}), 400
    
    file = request.files['photo']
    people_id = request.form.get('people_id')
    descr = request.form.get('descr', '')
    
    photo_blob = file.read() # Читаємо файл у бінарний формат

    try: 
        conn = get_db_connection()
        conn.execute(
            'INSERT INTO photos (people_id, photo, descr) VALUES (?, ?, ?)',
            (people_id, photo_blob, descr)
        )
        conn.commit()
        conn.close()
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/photos/<int:photo_id>', methods=['DELETE'])
@login_required
def delete_photo(photo_id):
    try:
        conn = get_db_connection()
        conn.execute('DELETE FROM photos WHERE photo_id = ?', (photo_id,))
        conn.commit()
        conn.close()
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/photos/<int:photo_id>', methods=['PUT'])
@login_required
def replace_photo(photo_id):
    if 'photo' not in request.files:
        return jsonify({'error': 'Файл не отримано'}), 400
    
    file = request.files['photo']
    photo_blob = file.read()

    try:
        conn = get_db_connection()
        conn.execute('UPDATE photos SET photo = ? WHERE photo_id = ?', (photo_blob, photo_id))
        conn.commit()
        conn.close()
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500
            
@app.route('/api/admin/db/download')
@login_required # Доступ тільки для авторизованих
def download_db():
    try:
        if os.path.exists(DB_PATH):
            return send_file(
                DB_PATH,
                as_attachment=True,
                download_name='_grace_backup.sqlite'
            )
        return jsonify({'error': 'Файл бази не знайдено'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/db/upload', methods=['POST'])
@login_required
def upload_db():
    if 'db_file' not in request.files:
        return jsonify({'error': 'Файл не отримано'}), 400
    
    file = request.files['db_file']
    
    try:
        # Зберігаємо у тимчасовий файл, щоб не пошкодити базу, якщо завантаження перерветься
        temp_path = DB_PATH + ".tmp"
        file.save(temp_path)
        
        # Замінюємо основний файл бази новим
        os.replace(temp_path, DB_PATH)
        
        return jsonify({'success': True, 'message': 'База даних успішно оновлена!'})
    except Exception as e:
        if os.path.exists(temp_path): os.remove(temp_path)
        return jsonify({'error': str(e)}), 500

import pdfkit
import io

# Допоміжна функція для побудови SQL на основі фільтрів
def build_filter_query(args):
    filters = []
    params = []
    
    # Текстові фільтри
    mapping = {'name': 'p.name', 'phone': 'p.Mobile_Phone', 'address': 'p.address'}
    for key, column in mapping.items():
        val = args.get(key)
        if val:
            filters.append(f"{column} LIKE ?")
            params.append(f"%{val}%")
            
    # Фільтри-списки (через чекбокси)
    list_filters = {
        'gender_status[]': 'p.gender',
        'church_status[]': 'p.church_status',
        'family_status[]': 'p.fam_status'
    }
    for key, column in list_filters.items():
        ids = args.getlist(key)
        if ids:
            placeholders = ','.join(['?'] * len(ids))
            filters.append(f"{column} IN ({placeholders})")
            params.extend(ids)
            
    filter_sql = " AND ".join(filters) if filters else "1=1"
    return filter_sql, params

import base64
import io
from datetime import datetime
from flask import request, render_template, send_file
import pdfkit

@app.route('/api/people/export_pdf')
@login_required
def export_pdf():
    # 1. Отримуємо параметри фільтрації та нові параметри налаштування
    filter_sql, params = build_filter_query(request.args)
    
    photo_size_key = request.args.get('photo_size', 'medium')  # За замовчуванням середній
    header_filters = request.args.get('header_filters', 'Всі записи') # Другий рядок заголовка

    # 2. Мапінг розмірів для передачі в CSS шаблону
    # Відповідає розмірам, які ми показували в модальному вікні (Прев'ю)
    size_configs = {
        'small':  {'img_w': '20mm', 'img_h': '25mm', 'font': '10px', 'card_h': '30mm'},
        'medium': {'img_w': '30mm', 'img_h': '35mm', 'font': '11px', 'card_h': '40mm'},
        'large':  {'img_w': '45mm', 'img_h': '55mm', 'font': '12px', 'card_h': '60mm'}
    }
    pdf_style = size_configs.get(photo_size_key, size_configs['medium'])

    conn = get_db_connection()
    # Запит з урахуванням фільтрів та сортуванням (Українська локаль)
    query = f'''
        SELECT DISTINCT p.*, 
               fl.list_name as family_text,
               ch.list_name as church_text,
               ph.photo
        FROM people p
        LEFT JOIN list_family_status fl ON p.fam_status = fl.id
        LEFT JOIN list_church_status ch ON p.church_status = ch.id
        LEFT JOIN photos ph ON p.id = ph.people_id
        WHERE {filter_sql}
        ORDER BY p.name COLLATE UKRAINIAN_CUSTOM ASC
    '''
    rows = conn.execute(query, params).fetchall()
    conn.close()

    people_data = []
    for row in rows:
        item = dict(row)
        
        # 1. Збираємо всі наявні номери в один список
        phone_fields = ['Mobile_Phone', 'Home_phone', 'Work_phone', 'Mobile_Phone_a']
        formatted_phones = []
        
        for field in phone_fields:
            val = item.get(field)
            if val:
                formatted = format_phone_py(val)
                if formatted:
                    formatted_phones.append(formatted)
        
        # 2. Об'єднуємо їх через кому для виводу в PDF
        # Створюємо новий ключ 'phones_display', який ви використаєте в HTML-шаблоні
        item['phones_display'] = ", ".join(formatted_phones)                
        if item['notes']:
            if  len(item['notes']) < 2:
                 item['notes'] = ''
                 
        if item['photo']:
            item['photo_b64'] = base64.b64encode(item['photo']).decode('utf-8')
        people_data.append(item)

    print(f"Кількість людей для PDF: {len(people_data)}")
    #for p in people_data:
    #    print(f"ID: {p['id']}, Name: {p['name']}")

    # 3. Рендеринг шаблону з новими змінними
    html_out = render_template('pdf_report.html', 
                               people=people_data, 
                               header_filters=header_filters, # Опис фільтрів під назвою
                               pdf_style=pdf_style,           # Об'єкт зі стилями
                               today=datetime.now().strftime('%d.%m.%Y'),
                               total=len(people_data))

    # 4. Налаштування PDF
    options = {
        'page-size': 'A4',
        'encoding': "UTF-8",
        'margin-top': '15mm',
        'margin-bottom': '15mm',
        'margin-left': '10mm',
        'margin-right': '10mm',
        'no-outline': None,
        'enable-local-file-access': None,
        'quiet': '' # щоб не забивати лог сервера
    }
    
    # Генерація
    pdf = pdfkit.from_string(html_out, False, options=options)
    
    return send_file(
        io.BytesIO(pdf),
        mimetype='application/pdf',
        as_attachment=True,
        download_name=f'Report_{datetime.now().strftime("%Y-%m-%d_%H%M")}.pdf'
    )        

# Декоратор для перевірки ролей
def role_required(*roles):
    def wrapper(fn):
        @wraps(fn)
        def decorated_view(*args, **kwargs):
            if not session.get('user') or session.get('user').get('role') not in roles:
                return jsonify({"success": False, "message": "Недостатньо прав"}), 403
            return fn(*args, **kwargs)
        return decorated_view
    return wrapper


def format_phone_py(phone):
    if not phone: return ""
    
    # Залишаємо тільки цифри
    digits = "".join(filter(str.isdigit, str(phone)))

    # Нормалізація до формату 097... (10 цифр)
    if len(digits) == 12 and digits.startswith('380'):
        digits = digits[2:]
    elif len(digits) == 11 and digits.startswith('80'):
        digits = digits[1:]
    elif len(digits) == 9:
        digits = '0' + digits

    # Форматування мобільного
    if len(digits) == 10:
        return f"{digits[:3]}-{digits[3:6]}-{digits[6:8]}-{digits[8:]}"
    # Форматування міського
    elif len(digits) == 6:
        return f"{digits[:2]}-{digits[2:4]}-{digits[4:]}"
    
    return str(phone)    
        
if __name__ == '__main__':
    app.run(debug=True)
