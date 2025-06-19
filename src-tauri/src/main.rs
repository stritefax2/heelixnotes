// Prevents additional console window on Windows in release!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::env;
use std::sync::Arc;
use std::fs::{File, remove_file};
use std::io::Write;
use std::path::{Path, PathBuf};


use lazy_static::lazy_static;
use log::info;
use rusqlite::Connection;
use rusqlite::params;
#[cfg(target_os = "windows")]
use sysinfo::{System, Pid};
use serde_derive::Serialize;
use tauri::{AppHandle, Manager, State};
use tauri::{menu::{Menu, MenuItem}, tray::TrayIconBuilder, tray::TrayIconEvent};
use tauri_plugin_log::{Target, TargetKind};
use tokio::sync::Mutex;

use configuration::settings::Settings;

use crate::bootstrap::{fix_path_env, prerequisites, setup_directories};
use crate::configuration::database;
use crate::configuration::database::drop_database_handle;
use crate::configuration::state::{AppState, ServiceAccess};
use crate::engine::chat_engine::{name_conversation, send_prompt_to_llm};
use crate::engine::chat_engine_openai::{generate_conversation_name, send_prompt_to_openai};
use crate::engine::chat_engine_gemini::{name_conversation_gemini, send_prompt_to_gemini};
use crate::engine::chat_engine_local::{send_prompt_to_local, name_conversation_local};
use crate::engine::clean_up_engine::clean_up;
use crate::engine::similarity_search_engine::SyncSimilaritySearch;
use crate::entity::chat_item::{Chat, StoredMessage};
use crate::entity::permission::Permission;
use crate::entity::project::Project;
use crate::entity::setting::Setting;
use crate::permissions::permission_engine::init_permissions;
use crate::repository::activity_log_repository;
use crate::repository::chat_db_repository;
use crate::repository::permissions_repository::{get_permissions, update_permission};
use crate::repository::project_repository::{
    delete_project, fetch_all_projects, add_blank_document, save_project, update_project, 
    get_activity_text_from_project, get_activity_plain_text_from_project, update_activity_text, update_activity_name, delete_project_document, 
    ensure_unassigned_project, move_document_to_project, mark_document_as_vectorized,
};
use crate::repository::settings_repository::{get_setting, get_settings, update_setting_async};
use tauri_plugin_autostart::MacosLauncher;
use tauri_plugin_shell::init as shell_init;
use tauri_plugin_dialog::init as dialog_init;
use tauri_plugin_fs::init as fs_init;
use tauri_plugin_os::init as os_init;

mod bootstrap;
mod configuration;
mod engine;
mod entity;
mod monitoring;
pub mod permissions;
mod repository;
pub mod window_details_collector;

#[derive(Clone, Serialize)]
struct Payload {
    data: bool,
}

#[cfg(debug_assertions)]
const USE_LOCALHOST_SERVER: bool = true;
#[cfg(not(debug_assertions))]
const USE_LOCALHOST_SERVER: bool = false;

lazy_static! {
    static ref HNSW: SyncSimilaritySearch = Arc::new(Mutex::new(None));
    static ref LOCK_FILE_PATH: std::sync::Mutex<Option<PathBuf>> = std::sync::Mutex::new(None);
}

//#[cfg(any(target_os = "macos"))]
//static ACCESSIBILITY_PERMISSIONS_GRANTED: AtomicBool = AtomicBool::new(false);

