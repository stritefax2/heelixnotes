use crate::configuration::state::ServiceAccess;
use crate::database;
use crate::engine::similarity_search_engine::TOPK;
use crate::repository::activity_log_repository::get_activity_full_text_by_id;
use crate::repository::project_repository::get_activity_text_from_project;
use crate::repository::activity_log_repository::get_additional_ids_from_sql_db;
use crate::repository::settings_repository::get_setting;
use log::{debug, error, info};
use reqwest::{Client, Response};
use serde_derive::{Deserialize, Serialize};
use serde_json;
use std::collections::HashSet;
use std::time::Duration;
use tauri::{AppHandle, Manager, Emitter};

// Constants for Gemini model versions
const GEMINI_URL: &str = "https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:streamGenerateContent";
const GEMINI_MODEL: &str = "gemini-2.5-flash";

#[derive(Serialize, Deserialize)]
pub struct Message {
    role: String,
    content: String,
}

#[derive(Serialize)]
struct GeminiRequest {
    contents: Vec<Content>,
    generationConfig: GenerationConfig,
}

#[derive(Serialize)]
struct Content {
    role: String,
    parts: Vec<Part>,
}

#[derive(Serialize)]
struct Part {
    text: String,
}

#[derive(Serialize)]
struct GenerationConfig {
    maxOutputTokens: usize,
}

#[derive(Deserialize)]
struct GeminiResponse {
    candidates: Vec<Candidate>,
}

#[derive(Deserialize)]
struct Candidate {
    content: CandidateContent,
}

#[derive(Deserialize)]
struct CandidateContent {
    parts: Vec<CandidatePart>,
}

#[derive(Deserialize)]
struct CandidatePart {
    text: String,
}

