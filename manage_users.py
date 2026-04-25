import sqlite3
import os
import getpass
from werkzeug.security import generate_password_hash

# Налаштування шляхів до бази
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_FOLDER = os.path.join(BASE_DIR, 'database')
DB_PATH = os.path.join(DB_FOLDER, '_grace.sqlite')

def get_db_connection():
    if not os.path.exists(DB_FOLDER):
        os.makedirs(DB_FOLDER)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def list_users():
    """Виводить список усіх користувачів з урахуванням ролей"""
    print("\n--- Список адміністраторів (app_users) ---")
    conn = get_db_connection()
    try:
        users = conn.execute("SELECT id, username, role, created_at FROM app_users").fetchall()
        if not users:
            print("Користувачів не знайдено.")
        else:
            print(f"{'ID':<4} | {'Логін':<15} | {'Роль':<10} | {'Створено'}")
            print("-" * 60)
            for user in users:
                print(f"{user['id']:<4} | {user['username']:<15} | {user['role']:<10} | {user['created_at']}")
    except sqlite3.OperationalError:
        print("Помилка: Таблиця app_users ще не створена.")
    finally:
        conn.close()
    print("-" * 60)

def add_user():
    """Додає нового користувача з вибором ролі"""
    username = input("\nВведіть логін: ").strip()
    if not username: return
    
    password = getpass.getpass("Введіть пароль: ")
    confirm = getpass.getpass("Підтвердіть пароль: ")
    
    if password != confirm:
        print("❌ Помилка: Паролі не збігаються.")
        return

    print("Виберіть роль (1: viewer [default], 2: editor, 3: admin):")
    role_choice = input("Ваш вибір: ")
    
    match role_choice:
        case 1: 
            role = 'viewer'
        case 2: 
            role = 'editor'
        case 3: 
            role = 'admin'
        case _: 
            role = 'viewer'
        
    hashed_pw = generate_password_hash(password)
    try:
        conn = get_db_connection()
        conn.execute(
            "INSERT INTO app_users (username, password_hash, role) VALUES (?, ?, ?)", 
            (username, hashed_pw, role)
        )
        conn.commit()
        print(f"✅ Користувач '{username}' ({role}) успішно доданий.")
    except sqlite3.IntegrityError:
        print("❌ Помилка: Такий логін вже існує.")
    finally:
        conn.close()

def change_password():
    """Оновлює поле password_hash"""
    list_users()
    username = input("\nЛогін для зміни пароля: ").strip()
    if not username: return
    
    new_password = getpass.getpass("Новий пароль: ")
    confirm = getpass.getpass("Підтвердіть: ")
    
    if new_password != confirm:
        print("❌ Помилка: Паролі не збігаються.")
        return

    hashed_pw = generate_password_hash(new_password)
    conn = get_db_connection()
    cur = conn.execute("UPDATE app_users SET password_hash = ? WHERE username = ?", (hashed_pw, username))
    conn.commit()
    
    if cur.rowcount > 0:
        print(f"✅ Пароль для '{username}' оновлено.")
    else:
        print("❌ Помилка: Користувача не знайдено.")
    conn.close()

def delete_user():
    """Видаляє запис за логіном"""
    list_users()
    username = input("\nЛогін для ВИДАЛЕННЯ: ").strip()
    if not username: return
    
    confirm = input(f"⚠️ Видалити '{username}'? (y/n): ")
    if confirm.lower() == 'y':
        conn = get_db_connection()
        cur = conn.execute("DELETE FROM app_users WHERE username = ?", (username,))
        conn.commit()
        if cur.rowcount > 0:
            print(f"🗑️ Користувач '{username}' видалений.")
        else:
            print("❌ Помилка: Користувача не знайдено.")
        conn.close()

def main():
    try:
        while True:
            print("\n=== Grace Admin: Керування доступом (v2.0) ===")
            print("1. Список користувачів")
            print("2. Додати користувача")
            print("3. Змінити пароль")
            print("4. Видалити користувача")
            print("5. Вихід")
            
            choice = input("\nВиберіть дію: ")
            
            if choice == '1': list_users()
            elif choice == '2': add_user()
            elif choice == '3': change_password()
            elif choice == '4': delete_user()
            elif choice == '5': break
    except KeyboardInterrupt:
        print("\n\nВихід...")

if __name__ == "__main__":
    # Створюємо таблицю за вашою схемою, якщо її немає
    conn = get_db_connection()
    conn.execute('''CREATE TABLE IF NOT EXISTS app_users (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        username VARCHAR(50) UNIQUE NOT NULL,
                        password_hash VARCHAR(255) NOT NULL,
                        role VARCHAR(20) DEFAULT 'editor',
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )''')
    conn.close()
    main()