fn check_single_instance() -> Result<PathBuf, String> {
    let temp_dir = std::env::temp_dir();
    let lock_file = temp_dir.join("heelix_notes.lock");
    
    // Check if lock file exists and contains a valid PID
    if lock_file.exists() {
        if let Ok(content) = std::fs::read_to_string(&lock_file) {
            if let Ok(pid) = content.trim().parse::<u32>() {
                // Check if process is still running
                #[cfg(target_os = "windows")]
                {
                    let mut system = System::new_all();
                    system.refresh_processes();
                    if system.process(Pid::from_u32(pid)).is_some() {
                        return Err("Another instance is already running".to_string());
                    }
                }
                #[cfg(not(target_os = "windows"))]
                {
                    // On Unix-like systems, check if process exists
                    if std::process::Command::new("ps")
                        .arg("-p")
                        .arg(pid.to_string())
                        .output()
                        .map(|output| output.status.success())
                        .unwrap_or(false)
                    {
                        return Err("Another instance is already running".to_string());
                    }
                }
            }
        }
        // If we can't read the file or PID is invalid, remove the stale lock file
        let _ = remove_file(&lock_file);
    }
    
    // Create new lock file with current PID
    let current_pid = std::process::id();
    std::fs::write(&lock_file, current_pid.to_string())
        .map_err(|e| format!("Failed to create lock file: {}", e))?;
    
    Ok(lock_file)
}

fn cleanup_lock_file() {
    if let Ok(mut path) = LOCK_FILE_PATH.lock() {
        if let Some(lock_path) = path.take() {
            let _ = remove_file(lock_path);
        }
    }
}

