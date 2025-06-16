use std::sync::Arc;
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use anyhow::{Result, anyhow};

// Shared atomic flag to control recording state
pub static IS_RECORDING: AtomicBool = AtomicBool::new(false);

// Store the recording path
pub static RECORDING_PATH: once_cell::sync::Lazy<Arc<std::sync::Mutex<Option<String>>>> = 
    once_cell::sync::Lazy::new(|| Arc::new(std::sync::Mutex::new(None)));

/// Record audio to a WAV file 
pub fn record_audio(file_path: &str) -> Result<(), String> {
    use hound::{WavSpec, WavWriter};
    use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
    
    // Get default host and input device
    let host = cpal::default_host();
    let device = host.default_input_device()
        .ok_or_else(|| "No input device available".to_string())?;
    
    // Get supported config
    let config = device.default_input_config()
        .map_err(|e| format!("Default config not supported: {}", e))?;
    
    // Set up WAV writer - using mono (1 channel) instead of stereo
    let spec = WavSpec {
        channels: 1, // Force mono recording
        sample_rate: config.sample_rate().0,
        bits_per_sample: 16,
        sample_format: hound::SampleFormat::Int,
    };
    
    let writer = Arc::new(std::sync::Mutex::new(
        WavWriter::create(file_path, spec)
            .map_err(|e| format!("Failed to create WAV file: {}", e))?
    ));
    
    // Create a modified configuration that forces mono
    let stream_config = cpal::StreamConfig {
        channels: 1, // Force mono
        sample_rate: config.sample_rate(),
        buffer_size: cpal::BufferSize::Default,
    };
    
    // Set up stream
    let err_fn = move |err| {
        eprintln!("an error occurred on stream: {}", err);
    };
    
    let writer_clone = writer.clone();
    let stream = match config.sample_format() {
        cpal::SampleFormat::I16 => device.build_input_stream(
            &stream_config, // Use our mono config
            move |data: &[i16], _: &_| {
                if IS_RECORDING.load(Ordering::SeqCst) {
                    let mut writer = writer_clone.lock().unwrap();
                    for &sample in data {
                        writer.write_sample(sample).unwrap();
                    }
                }
            },
            err_fn,
            None,
        ),
        cpal::SampleFormat::F32 => device.build_input_stream(
            &stream_config, // Use our mono config
            move |data: &[f32], _: &_| {
                if IS_RECORDING.load(Ordering::SeqCst) {
                    let mut writer = writer_clone.lock().unwrap();
                    for &sample in data {
                        // Convert f32 to i16
                        let sample = (sample * 32767.0) as i16;
                        writer.write_sample(sample).unwrap();
                    }
                }
            },
            err_fn,
            None,
        ),
        _ => return Err("Unsupported sample format".to_string()),
    }.map_err(|e| format!("Failed to build input stream: {}", e))?;
    
    // Start the stream
    stream.play().map_err(|e| format!("Failed to play stream: {}", e))?;
    
    // Record until IS_RECORDING is set to false
    while IS_RECORDING.load(Ordering::SeqCst) {
        std::thread::sleep(std::time::Duration::from_millis(100));
    }
    
    // The stream will be stopped when it goes out of scope
    drop(stream);
    
    Ok(())
}

