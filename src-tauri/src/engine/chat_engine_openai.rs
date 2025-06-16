use async_openai::{
    config::OpenAIConfig,
    types::{
        ChatCompletionRequestSystemMessageArgs, ChatCompletionRequestUserMessageArgs,
        CreateChatCompletionRequestArgs,
    },
    Client as OpenAIClient,
};
use crate::repository::activity_log_repository::get_activity_full_text_by_id;
use crate::repository::project_repository::get_activity_text_from_project;
use crate::repository::activity_log_repository::get_additional_ids_from_sql_db;
use futures::StreamExt;
use log::{debug, error, info};
use serde_derive::{Deserialize, Serialize};
use serde_json;
use std::collections::HashSet;
use std::time::Duration;
use tauri::{AppHandle, Manager, Emitter};

use crate::configuration::database;
use crate::configuration::state::ServiceAccess;
use crate::repository::settings_repository::get_setting;
use crate::engine::similarity_search_engine::TOPK;

const MODEL_FAST: &str = "gpt-3.5-turbo";
const MODEL_CHEAP: &str = "gpt-4";
const MODEL_MAIN: &str = "gpt-4o";
const MODEL_REASONING: &str = "o1";
const MODEL_CHEAP_REASONING: &str = "o3-mini";

#[derive(Serialize, Deserialize)]
pub struct Message {
    role: String,
    content: String,
}

#[tauri::command]
pub async fn send_prompt_to_openai(
    app_handle: tauri::AppHandle,
    conversation_history: Vec<Message>,
    is_first_message: bool,
    combined_activity_text: String,
    model_id: Option<String>, // Add this parameter
) -> Result<(), String> {
    let setting =
        app_handle.db(|db| get_setting(db, "api_key_open_ai").expect("Failed on api_key_open_ai"));

    let relevance_client =
        OpenAIClient::with_config(OpenAIConfig::new().with_api_key(&setting.setting_value));
    let mut filtered_context = String::new();
    let mut window_titles = Vec::new();
    let model_to_use = match model_id.as_deref() {
        Some("o1") => "o1",
        Some("o3-mini") => "o3-mini",
        _ => "gpt-4o", // Default to GPT-4o
    };

    if is_first_message {
        // Perform similarity search and relevance filtering only for the first message
        let user_prompt = conversation_history
            .last()
            .map(|msg| msg.content.clone())
            .unwrap_or_default();
        info!("User_prompt: {}", user_prompt);

        // Perform similarity search in OasysDB
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
            .top_k(&user_prompt, top_k, &setting.setting_value)
            .await
            .map_err(|e| format!("Similarity search failed: {}", e))?;

        // Collect the results into a vector that we can use multiple times
        let similar_ids_vec: Vec<(i64, f32)> = similar_ids_with_distances
            .into_iter()
            .map(|(id, distance)| (id as i64, distance))
            .collect();

        let similar_ids: Vec<i64> = similar_ids_vec.iter().map(|(id, _)| *id).collect();


        let mut all_ids_set = HashSet::new();
        all_ids_set.extend(similar_ids);

        // Retrieve the corresponding documents from the SQL database
        let mut context = String::new(); // Assuming context is initialized earlier

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
                debug!("Document {}: Content: {}", index + 1, text);
                // Limit text to 500 characters for filtering stage
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
        // Continue with any further processing that requires the context

        // Send the documents to the OpenAI model for relevance filtering
        let relevance_system_prompt = format!(
            "The user's prompt is: {}\n\n. You are an intelligent and logical personal assistant. Your task is to carefully review the content of provided documents and output solely a maximum of four numerical IDs of the documents that are directly related to the user prompt and are highly likely to help in answering the user's prompt (corresponding to the Document ID at the beginning of each document). If an individual document is not extremely relevant to the user prompt and the user prompt can be successfully answered without that document, do not include it in the list of returned documents.

            Examples of relevant and irrelevant documents in different business scenarios:
        
            Example 1: The user prompt is to outline effective marketing strategies for social media.
            - Relevant document:
                Document ID: 55
                Content: This document details various social media marketing strategies, which is directly relevant to the user's prompt.
            - Irrelevant document:
                Document ID: 78
                Content: This document describes traditional print advertising methods, which is not relevant to social media marketing strategies.
        
            Example 2: The user prompt is researching the best programming practices for AI development.
            - Relevant document:
                Document ID: 33
                Content: This document provides best practices for AI development, which is directly relevant to the user's prompt.
            - Irrelevant document:
                Document ID: 47
                Content: This document discusses basic HTML and CSS programming, which is not relevant to the user's prompt about AI development.
        
            Example 3: The user prompt asks for recommended books on investment strategies.
            - Relevant documents:
                Document ID: 17
                Content: This document lists top-rated books on investment strategies, highly relevant to the user's prompt.
                Document ID: 106
                Content: This document summarizes famous investment strategies, which is also relevant to the user's prompt.
                Document ID: 204
                Content: This document contains interviews with successful investors discussing their strategies, directly relevant to the user's prompt.
                Document ID: 345
                Content: This document reviews recent books on future investment trends, relevant to the user's prompt.
            - Irrelevant document:
                Document ID: 88
                Content: This document covers general finance tips, which may not be directly relevant to specific investment strategies.
        
            Example 4: The user prompt is to find best practices for remote team management.
            - Relevant document:
                Document ID: 99
                Content: This document covers best practices for managing remote teams, directly relevant to the user's prompt.
            - Irrelevant document:
                Document ID: 65
                Content: This document discusses in-office team-building activities, which are not relevant to managing remote teams.
        
            Example 5: The user prompt is about analyzing the latest trends in cybersecurity.
            - Relevant documents:
                Document ID: 120
                Content: This document provides a detailed analysis of the latest cybersecurity trends, directly relevant to the user's prompt.
                Document ID: 150
                Content: This document includes recent cybersecurity reports and data, relevant to understanding current trends.
            - Irrelevant document:
                Document ID: 88
                Content: This document outlines historical cybersecurity breaches, which may not be directly relevant to analyzing current trends.
                Document ID: 200
                Content: This document focuses on outdated cybersecurity practices, which are not relevant to the latest trends.
        
            Example 6: The user prompt asks for guidelines on creating an investment portfolio.
            - Relevant document:
                Document ID: 300
                Content: This document provides detailed guidelines on how to create and manage an investment portfolio, highly relevant to the user's prompt.
            - Irrelevant document:
                Document ID: 77
                Content: This document discusses corporate investment strategies, which may not be directly applicable to individual investment portfolios.
        
            Example 7: The user prompt asks for something not covered by any provided document.
            - User prompt: Strategies for eco-friendly business operations.
            - No documents: None of the documents provided contain information about eco-friendly business operations, so no documents should be returned.
        
            The user's prompt is: {}\n\nOutput the relevant document IDs as a comma-separated list of numbers only or an empty list, with absolutely no other additional text or explanations. For example: 123,456,789 or an empty list.",
            user_prompt, user_prompt
        );

        let relevance_request = CreateChatCompletionRequestArgs::default()
            .model(MODEL_FAST)
            .messages([
                ChatCompletionRequestSystemMessageArgs::default()
                    .content(relevance_system_prompt)
                    .build()
                    .map_err(|e| format!("Failed to build system message: {}", e))?
                    .into(),
                ChatCompletionRequestUserMessageArgs::default()
                    .content(context)
                    .build()
                    .map_err(|e| format!("Failed to build user message: {}", e))?
                    .into(),
            ])
            .build()
            .map_err(|e| format!("Failed to build request: {}", e))?;

        let relevance_response = relevance_client
            .chat()
            .create(relevance_request)
            .await
            .map_err(|e| format!("Relevance filtering request failed: {}", e))?;

        debug!("Relevance filtering response: {:?}", relevance_response);

        if let Some(relevance_result) = relevance_response.choices.first() {
            let relevant_document_ids: Vec<i64> = relevance_result
                .message
                .content
                .as_ref()
                .unwrap_or(&String::new())
                .split(|c: char| !c.is_numeric())
                .filter_map(|s| s.parse().ok())
                .collect();

            debug!("Relevant document IDs: {:?}", relevant_document_ids);

            // Retrieve the full text of the highly relevant documents
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
        }
    }

    // Prepare the conversation history for the OpenAI API
    let conversation_history_content = conversation_history
        .iter()
        .rev() // Reverse the order of messages
        .skip(1) // Skip the last user message
        .rev() // Reverse the order back to original
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
            "You are Heelix chat app that is powered by OpenAI LLM. Heelix chat is developed by Heelix Technologies. Only identify yourself as such.

            The following documents were retrieved from the user's device and may help in answering the prompt. Review them carefully to decide if they are relevant. If they are, use them to answer the query. If they are not relevant to the query, ignore them completely when responding and respond as if they were not there without mentioning having received them at all.\n\n{}\n\nAttached is the conversation history for context only. When answering, only give a single assistant response; do not continue the conversation with a user answer:\n{}\n\n",
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
        .model(model_to_use)
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

    let response_client =
        OpenAIClient::with_config(OpenAIConfig::new().with_api_key(&setting.setting_value));
    let mut stream = response_client
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

    info!("Result from OpenAI: {}", completion);
    Ok(())
}