#[tokio::main]
async fn main() {
    // Check for single instance before initializing anything else
    let lock_file_path = match check_single_instance() {
        Ok(path) => path,
        Err(e) => {
            eprintln!("Error: {}", e);
            std::process::exit(1);
        }
    };
    
    // Store lock file path for cleanup
    if let Ok(mut path) = LOCK_FILE_PATH.lock() {
        *path = Some(lock_file_path);
    }

    let port = 5173;
    let builder = tauri::Builder::default();

    fix_path_env::fix_all_vars().expect("Failed to load env");

    let mut context = tauri::generate_context!();

    let url = format!("http://localhost:{}", port).parse().unwrap();

    if USE_LOCALHOST_SERVER == true {
        context.config_mut().build.dev_url = Some(url);
    }

    builder
        .plugin(
            tauri_plugin_log::Builder::default()
                .targets([
                    Target::new(TargetKind::Stdout),
                    Target::new(TargetKind::Webview),
                ])
                .build(),
        )
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            Some(vec!["--minimized"]),
        ))
        .plugin(shell_init())
        .plugin(dialog_init())
        .plugin(fs_init())
        .plugin(os_init())
        .on_menu_event(|app, event| {
            match event.id().as_ref() {
                "quit" => {
                    cleanup_lock_file();
                    app.exit(0);
                }
                _ => {}
            }
        })
        .invoke_handler(tauri::generate_handler![
            update_settings,
            get_latest_settings,
            send_prompt_to_llm,
            send_prompt_to_openai,
            send_prompt_to_gemini,
            send_prompt_to_local,
            generate_conversation_name,
            name_conversation_gemini,
            name_conversation,
            name_conversation_local,
            create_chat,
            get_all_chats,
            create_message,
            get_messages_by_chat_id,
            update_chat_name,
            update_app_permissions,
            get_app_permissions,
            get_projects,
            save_app_project,
            update_app_project,
            delete_app_project,
            delete_chat,
            get_activity_history,
            delete_activity,
            get_activity_full_text_by_id,
            get_app_project_activity_text,
            get_app_project_activity_plain_text,
            update_project_activity_text,
            add_project_blank_activity,
            update_project_activity_name,
            delete_project_activity,
            ensure_unassigned_activity,
            update_project_activity_content,
            save_audio_file,
            transcribe_audio,
            start_audio_recording,
            stop_audio_recording,
            read_audio_file,
            get_openai_api_key,
            extract_document_text,
        ])
        .manage(AppState {
            db: Default::default(),
        })
        .on_window_event(|window, event| {
            match event {
                tauri::WindowEvent::CloseRequested { api, .. } => {
                    api.prevent_close();
                    if let Err(_e) = window.hide() {
                        // Error hiding window on close request
                    }
                }
                tauri::WindowEvent::Focused(_focused) => {
                    // Window focus changed
                }
                _ => {
                    // Other window event
                }
            }
        })
        .setup(move |app| {
            let args: Vec<String> = env::args().collect();
            let should_start_minimized = args.contains(&"--minimized".to_string());

            // Build tray menu
            let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&quit])?;

            // Build tray icon with unique ID to prevent duplicates
            let tray_icon = tauri::image::Image::from_path("icons/icon_64.png")
                .unwrap_or_else(|_| app.default_window_icon().unwrap().clone());
            
            let tray = TrayIconBuilder::with_id("heelix-main-tray")
                .menu(&menu)
                .icon(tray_icon)
                .on_tray_icon_event(|tray, event| {
                    match event {
                        TrayIconEvent::Click { button, button_state, .. } => {
                            // Only handle the button UP event to avoid double-clicking behavior
                             if button == tauri::tray::MouseButton::Left && button_state == tauri::tray::MouseButtonState::Up {
                                 let app = tray.app_handle();
                                 if let Some(window) = app.get_webview_window("main") {
                                     let is_visible = window.is_visible().unwrap_or(false);
                                     let is_minimized = window.is_minimized().unwrap_or(false);
                                     let is_focused = window.is_focused().unwrap_or(false);
                                     
                                     // If window is hidden OR minimized OR not focused, show and focus it
                                     if !is_visible || is_minimized || !is_focused {
                                         // First, make sure window is visible
                                         if let Err(_e) = window.show() {
                                             // Error showing window
                                         }
                                         
                                         // Unminimize if needed
                                         if is_minimized {
                                             if let Err(_e) = window.unminimize() {
                                                 // Error unminimizing window
                                             }
                                         }
                                         
                                         // Bring to front and focus
                                         if let Err(_e) = window.set_focus() {
                                             // Error setting focus
                                         }
                                         
                                         // Temporarily set always on top to ensure it comes to foreground
                                         let _ = window.set_always_on_top(true);
                                         std::thread::sleep(std::time::Duration::from_millis(100));
                                         let _ = window.set_always_on_top(false);
                                         
                                     } else {
                                         // Window is visible, focused, and not minimized - hide it
                                         if let Err(_e) = window.hide() {
                                             // Error hiding window
                                         }
                                     }
                                 }
                             }
                        }
                        _ => {}
                    }
                })
                .build(app)?;
            
            // Store tray reference to ensure proper cleanup
            app.manage(tray);

            let window = app.get_webview_window("main").unwrap();

            if should_start_minimized {
                window.hide().unwrap();
            } else {
                window.show().unwrap();
            }

            let app_handle = app.handle();
            let _ = setup_directories::setup_dirs(
                app_handle
                    .path()
                    .app_data_dir()
                    .unwrap()
                    .to_str()
                    .unwrap(),
            );
            prerequisites::check_and_install_prerequisites(
                app_handle
                    .path()
                    .resource_dir()
                    .unwrap()
                    .to_str()
                    .unwrap(),
            );
            clean_up(app_handle.path().app_data_dir().unwrap());
            setup_keypress_listener(&app_handle);
            init_app_permissions(app_handle.clone());
            Ok(())
        })
        .run(context)
        .expect("error while running tauri application");
    
    // Cleanup lock file on normal exit
    cleanup_lock_file();
    drop_database_handle().await;
}

fn setup_keypress_listener(app_handle: &AppHandle) {
    let app_state: State<AppState> = app_handle.state();

    let db: Connection =
        database::initialize_database(&app_handle).expect("Database initialization failed!");
    *app_state.db.lock().unwrap() = Some(db);
}

#[tauri::command]
fn get_latest_settings(app_handle: AppHandle) -> Result<Vec<Setting>, ()> {
    let settings = app_handle.db(|db| get_settings(db).unwrap());
    return Ok(settings);
}

