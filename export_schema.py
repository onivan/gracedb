import sqlite3
import hashlib
import os

# Налаштування шляхів (відносно папки проекту)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, 'database', '_grace.sqlite')
SCHEMA_PATH = os.path.join(BASE_DIR, 'schema.sql')

def get_current_schema_sql(db_path):
    """Витягує повну схему бази даних у форматі SQL тексту."""
    if not os.path.exists(db_path):
        print(f"Помилка: Файл бази даних не знайдено за шляхом {db_path}")
        return None
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Отримуємо всі SQL команди створення об'єктів (таблиці, індекси, тригери)
    # sqlite_master містить метадані бази даних
    cursor.execute("""
        SELECT sql 
        FROM sqlite_master 
        WHERE sql IS NOT NULL 
        ORDER BY type, name
    """)
    
    schema_parts = [row[0] + ";" for row in cursor.fetchall()]
    conn.close()
    
    return "\n\n".join(schema_parts)

def export_if_changed():
    current_sql = get_current_schema_sql(DB_PATH)
    if current_sql is None:
        return

    # Додаємо заголовок з датою
    header = f"-- Схема згенерована автоматично: {sqlite3.datetime.datetime.now()}\n"
    full_content = header + current_sql

    # Перевіряємо, чи існує старий файл і чи змінився його зміст
    should_write = True
    if os.path.exists(SCHEMA_PATH):
        with open(SCHEMA_PATH, 'r', encoding='utf-8') as f:
            old_content = f.read()
            
        # Порівнюємо тільки SQL частину (ігноруючи заголовок з датою)
        # Або просто порівнюємо хеші всього вмісту без першого рядка
        old_sql_only = "\n".join(old_content.splitlines()[1:])
        current_sql_only = "\n".join(full_content.splitlines()[1:])
        
        if hashlib.md5(old_sql_only.encode()).hexdigest() == hashlib.md5(current_sql_only.encode()).hexdigest():
            should_write = False

    if should_write:
        with open(SCHEMA_PATH, 'w', encoding='utf-8') as f:
            f.write(full_content)
        print(f"✅ Схему оновлено у файлі: {SCHEMA_PATH}")
    else:
        print("ℹ️ Змін у схемі не виявлено. Файл не оновлювався.")

if __name__ == "__main__":
    export_if_changed()