#[tauri::command]
pub async fn send_prompt_to_gemini(
    app_handle: tauri::AppHandle,
    conversation_history: Vec<Message>,
    is_first_message: bool,
    combined_activity_text: String,
    model_id: Option<String>,
) -> Result<(), String> {
    let setting =
        app_handle.db(|db| get_setting(db, "api_key_gemini").expect("Failed on api_key_gemini"));

    // Configure client with keep-alive and proper timeouts
    let client = Client::builder()
        .timeout(Duration::from_secs(180))
        .tcp_keepalive(Duration::from_secs(60))
        .pool_idle_timeout(Duration::from_secs(90))
        .pool_max_idle_per_host(2)
        .connect_timeout(Duration::from_secs(30))
        .build()
        .map_err(|e| format!("Failed to create client: {}", e))?;

    let model_to_use = match model_id.as_deref() {
        Some("gemini-2.5-flash") => "gemini-2.5-flash",
        _ => "gemini-2.5-flash", // Default to gemini-2.5-flash
    };
    
    let mut filtered_context = String::new();
    let mut window_titles = Vec::new();

    if is_first_message {
        let user_prompt = conversation_history
            .last()
            .map(|msg| msg.content.clone())
            .unwrap_or_default();
        info!("User Prompt: {}", user_prompt);
        
        // Get similar documents from vector database
        info!("Getting database instance");
        let hnsw_bind = database::get_vector_db(&app_handle)
            .await
            .expect("Database initialization failed!");
        let top_k = TOPK;
        let hnsw_guard = hnsw_bind.lock().await;
        info!("Setting up database lock");
        let db = hnsw_guard.as_ref().expect("HNSW database not initialized!");
        info!("Initiating similarity search...");

        let setting_openai = app_handle.db(|db| {
            get_setting(db, "api_key_open_ai").expect("Failed on api_key_open_ai")
        });

        let similar_ids_with_distances = db
            .top_k(&user_prompt, top_k, &setting_openai.setting_value)
            .await
            .map_err(|e| format!("Similarity search failed: {}", e))?;

        let similar_ids_vec: Vec<(i64, f32)> = similar_ids_with_distances
            .into_iter()
            .map(|(id, distance)| (id as i64, distance))
            .collect();

        let similar_ids: Vec<i64> = similar_ids_vec.iter().map(|(id, _)| *id).collect();

        let mut all_ids_set = HashSet::new();
        all_ids_set.extend(similar_ids);

        let mut context = String::new();

        for (index, document_id) in all_ids_set.iter().enumerate() {
            let result: Option<(String, String)> = app_handle
                .db(|db| get_activity_text_from_project(db, *document_id))
                .map_err(|e| {
                    format!(
                        "Failed to retrieve document text for ID {}: {}",
                        document_id, e
                    )
                })
                .unwrap_or_else(|err| {
                    error!("{}", err);
                    None
                });

            if let Some((document_name, text)) = result {
                debug!("Document {}: ID: {}", index + 1, document_id);
                // Limit text to 1000 characters for filtering stage
                let filtered_text = if text.len() > 1000 {
                    text.chars().take(1000).collect::<String>() + "..."
                } else {
                    text.clone()
                };
                context.push_str(&format!(
                    "Document ID: {}\nContent:\n{}\n\n",
                    document_id, filtered_text
                ));
            }
        }

        if context.is_empty() {
            context.push_str("No relevant documents found.\n\n");
        }

        // Filter for relevant documents using Gemini
        let relevance_system_prompt = format!(
            "The user's prompt is: {}\n\n. You are an intelligent and logical personal assistant. Your task is to carefully review the content of provided documents and output solely a maximum of four numerical IDs of the documents that are directly related to the user prompt and are highly likely to help in answering the user's prompt (corresponding to the Document ID at the beginning of each document). If an individual document is not extremely relevant to the user prompt and the user prompt can be successfully answered without that document, do not include it in the list of returned documents. Output the relevant document IDs as a comma-separated list of numbers only or an empty list, with absolutely no other additional text or explanations. For example: 123,456,789 or an empty list.", 
            user_prompt
        );

        // Create contents for relevance filtering request
        let relevance_contents = vec![
            Content {
                role: "user".to_string(),
                parts: vec![
                    Part {
                        text: format!("{}\n\n{}", relevance_system_prompt, context),
                    },
                ],
            },
        ];

        let relevance_req_url = format!("{}?key={}", 
            GEMINI_URL, 
            setting.setting_value
        );

        let relevance_request_body = GeminiRequest {
            contents: relevance_contents,
            generationConfig: GenerationConfig {
                maxOutputTokens: 100,
            },
        };

        let relevance_response = client
            .post(&relevance_req_url)
            .header("Content-Type", "application/json")
            .json(&relevance_request_body)
            .send()
            .await
            .map_err(|e| format!("Relevance filtering request failed: {}", e))?;

        debug!("Relevance filtering response: {:?}", relevance_response);

        if relevance_response.status().is_success() {
            let relevance_result: GeminiResponse = relevance_response
                .json()
                .await
                .map_err(|e| format!("Failed to parse relevance filtering response: {}", e))?;

            let relevant_document_ids: Vec<i64> = if let Some(candidate) = relevance_result.candidates.first() {
                if let Some(part) = candidate.content.parts.first() {
                    let text = &part.text;
                    text.split(|c: char| !c.is_numeric())
                        .filter_map(|s| s.parse().ok())
                        .collect()
                } else {
                    Vec::new()
                }
            } else {
                Vec::new()
            };

            debug!("Relevant document IDs: {:?}", relevant_document_ids);

            for document_id in relevant_document_ids {
                let result: Option<(String, String)> = app_handle
                    .db(|db| get_activity_text_from_project(db, document_id))
                    .map_err(|e| format!("Failed to retrieve document text: {}", e))?;

                if let Some((document_name, text)) = result {
                    filtered_context.push_str(&format!(
                        "Document ID: {}\nContent:\n{}\n\n",
                        document_id, text
                    ));
                    window_titles.push(document_name);
                }
            }

            debug!(
                "Filtered context for final response generation: {}",
                filtered_context
            );
        } else {
            let error_message = relevance_response
                .text()
                .await
                .map_err(|e| format!("Failed to read error message: {}", e))?;
            info!(
                "Error from Gemini API during relevance filtering: {}",
                error_message
            );
            return Err(format!(
                "Error from Gemini API during relevance filtering: {}",
                error_message
            ));
        }
    }

    // Prepare conversation history
    let conversation_history_content = conversation_history
        .iter()
        .rev()
        .skip(1)
        .rev()
        .map(|message| {
            let role = if message.role == "user" {
                "User"
            } else {
                "Assistant"
            };
            format!("{}: {}", role, message.content)
        })
        .collect::<Vec<String>>()
        .join("\n");

    let system_prompt = format!(
        "You are Heelix chat app that is powered by Google Gemini. Heelix chat is developed by Heelix Technologies. Only identify yourself as such. Provide answers in markdown format. The following documents were retrieved from the user's device and may help in answering the prompt. Review them carefully to decide if they are relevant, if they are - using them to answer the query, but if they are not relevant to query, ignore them completely when responding, respond as if they were not there without mentioning having received them at all.{}\n\nAttached is the conversation history for context only. When answering, only give a single assistant response, do not also continue the conversation with a user answer.):
{}",
        filtered_context, conversation_history_content
    );

    let mut user_message = conversation_history
        .last()
        .map(|msg| msg.content.clone())
        .unwrap_or_default();

    if !combined_activity_text.is_empty() {
        user_message = format!(
            "{}The following is additional context from selected activities:\n{}",
            user_message, combined_activity_text
        );
    }

    // Create contents for the main request
    let mut contents = Vec::new();
    
    // Add system message
    contents.push(Content {
        role: "system".to_string(),
        parts: vec![Part { text: system_prompt }],
    });
    
    // Add user message
    contents.push(Content {
        role: "user".to_string(),
        parts: vec![Part { text: user_message }],
    });

    // Create the request for streaming
    let api_url = format!("{}?key={}", 
        GEMINI_URL, 
        setting.setting_value
    );

    let request_body = GeminiRequest {
        contents,
        generationConfig: GenerationConfig {
            maxOutputTokens: 2500,
        },
    };

    // Make the request to Gemini API
    let mut attempt = 0;
    let max_retries = 3;
    let mut delay = Duration::from_secs(1);

    loop {
        let response = client
            .post(&api_url)
            .header("Content-Type", "application/json")
            .json(&request_body)
            .send()
            .await;

        match response {
            Ok(resp) => {
                if resp.status().is_success() {
                    return handle_gemini_response(resp, app_handle, window_titles.clone()).await;
                } else {
                    let error_message = resp
                        .text()
                        .await
                        .map_err(|e| format!("Failed to read error message: {}", e))?;
                    info!("Error from Gemini API: {}", error_message);
                    return Err(format!("Error from Gemini API: {}", error_message));
                }
            }
            Err(e) => {
                if attempt < max_retries {
                    attempt += 1;
                    error!(
                        "Request to Gemini API failed: {}. Retrying... (Attempt {}/{})",
                        e, attempt, max_retries
                    );
                    tokio::time::sleep(delay).await;
                    delay *= 2;  // Exponential backoff
                } else {
                    let error_message =
                        "Apologies, Gemini API appears to be down right now - please try again later";
                    error!("Request failed after {} attempts: {}", max_retries, e);
                    app_handle
                        .get_webview_window("main")
                        .expect("Failed to get main window")
                        .emit("llm_response", error_message.to_string())
                        .map_err(|emit_err| {
                            format!("Failed to emit error message: {}", emit_err)
                        })?;
                    return Err(error_message.to_string());
                }
            }
        }
    }
}