#[tauri::command]
async fn update_settings(app_handle: AppHandle, settings: Settings) {
    info!("update_settings: {:?}", settings);

    // Update interval
    update_setting_async(
        &app_handle,
        Setting {
            setting_key: String::from("interval"),
            setting_value: format!("{}", settings.interval),
        },
    ).await.unwrap_or(());

    // Update is_dev_mode
    update_setting_async(
        &app_handle,
        Setting {
            setting_key: String::from("is_dev_mode"),
            setting_value: format!("{}", settings.is_dev_mode),
        },
    ).await.unwrap_or(());

    // Update auto_start
    update_setting_async(
        &app_handle,
        Setting {
            setting_key: String::from("auto_start"),
            setting_value: format!("{}", settings.auto_start),
        },
    ).await.unwrap_or(());

    // Update api_choice
    update_setting_async(
        &app_handle,
        Setting {
            setting_key: String::from("api_choice"),
            setting_value: format!("{}", settings.api_choice),
        },
    ).await.unwrap_or(());

    // Update api_key_claude
    update_setting_async(
        &app_handle,
        Setting {
            setting_key: String::from("api_key_claude"),
            setting_value: format!("{}", settings.api_key_claude),
        },
    ).await.unwrap_or(());

    // Update api_key_open_ai
    update_setting_async(
        &app_handle,
        Setting {
            setting_key: String::from("api_key_open_ai"),
            setting_value: format!("{}", settings.api_key_open_ai),
        },
    ).await.unwrap_or(());
    
    // Update api_key_gemini
    update_setting_async(
        &app_handle,
        Setting {
            setting_key: String::from("api_key_gemini"),
            setting_value: format!("{}", settings.api_key_gemini),
        },
    ).await.unwrap_or(());
    
    // Update local_endpoint_url
    update_setting_async(
        &app_handle,
        Setting {
            setting_key: String::from("local_endpoint_url"),
            setting_value: format!("{}", settings.local_endpoint_url),
        },
    ).await.unwrap_or(());
    
    // Update local_model_name
    update_setting_async(
        &app_handle,
        Setting {
            setting_key: String::from("local_model_name"),
            setting_value: format!("{}", settings.local_model_name),
        },
    ).await.unwrap_or(());
    
    // Update vectorization_enabled
    update_setting_async(
        &app_handle,
        Setting {
            setting_key: String::from("vectorization_enabled"),
            setting_value: format!("{}", settings.vectorization_enabled),
        },
    ).await.unwrap_or(());
}

#[tauri::command]
fn init_app_permissions(app_handle: AppHandle) {
    init_permissions(app_handle);
}

#[tauri::command]
fn update_app_permissions(app_handle: AppHandle, app_path: String, allow: bool) {
    app_handle.db(|database| {
        update_permission(database, app_path, allow).expect("Failed to update permission");
    })
}

#[tauri::command]
fn get_app_permissions(app_handle: AppHandle) -> Result<Vec<Permission>, ()> {
    let permissions = app_handle.db(|database| get_permissions(database).unwrap());
    return Ok(permissions);
}

#[tauri::command]
fn get_projects(app_handle: AppHandle) -> Result<Vec<Project>, ()> {
    let projects = app_handle.db(|database| fetch_all_projects(database).unwrap());
    return Ok(projects);
}

#[tauri::command]
fn save_app_project(
    app_handle: AppHandle,
    name: &str,
    activities: Vec<i64>,
) -> Result<Vec<i64>, ()> {
    app_handle.db(|database| save_project(database, name, &activities).unwrap());
    return Ok(activities);
}

#[tauri::command]
fn update_app_project(
    app_handle: AppHandle,
    id: i64,
    name: &str,
    activities: Vec<i64>,
) -> Result<Vec<i64>, ()> {
    app_handle.db(|database| update_project(database, id, name, &activities).unwrap());
    return Ok(activities);
}

#[tauri::command]
fn delete_app_project(app_handle: AppHandle, project_id: i64) -> Result<i64, ()> {
    app_handle.db(|database| delete_project(database, project_id).unwrap());
    return Ok(project_id);
}