#[tauri::command]
pub async fn generate_conversation_name(
    app_handle: tauri::AppHandle,
    user_input: &str,
) -> Result<String, String> {
    // Fetch the OpenAI API key from your settings
    let setting =
        app_handle.db(|db| get_setting(db, "api_key_open_ai").expect("Failed on api_key_open_ai"));

    // Initialize the OpenAI client with the API key
    let config = OpenAIConfig::new().with_api_key(&setting.setting_value);
    let client = OpenAIClient::with_config(config);

    // Define the system prompt to guide the model
    let system_prompt = format!(
        "Name the conversation based on the user input. Use a total of 18 characters or less, without quotation marks. Use proper English, don't skip spaces between words. You only need to answer with the name. The following is the user input: \n\n{}\n\n.:",
        user_input
    );

    // Create a chat completion request with the system message and user input
    let request = CreateChatCompletionRequestArgs::default()
        .model(MODEL_FAST) // Specify the model, you can use "gpt-4" if needed
        .max_tokens(20u32) // Limit the response to 20 tokens
        .messages(vec![
            // Use the correct message type for the system message
            ChatCompletionRequestSystemMessageArgs::default()
                .content(system_prompt)
                .build()
                .unwrap()
                .into(), // Convert to correct type
            // Use the correct message type for the user message
            ChatCompletionRequestUserMessageArgs::default()
                .content(
                    "Please generate a concise name for the conversation based on the user input.",
                )
                .build()
                .unwrap()
                .into(), // Convert to correct type
        ])
        .build()
        .map_err(|e| format!("generate_conversation_name request_error: {}", e))?; // Handle request building error

    // Send the request to OpenAI and await the response, converting any OpenAIError to a String
    let response = client
        .chat()
        .create(request)
        .await
        .map_err(|e| format!("generate_conversation_name OpenAI API request failed: {}", e))?;

    // Extract the first message content safely from the response
    let generated_name = response.choices[0]
        .message
        .content
        .as_ref() // Convert Option<String> to Option<&String>
        .map(|s| s.trim().to_string()) // Trim and convert to String if Some
        .unwrap_or_else(|| "Unnamed Conversation".to_string()); // Provide fallback if None

    Ok(generated_name)
}