async fn handle_gemini_response(
    response: Response,
    app_handle: AppHandle,
    window_titles: Vec<String>,
) -> Result<(), String> {
    let response_body: GeminiResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse Gemini response: {}", e))?;
    
    let completion = if let Some(candidate) = response_body.candidates.first() {
        if let Some(part) = candidate.content.parts.first() {
            part.text.clone()
        } else {
            String::new()
        }
    } else {
        String::new()
    };
    
    // Emit the response
    app_handle
        .get_webview_window("main")
        .expect("Failed to get main window")
        .emit("llm_response", completion.clone())
        .map_err(|e| format!("Failed to emit response: {}", e))?;
    
    // Emit window titles
    app_handle
        .get_webview_window("main")
        .expect("Failed to get main window")
        .emit(
            "window_titles",
            serde_json::to_string(&window_titles).unwrap(),
        )
        .map_err(|e| format!("Failed to emit window titles: {}", e))?;
    
    // Estimate token usage based on word count (rough estimation)
    let word_count = completion.split_whitespace().count();
    let output_tokens = (word_count as f64 * 0.75) as u32;
    
    app_handle
        .get_webview_window("main")
        .expect("Failed to get main window")
        .emit("output_tokens", output_tokens)
        .map_err(|e| format!("Failed to emit output tokens: {}", e))?;
    
    info!("Result from Gemini: {}", completion);
    Ok(())
}

#[tauri::command]
pub async fn name_conversation_gemini(
    app_handle: tauri::AppHandle,
    user_input: String,
) -> Result<String, String> {
    let setting =
        app_handle.db(|db| get_setting(db, "api_key_gemini").expect("Failed on api_key_gemini"));

    // Configure client
    let client = Client::builder()
        .timeout(Duration::from_secs(180))
        .build()
        .map_err(|e| format!("Failed to create client: {}", e))?;

    let system_prompt = "Name the conversation based on the user input. Use a total of 18 characters or less, without quotation marks. Use proper English, don't skip spaces between words. You only need to answer with the name.";
    
    // Create contents for naming request
    let contents = vec![
        Content {
            role: "system".to_string(),
            parts: vec![Part { text: system_prompt.to_string() }],
        },
        Content {
            role: "user".to_string(),
            parts: vec![Part { text: user_input }],
        },
    ];

    let api_url = format!("{}?key={}", 
        GEMINI_URL, 
        setting.setting_value
    );

    let request_body = GeminiRequest {
        contents,
        generationConfig: GenerationConfig {
            maxOutputTokens: 20,
        },
    };

    let response = client
        .post(&api_url)
        .header("Content-Type", "application/json")
        .json(&request_body)
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    if response.status().is_success() {
        let response_body: GeminiResponse = response
            .json()
            .await
            .map_err(|e| format!("Failed to parse response: {}", e))?;
        
        let generated_name = if let Some(candidate) = response_body.candidates.first() {
            if let Some(part) = candidate.content.parts.first() {
                part.text.trim().to_string()
            } else {
                "Unnamed Conversation".to_string()
            }
        } else {
            "Unnamed Conversation".to_string()
        };
        
        Ok(generated_name)
    } else {
        let error_message = response
            .text()
            .await
            .map_err(|e| format!("Failed to read error message: {}", e))?;
        Err(format!("Error from Gemini API: {}", error_message))
    }
} 