/// Start a new audio recording
pub async fn start_recording() -> Result<String, String> {
    // Check if already recording
    if IS_RECORDING.load(Ordering::SeqCst) {
        return Err("Already recording".to_string());
    }

    // Create a temporary file path in the system temp directory
    let app_data_dir = std::env::temp_dir().join("heelix_recordings");
    std::fs::create_dir_all(&app_data_dir)
        .map_err(|e| format!("Failed to create recording directory: {}", e))?;
    
    // Create a timestamped file name
    let timestamp = chrono::Local::now().format("%Y%m%d_%H%M%S").to_string();
    let file_path = app_data_dir.join(format!("recording_{}.wav", timestamp));
    let file_path_str = file_path.to_str()
        .ok_or_else(|| "Failed to convert path to string".to_string())?
        .to_string();
    
    // Store the recording path
    let mut path_guard = RECORDING_PATH.lock().unwrap();
    *path_guard = Some(file_path_str.clone());
    drop(path_guard);

    // Start recording in a separate thread
    let file_path_clone = file_path_str.clone();
    std::thread::spawn(move || {
        if let Err(err) = record_audio(&file_path_clone) {
            eprintln!("Error recording audio: {}", err);
            IS_RECORDING.store(false, Ordering::SeqCst);
        }
    });

    IS_RECORDING.store(true, Ordering::SeqCst);
    Ok(file_path_str)
}

/// Stop the current recording
pub async fn stop_recording() -> Result<String, String> {
    // Get the recording path first before changing IS_RECORDING state
    let path_guard = RECORDING_PATH.lock().unwrap();
    let path = path_guard.clone().unwrap_or_default();
    drop(path_guard);

    // Check if recording
    if !IS_RECORDING.load(Ordering::SeqCst) {
        // If we have a path, return it even if we're not recording
        // This handles race conditions between UI and backend
        if !path.is_empty() {
            return Ok(path);
        }
        return Err("Not recording".to_string());
    }

    // Stop recording
    IS_RECORDING.store(false, Ordering::SeqCst);

    // Wait a moment for the recording thread to finish
    std::thread::sleep(std::time::Duration::from_millis(500));
    
    Ok(path)
}

/// Read the contents of an audio file into a byte vector
pub fn read_audio_file(file_path: &str) -> Result<Vec<u8>, String> {
    // Read the file into a byte vector
    std::fs::read(file_path)
        .map_err(|err| format!("Failed to read audio file: {}", err))
}

/// Handle chunking for OpenAI transcription of large files
pub async fn chunk_and_transcribe_with_openai(file_path: &str, api_key: &str) -> Result<String, String> {
    // Create temp directory for chunks
    let chunk_dir = std::env::temp_dir().join("audio_chunks");
    std::fs::create_dir_all(&chunk_dir).map_err(|e| format!("Failed to create temp directory: {}", e))?;
    
    // Split the audio file using hound
    let chunks = split_wav_file(file_path, &chunk_dir, 0)?; // Using 0 to auto-calculate chunk size
    println!("Split audio into {} chunks", chunks.len());
    
    // Process each chunk and collect transcriptions
    let mut full_transcription = String::new();
    let mut failed_chunks = Vec::new();
    
    for (i, chunk_path) in chunks.iter().enumerate() {
        println!("Transcribing chunk {}/{}", i + 1, chunks.len());
        
        // Try to transcribe the chunk with retries
        let mut chunk_result = Err(format!("Initial error placeholder"));
        for retry in 0..3 {
            if retry > 0 {
                println!("Retry {}/2 for chunk {}", retry, i + 1);
            }
            
            chunk_result = crate::engine::transcription_engine::transcribe_with_openai(
                chunk_path,
                api_key,
            )
            .await
            .map_err(|e| format!("Failed to transcribe chunk {}: {}", i, e));
            
            if chunk_result.is_ok() {
                break;
            }
            
            // Sleep briefly before retry (if not the last retry)
            if retry < 2 {
                std::thread::sleep(std::time::Duration::from_secs(2));
            }
        }
        
        match chunk_result {
            Ok(chunk_transcription) => {
                // Append to the full transcription
                full_transcription.push_str(&chunk_transcription);
                full_transcription.push(' ');
                
                // Clean up chunk file
                if let Err(err) = std::fs::remove_file(chunk_path) {
                    println!("Warning: Failed to delete chunk file {}: {}", chunk_path, err);
                }
            },
            Err(err) => {
                // Record the failure but continue with other chunks
                println!("Warning: Failed to transcribe chunk {}: {}", i + 1, err);
                failed_chunks.push(i + 1);
            }
        }
    }
    
    // Cleanup chunk directory if it's empty
    let _ = std::fs::remove_dir(&chunk_dir);
    
    // Return the transcription with a warning if some chunks failed
    if !failed_chunks.is_empty() {
        let warning = format!("\n\n[Note: Transcription incomplete. Failed to process chunks: {:?}]", 
                            failed_chunks);
        full_transcription.push_str(&warning);
    }
    
    Ok(full_transcription.trim().to_string())
}

