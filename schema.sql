-- Схема згенерована автоматично: 2026-04-25 09:59:35.977781
CREATE TABLE app_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'editor',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "disabled" ("id" INTEGER PRIMARY KEY  AUTOINCREMENT  NOT NULL , "num" TEXT);

CREATE TABLE fsettings_columns_titles (id INTEGER PRIMARY KEY AUTOINCREMENT UNIQUE NOT NULL, table_name CHAR (50) NOT NULL, column_name TEXT NOT NULL, column_title TEXT, column_ods_width INTEGER DEFAULT (20), column_export BOOLEAN DEFAULT false, list_items_blob BLOB);

CREATE TABLE "fsettings_lists" ("id" INTEGER PRIMARY KEY AUTOINCREMENT UNIQUE NOT NULL, "list_name" CHAR (20) NOT NULL, "list_items" TEXT, "list_items_blob" BLOB);

CREATE TABLE groups (group_id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL UNIQUE, group_type INTEGER DEFAULT (0), group_address CHAR (100), group_notes TEXT, group_name CHAR (50));

CREATE TABLE "list_church_status" ( "id" INTEGER PRIMARY KEY AUTOINCREMENT UNIQUE NOT NULL, "list_name" CHAR (50) NOT NULL);

CREATE TABLE "list_event_type" ( "id" INTEGER PRIMARY KEY AUTOINCREMENT UNIQUE NOT NULL, "list_name" CHAR (50) NOT NULL, "event_change_status_table" CHAR(50), "event_change_status_id" INTEGER);

CREATE TABLE "list_family_status" ( "id" INTEGER PRIMARY KEY AUTOINCREMENT UNIQUE NOT NULL, "list_name" CHAR (50) NOT NULL);

CREATE TABLE "list_gender" ( "id" INTEGER PRIMARY KEY AUTOINCREMENT UNIQUE NOT NULL, "list_name" CHAR (50) NOT NULL);

CREATE TABLE "list_group_status" ( "id" INTEGER PRIMARY KEY AUTOINCREMENT UNIQUE NOT NULL, "list_name" CHAR (50) NOT NULL);

CREATE TABLE "list_group_type" ( "id" INTEGER PRIMARY KEY AUTOINCREMENT UNIQUE NOT NULL, "list_name" CHAR (50) NOT NULL);

CREATE TABLE "month_names" ("id" INTEGER PRIMARY KEY  NOT NULL ,"month_name_ukr" TEXT DEFAULT (null) ,"month_name_ukr_r" TEXT DEFAULT (null) );

CREATE TABLE p_events (id INTEGER PRIMARY KEY NOT NULL, people_id INTEGER NOT NULL REFERENCES people (id) ON DELETE CASCADE, eventdate DATE DEFAULT (1900 - 1 - 1), eventtype INTEGER DEFAULT (0), descr CHAR);

CREATE TABLE people (id INTEGER PRIMARY KEY, name CHAR DEFAULT (''), address CHAR DEFAULT (''), Home_phone INTEGER DEFAULT (''), Work_phone INTEGER DEFAULT (''), Mobile_Phone INTEGER DEFAULT (''), Date_of_Birth DATE DEFAULT (1900 - 1 - 1), gender INTEGER DEFAULT (0), fam_status INTEGER DEFAULT (0), children INTEGER DEFAULT (0), notes TEXT DEFAULT (''), church_status INTEGER DEFAULT (0), Date_of_Bapt DATE DEFAULT (''), Mobile_Phone_a INTEGER DEFAULT (''), email CHAR NOT NULL DEFAULT (''), send_bd_sms BOOLEAN DEFAULT (1));

CREATE TABLE people_to_groups (id INTEGER PRIMARY KEY AUTOINCREMENT UNIQUE NOT NULL, people_id INTEGER NOT NULL REFERENCES people (id) ON DELETE CASCADE, group_id INTEGER NOT NULL REFERENCES groups (group_id) ON DELETE CASCADE, role INTEGER DEFAULT (0));

CREATE TABLE "photos" ("photo_id" INTEGER PRIMARY KEY  NOT NULL ,"people_id" INTEGER NOT NULL  REFERENCES people(id) ON DELETE CASCADE,"photo" BLOB,"descr" CHAR);

CREATE TABLE "photos2" ("photo_id" INTEGER PRIMARY KEY  NOT NULL ,"people_id" INTEGER NOT NULL  REFERENCES grace_people_c(id) ON DELETE CASCADE,"photo" BLOB,"descr" CHAR);

CREATE TABLE sqlite_sequence(name,seq);

CREATE TABLE user_settings (user_id INTEGER,
						setting_key TEXT,
						setting_value TEXT,
						PRIMARY KEY (user_id, setting_key),
						FOREIGN KEY (user_id) REFERENCES app_users(id));