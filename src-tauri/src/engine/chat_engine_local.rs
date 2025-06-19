use async_openai::{
    config::OpenAIConfig,
    types::{
        ChatCompletionRequestSystemMessageArgs, ChatCompletionRequestUserMessageArgs,
        CreateChatCompletionRequestArgs,
    },
    Client as OpenAIClient,
};
use crate::repository::activity_log_repository::get_activity_full_text_by_id;
use crate::repository::activity_log_repository::get_additional_ids_from_sql_db;
use futures::StreamExt;
use log::{debug, error, info};
use serde_derive::{Deserialize, Serialize};
use serde_json;
use std::collections::HashSet;
use tauri::{Manager, Emitter};

use crate::configuration::database;
use crate::configuration::state::ServiceAccess;
use crate::repository::settings_repository::get_setting;
use crate::engine::similarity_search_engine::TOPK;

#[derive(Serialize, Deserialize)]
pub struct Message {
    role: String,
    content: String,
}

#[tauri::command]
pub async fn send_prompt_to_local(
    app_handle: tauri::AppHandle,
    conversation_history: Vec<Message>,
    is_first_message: bool,
    combined_activity_text: String,
    model_id: Option<String>,
) -> Result<(), String> {
    let endpoint_setting = app_handle.db(|db| 
        get_setting(db, "local_endpoint_url").expect("Failed on local_endpoint_url")
    );
    let model_setting = app_handle.db(|db| 
        get_setting(db, "local_model_name").expect("Failed on local_model_name")
    );

    // Create a custom OpenAI config with the local endpoint
    let config = OpenAIConfig::new()
        .with_api_base(&endpoint_setting.setting_value)
        .with_api_key("not-needed"); // Many local models don't require API keys

    let client = OpenAIClient::with_config(config);
    let mut filtered_context = String::new();
    let mut window_titles = Vec::new();
    
    // Use the model from settings or the provided model_id
    let model_to_use = model_id.unwrap_or(model_setting.setting_value);

    if is_first_message {
        // Only perform similarity search if vectorization is enabled and we have an OpenAI key for embeddings
        let openai_key_setting = app_handle.db(|db| 
            get_setting(db, "api_key_open_ai").unwrap_or_else(|_| {
                crate::entity::setting::Setting {
                    setting_key: "api_key_open_ai".to_string(),
                    setting_value: "".to_string(),
                }
            })
        );

        let vectorization_setting = app_handle.db(|db| 
            get_setting(db, "vectorization_enabled").unwrap_or_else(|_| {
                crate::entity::setting::Setting {
                    setting_key: "vectorization_enabled".to_string(),
                    setting_value: "false".to_string(),
                }
            })
        );

        let should_do_similarity_search = vectorization_setting.setting_value == "true" && 
                                        !openai_key_setting.setting_value.is_empty();

        if should_do_similarity_search {
            let user_prompt = conversation_history
                .last()
                .map(|msg| msg.content.clone())
                .unwrap_or_default();
            info!("User_prompt: {}", user_prompt);

            // Perform similarity search in the vector database
            info!("Getting database instance");

            let hnsw_bind = database::get_vector_db(&app_handle)
                .await
                .expect("Database initialization failed!");
            let top_k = TOPK;
            let hnsw_guard = hnsw_bind.lock().await;
            info!("Setting up database lock");
            let db = hnsw_guard.as_ref().expect("HNSW database not initialized!");
            info!("Initiating similarity search...");

            let similar_ids_with_distances = db
                .top_k(&user_prompt, top_k, &openai_key_setting.setting_value)
                .await
                .map_err(|e| format!("Similarity search failed: {}", e))?;

            let similar_ids_vec: Vec<(i64, f32)> = similar_ids_with_distances
                .into_iter()
                .map(|(id, distance)| (id as i64, distance))
                .collect();

            let similar_ids: Vec<i64> = similar_ids_vec.iter().map(|(id, _)| *id).collect();

            let mut all_ids_set = HashSet::new();
            all_ids_set.extend(similar_ids);

            // Extract keywords from user prompt for additional search
            let keywords: Vec<String> = user_prompt
                .split_whitespace()
                .filter(|word| word.len() > 3)
                .map(|word| word.to_lowercase())
                .collect();

            let additional_ids = app_handle.db(|db| {
                get_additional_ids_from_sql_db(db, 10, &keywords).unwrap_or_else(|_| Vec::new())
            });
            all_ids_set.extend(additional_ids);

            let all_ids: Vec<i64> = all_ids_set.into_iter().collect();

            let mut context = String::new();
            for id in &all_ids {
                let activity_result = app_handle.db(|db| get_activity_full_text_by_id(db, *id, None));
                match activity_result {
                    Ok(Some((activity_text, window_title))) => {
                        context.push_str(&format!("Document ID: {}\n{}\n\n", id, activity_text));
                        if !window_title.is_empty() {
                            window_titles.push(window_title);
                        }
                    }
                    Ok(None) => {
                        debug!("No activity found for ID: {}", id);
                    }
                    Err(e) => {
                        error!("Error fetching activity for ID {}: {}", id, e);
                    }
                }
            }

            // Simple relevance filtering using the local model
            if !context.is_empty() && !all_ids.is_empty() {
                let relevance_system_prompt = format!(
                    "The user's prompt is: {}\n\nYou are an intelligent assistant. Review the provided documents and return only the document IDs that are directly relevant to answering the user's question. Return the IDs as a comma-separated list of numbers only, or return nothing if no documents are relevant. For example: 123,456,789", 
                    user_prompt
                );

                let relevance_request = CreateChatCompletionRequestArgs::default()
                    .model(&model_to_use)
                    .max_tokens(100u32)
                    .messages([
                        ChatCompletionRequestSystemMessageArgs::default()
                            .content(relevance_system_prompt)
                            .build()
                            .map_err(|e| format!("Failed to build system message: {}", e))?
                            .into(),
                        ChatCompletionRequestUserMessageArgs::default()
                            .content(context.clone())
                            .build()
                            .map_err(|e| format!("Failed to build user message: {}", e))?
                            .into(),
                    ])
                    .build()
                    .map_err(|e| format!("Failed to build relevance request: {}", e))?;

                match client.chat().create(relevance_request).await {
                    Ok(relevance_response) => {
                        if let Some(choice) = relevance_response.choices.first() {
                            if let Some(content) = &choice.message.content {
                                let relevant_ids_str = content.trim();
                                debug!("Relevance filtering response: {}", relevant_ids_str);
                                
                                if !relevant_ids_str.is_empty() {
                                    let relevant_ids: Vec<i64> = relevant_ids_str
                                        .split(',')
                                        .filter_map(|s| s.trim().parse::<i64>().ok())
                                        .collect();

                                    // Rebuild context with only relevant documents
                                    filtered_context.clear();
                                    for id in &relevant_ids {
                                        let activity_result = app_handle.db(|db| get_activity_full_text_by_id(db, *id, None));
                                        if let Ok(Some((activity_text, _))) = activity_result {
                                            filtered_context.push_str(&format!("Document ID: {}\n{}\n\n", id, activity_text));
                                        }
                                    }
                                }
                            }
                        }
                    }
                    Err(e) => {
                        info!("Relevance filtering failed, using all documents: {}", e);
                        filtered_context = context;
                    }
                }
            }
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
        "You are Heelix chat app powered by a local AI model. Heelix chat is developed by Heelix Technologies. Only identify yourself as such. Provide answers in markdown format when appropriate. 

        The following documents were retrieved from the user's device and may help in answering the prompt. Review them carefully to decide if they are relevant. If they are, use them to answer the query. If they are not relevant to the query, ignore them completely when responding and respond as if they were not there without mentioning having received them at all.

        {}\n\nAttached is the conversation history for context only. When answering, only give a single assistant response; do not continue the conversation with a user answer:\n{}\n\n",
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

    let request = CreateChatCompletionRequestArgs::default()
        .model(&model_to_use)
        .messages([
            ChatCompletionRequestSystemMessageArgs::default()
                .content(system_prompt)
                .build()
                .unwrap()
                .into(),
            ChatCompletionRequestUserMessageArgs::default()
                .content(user_message)
                .build()
                .unwrap()
                .into(),
        ])
        .build()
        .map_err(|e| format!("Failed to build request: {}", e))?;

    let mut stream = client
        .chat()
        .create_stream(request)
        .await
        .map_err(|e| format!("Failed to create chat completion stream: {}", e))?;

    let mut completion = String::new();

    while let Some(result) = stream.next().await {
        match result {
            Ok(response) => {
                if let Some(choice) = response.choices.first() {
                    if let Some(content) = &choice.delta.content {
                        completion.push_str(content);
                    }
                }
            }
            Err(e) => {
                return Err(format!("Error while streaming response: {}", e));
            }
        }

        app_handle
            .get_webview_window("main")
            .expect("Failed to get main window")
            .emit("llm_response", completion.clone())
            .map_err(|e| format!("Failed to emit response: {}", e))?;

        app_handle
            .get_webview_window("main")
            .expect("Failed to get main window")
            .emit(
                "window_titles",
                serde_json::to_string(&window_titles).unwrap(),
            )
            .map_err(|e| format!("Failed to emit window titles: {}", e))?;
    }

    // Estimate token usage based on word count
    let word_count = completion.split_whitespace().count();
    let output_tokens = (word_count as f64 * 0.75) as i64;

    info!("Estimated tokens used: {}", output_tokens);

    // Emit the estimated token usage to the frontend
    app_handle
        .get_webview_window("main")
        .expect("Failed to get main window")
        .emit("output_tokens", output_tokens)
        .map_err(|e| format!("Failed to emit output tokens: {}", e))?;

    info!("Result from local model: {}", completion);
    Ok(())
}

#[tauri::command]
pub async fn name_conversation_local(
    app_handle: tauri::AppHandle,
    user_input: String,
) -> Result<String, String> {
    let endpoint_setting = app_handle.db(|db| 
        get_setting(db, "local_endpoint_url").expect("Failed on local_endpoint_url")
    );
    let model_setting = app_handle.db(|db| 
        get_setting(db, "local_model_name").expect("Failed on local_model_name")
    );

    // Create a custom OpenAI config with the local endpoint
    let config = OpenAIConfig::new()
        .with_api_base(&endpoint_setting.setting_value)
        .with_api_key("not-needed"); // Many local models don't require API keys

    let client = OpenAIClient::with_config(config);

    let system_prompt = format!(
        "Name the conversation based on the user input. Use a total of 18 characters or less, without quotation marks. Use proper English, don't skip spaces between words. You only need to answer with the name. The following is the user input: \n\n{}\n\n.:",
        user_input
    );

    let request = CreateChatCompletionRequestArgs::default()
        .model(&model_setting.setting_value)
        .max_tokens(20u32)
        .messages(vec![
            ChatCompletionRequestSystemMessageArgs::default()
                .content(system_prompt)
                .build()
                .unwrap()
                .into(),
            ChatCompletionRequestUserMessageArgs::default()
                .content("Please generate a concise name for the conversation based on the user input.")
                .build()
                .unwrap()
                .into(),
        ])
        .build()
        .map_err(|e| format!("name_conversation_local request_error: {}", e))?;

    let response = client
        .chat()
        .create(request)
        .await
        .map_err(|e| format!("name_conversation_local API request failed: {}", e))?;

    let generated_name = response.choices[0]
        .message
        .content
        .as_ref()
        .map(|s| s.trim().to_string())
        .unwrap_or_else(|| "Unnamed Conversation".to_string());

    Ok(generated_name)
} 