/// Split WAV files into smaller chunks
pub fn split_wav_file(file_path: &str, output_dir: &std::path::Path, chunk_seconds: u32) -> Result<Vec<String>, String> {
    use hound::{WavReader, WavWriter};
    use std::io::Write;
    
    // Open the WAV file
    let mut reader = WavReader::open(file_path)
        .map_err(|e| format!("Failed to open WAV file: {}", e))?;
    
    let spec = reader.spec();
    let sample_rate = spec.sample_rate;
    let channels = spec.channels as u32;
    
    // Calculate optimal chunk size to stay under 25MB
    // WAV file size calculation: sample_rate * channels * bytes_per_sample * seconds
    // 16-bit samples = 2 bytes per sample
    let bytes_per_second = sample_rate * channels * 2;
    let max_chunk_bytes = 24 * 1024 * 1024; // 24MB to be safe
    let max_seconds = max_chunk_bytes / bytes_per_second;
    
    // Cap at 45 seconds for API reliability, but use calculated value if smaller
    let target_seconds = if max_seconds < 45 { max_seconds } else { 45 };
    
    // Use provided chunk_seconds if specified and not zero, otherwise use calculated value
    let chunk_seconds = if chunk_seconds == 0 { target_seconds } else { chunk_seconds };
    
    println!("Using chunk size: {} seconds (calculated max: {} seconds)", 
             chunk_seconds, target_seconds);
    
    let samples_per_chunk = sample_rate * chunk_seconds * channels;
    let file_stem = std::path::Path::new(file_path)
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("audio");
    
    let mut chunk_paths = Vec::new();
    let mut chunk_idx = 0;
    let mut current_writer: Option<WavWriter<std::io::BufWriter<std::fs::File>>> = None;
    let mut samples_written = 0;
    
    // Stream samples instead of loading all at once
    let mut sample_iter = reader.samples::<i16>();
    
    loop {
        // Create new chunk writer if needed
        if current_writer.is_none() {
            let chunk_path = output_dir.join(format!("{}_chunk_{}.wav", file_stem, chunk_idx));
            let chunk_path_str = chunk_path.to_str()
                .ok_or_else(|| "Invalid path for chunk file".to_string())?
                .to_string();
            
            chunk_paths.push(chunk_path_str.clone());
            
            current_writer = Some(WavWriter::create(&chunk_path_str, spec)
                .map_err(|e| format!("Failed to create chunk file: {}", e))?);
            
            samples_written = 0;
        }
        
        // Read and write samples for the current chunk
        let mut chunk_complete = false;
        
        while let Some(sample_result) = sample_iter.next() {
            let sample = sample_result.map_err(|e| format!("Failed to read sample: {}", e))?;
            
            if let Some(writer) = current_writer.as_mut() {
                writer.write_sample(sample)
                    .map_err(|e| format!("Failed to write sample: {}", e))?;
            }
            
            samples_written += 1;
            
            // Check if we've completed a chunk
            if samples_written >= samples_per_chunk {
                chunk_complete = true;
                break;
            }
        }
        
        // Finalize current chunk if complete or if we're at the end
        if let Some(writer) = current_writer.take() {
            writer.finalize()
                .map_err(|e| format!("Failed to finalize chunk file: {}", e))?;
        }
        
        // End loop if no more samples
        if !chunk_complete && sample_iter.next().is_none() {
            break;
        }
        
        chunk_idx += 1;
    }
    
    Ok(chunk_paths)
} 