#[tauri::command]
fn create_chat(app_handle: AppHandle, name: &str) -> Result<i64, String> {
    app_handle
        .db(|db| chat_db_repository::create_chat(db, name))
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn get_all_chats(app_handle: AppHandle) -> Result<Vec<Chat>, String> {
    app_handle
        .db(|db| chat_db_repository::get_all_chats(db))
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn create_message(
    app_handle: AppHandle,
    chat_id: i64,
    role: &str,
    content: &str,
) -> Result<i64, String> {
    app_handle
        .db(|db| chat_db_repository::create_message(db, chat_id, role, content))
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn get_messages_by_chat_id(
    app_handle: AppHandle,
    chat_id: i64,
) -> Result<Vec<StoredMessage>, String> {
    app_handle
        .db(|db| chat_db_repository::get_messages_by_chat_id(db, chat_id))
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn update_chat_name(app_handle: AppHandle, chat_id: i64, name: &str) -> Result<bool, String> {
    app_handle
        .db(|db| chat_db_repository::update_chat(db, chat_id, name))
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_chat(app_handle: AppHandle, chat_id: i64) -> Result<bool, String> {
    app_handle
        .db(|db| chat_db_repository::delete_chat(db, chat_id))
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn get_activity_history(
    app_handle: AppHandle,
    offset: usize,
    limit: usize,
) -> Result<Vec<(i64, String, String)>, String> {
    app_handle
        .db(|db: &Connection| {
            crate::activity_log_repository::get_activity_history(db, offset, limit)
        })
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_activity(app_handle: AppHandle, id: i64) -> Result<bool, String> {
    app_handle
        .db(|db: &Connection| crate::activity_log_repository::delete_activity(db, id))
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn get_activity_full_text_by_id(
    app_handle: tauri::AppHandle,
    id: i64,
) -> Result<Option<(String, String)>, String> {
    app_handle
        .db(|db| crate::activity_log_repository::get_activity_full_text_by_id(db, id, None))
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn get_app_project_activity_text(
    app_handle: AppHandle,
    activity_id: i64,
) -> Result<Option<(String, String)>, String> {
    app_handle
        .db(|database| get_activity_text_from_project(database, activity_id))
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn get_app_project_activity_plain_text(
    app_handle: AppHandle,
    activity_id: i64,
) -> Result<Option<(String, String)>, String> {
    app_handle
        .db(|database| get_activity_plain_text_from_project(database, activity_id))
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn update_project_activity_content(
    app_handle: AppHandle,
    document_id: i64,
    target_project_id: i64,
) -> Result<(), String> {
    app_handle
        .db(|database| {
            move_document_to_project(database, document_id, target_project_id)
                .map_err(|e| e.to_string())
        })
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn update_project_activity_text(
    app_handle: AppHandle,
    activity_id: i64,
    text: &str,
) -> Result<(), String> {
    info!("Updating text for project activity ID: {}, length: {}", activity_id, text.len());
    
    // Update the document text and check if vectorization is needed
    let needs_vectorization = app_handle
        .db(|db| update_activity_text(db, activity_id, text))
        .map_err(|e| e.to_string())?;
    
    if needs_vectorization {
        info!("Document ID: {} meets conditions for vectorization, checking settings", activity_id);
        
        // Check if vectorization is enabled in settings
        let setting_result = app_handle
            .db(|db| get_setting(db, "vectorization_enabled"));
        
        let vectorization_enabled = match setting_result {
            Ok(setting) => setting.setting_value == "true",
            Err(_) => true // Default to enabled if setting doesn't exist
        };
        
        // Get API key
        let api_key_result = app_handle
            .db(|db| get_setting(db, "api_key_open_ai"))
            .map_err(|e| e.to_string());
        
        let api_key = match api_key_result {
            Ok(setting) => setting.setting_value,
            Err(_) => String::new()
        };
        
        // Only proceed with vectorization if it's enabled and API key exists
        if !vectorization_enabled {
            info!("Vectorization disabled in settings, skipping for document ID: {}", activity_id);
            return Ok(());
        }
        
        // Skip if API key is missing or empty
        if api_key.is_empty() {
            info!("API key missing or empty, skipping vectorization for document ID: {}", activity_id);
            return Ok(());
        }
        
        // Get document name for vector DB
        let document_name = app_handle
            .db(|db| {
                db.query_row(
                    "SELECT document_name FROM projects_activities WHERE id = ?1",
                    params![activity_id],
                    |row| row.get::<_, String>(0)
                )
            })
            .map_err(|e| e.to_string())?;
        
        // Initialize vector DB - exactly as in record_single_activity
        info!("Initializing vector database for document ID: {}", activity_id);
        let mut oasys_db = database::get_vector_db(&app_handle)
            .await
            .expect("Database initialization failed!");
        
        // Add to vector DB
        info!("Adding document ID: {} to vector DB", activity_id);
        activity_log_repository::save_project_document_into_vector_db(
            &mut oasys_db,
            activity_id,
            &document_name,
            text,
            &api_key,
        )
        .await
        .unwrap_or(());
        
        // Mark as vectorized
        app_handle
            .db(|db| mark_document_as_vectorized(db, activity_id))
            .map_err(|e| e.to_string())?;
        
        info!("Successfully vectorized document ID: {}", activity_id);
    } else {
        info!("Document ID: {} does not need vectorization", activity_id);
    }
    
    Ok(())
}

#[tauri::command]
fn add_project_blank_activity(
    app_handle: AppHandle,
    project_id: i64,
) -> Result<i64, String> {
    app_handle
        .db(|db| add_blank_document(db, project_id))
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn ensure_unassigned_activity(app_handle: AppHandle) -> Result<i64, String> {
  app_handle
    .db(|db| {
      // First ensure unassigned project exists
      let unassigned_project_id = ensure_unassigned_project(db)?;
      // Then add blank document to it
      add_blank_document(db, unassigned_project_id)
    })
    .map_err(|e| e.to_string())
}

#[tauri::command]
fn update_project_activity_name(
    app_handle: AppHandle,
    activity_id: i64,
    name: &str,
) -> Result<(), String> {
    app_handle
        .db(|db| update_activity_name(db, activity_id, name))
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_project_activity(
    app_handle: AppHandle,
    activity_id: i64,
) -> Result<(), String> {
    app_handle
        .db(|db| delete_project_document(db, activity_id))
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn save_audio_file(
    app_handle: AppHandle,
    file_path: String,
    audio_data: Vec<u8>,
) -> Result<(), String> {
    // Ensure the directory exists
    if let Some(parent) = Path::new(&file_path).parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    
    // Write the audio data to the file
    let mut file = File::create(&file_path).map_err(|e| e.to_string())?;
    file.write_all(&audio_data).map_err(|e| e.to_string())?;
    
    Ok(())
}

#[tauri::command]
async fn transcribe_audio(
    app_handle: AppHandle,
    file_path: String,
) -> Result<String, String> {
    // Get the OpenAI API key from settings
    let openai_api_key = app_handle
        .db(|db| get_setting(db, "api_key_open_ai"))
        .map_err(|e| e.to_string())?
        .setting_value;
    
    if openai_api_key.is_empty() {
        return Err("OpenAI API key is required for audio transcription".to_string());
    }
    
    // Set the environment variable for the transcription engine
    std::env::set_var("OPENAI_API_KEY", &openai_api_key);
    
    // Check file size
    let metadata = std::fs::metadata(&file_path).map_err(|e| format!("Failed to get file metadata: {}", e))?;
    let file_size = metadata.len();
    
    // 20MB is a reasonable threshold considering OpenAI's 25MB limit
    const CHUNK_SIZE_THRESHOLD: u64 = 20 * 1024 * 1024; 
    
    if file_size > CHUNK_SIZE_THRESHOLD {
        // Use chunking with OpenAI's Whisper
        let transcription = crate::engine::audio_engine::chunk_and_transcribe_with_openai(&file_path, &openai_api_key).await
            .map_err(|e| e.to_string())?;
        
        // Cleanup the original file
        if let Err(_err) = std::fs::remove_file(&file_path) {
            // Warning: Failed to delete audio file
        }
        
        Ok(transcription)
    } else {
        // Standard approach for smaller files
        let transcription = crate::engine::transcription_engine::transcribe_with_openai(
            &file_path,
            &openai_api_key,
        )
        .await
        .map_err(|e| e.to_string())?;
            
        if let Err(_err) = std::fs::remove_file(&file_path) {
            // Warning: Failed to delete audio file
        }
        
        Ok(transcription)
    }
}

#[tauri::command]
async fn start_audio_recording(_app_handle: AppHandle) -> Result<String, String> {
    // Use the relocated function from audio_engine
    crate::engine::audio_engine::start_recording().await
}

#[tauri::command]
async fn stop_audio_recording() -> Result<String, String> {
    // Use the relocated function from audio_engine
    crate::engine::audio_engine::stop_recording().await
}

#[tauri::command]
fn read_audio_file(file_path: String) -> Result<Vec<u8>, String> {
    // Use the relocated function from audio_engine
    crate::engine::audio_engine::read_audio_file(&file_path)
}

#[tauri::command]
fn get_openai_api_key(app_handle: AppHandle) -> Result<serde_json::Value, String> {
    // Get the OpenAI API key from settings
    let api_key = app_handle
        .db(|db| get_setting(db, "api_key_open_ai"))
        .map_err(|e| e.to_string())?
        .setting_value;
    
    // Return as a JSON object
    let response = serde_json::json!({
        "api_key_open_ai": api_key
    });
    
    Ok(response)
}

#[tauri::command]
async fn extract_document_text(file_path: String) -> Result<String, String> {
    // Determine file type based on extension
    let path = Path::new(&file_path);
    let extension = path.extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| ext.to_lowercase())
        .unwrap_or_default();
    
    match extension.as_str() {
        "pdf" => extract_text_from_pdf(&file_path),
        "docx" => extract_text_from_docx(&file_path),
        "txt" | "md" | "rtf" => read_text_file(&file_path),
        _ => Err(format!("Unsupported file format: {}", extension))
    }
}

fn extract_text_from_pdf(file_path: &str) -> Result<String, String> {
    // Use the pdf-extract crate to extract text from PDFs
    match pdf_extract::extract_text(file_path) {
        Ok(text) => Ok(text),
        Err(err) => Err(format!("Failed to extract text from PDF: {}", err))
    }
}

fn extract_text_from_docx(file_path: &str) -> Result<String, String> {
    // Create a simple fallback message for now
    let bytes = std::fs::read(file_path).map_err(|e| e.to_string())?;
    
    // For now, we'll use a more basic approach for DOCX files
    // This is a temporary solution until we can properly integrate docx-rs
    // or find an alternative library
    let content = String::from_utf8_lossy(&bytes);
    
    // Look for text content within XML elements
    let mut extracted_text = String::new();
    let mut in_text = false;
    let mut current_text = String::new();
    
    for c in content.chars() {
        if c == '<' {
            if !current_text.is_empty() {
                extracted_text.push_str(&current_text);
                extracted_text.push('\n');
                current_text.clear();
            }
            in_text = false;
        } else if c == '>' {
            in_text = true;
        } else if in_text {
            current_text.push(c);
        }
    }
    
    // If we got any useful text
    if !extracted_text.is_empty() {
        Ok(extracted_text)
    } else {
        // Fallback message
        Ok("This DOCX file could not be fully parsed. Please try converting it to a text format first.".to_string())
    }
}

fn read_text_file(file_path: &str) -> Result<String, String> {
    // Simple text file reading
    std::fs::read_to_string(file_path).map_err(|e| e.to_string())
}

