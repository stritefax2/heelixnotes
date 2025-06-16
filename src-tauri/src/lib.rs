pub mod entity;
pub mod window_details_collector;
// pub mod permissions;

// Utility function to convert HTML to plain text
pub fn html_to_plain_text(html: &str) -> String {
    // Safety check for empty or invalid input
    if html.is_empty() {
        return String::new();
    }

    // First try to convert using html2text
    let plain_text = match html2text::from_read(html.as_bytes(), 80) {
        Ok(text) => text,
        Err(e) => {
            // Log the error for debugging
            eprintln!("HTML parsing error: {:?}", e);
            // If HTML parsing fails, fall back to basic stripping
            html.replace("<br>", "\n")
                .replace("<p>", "\n")
                .replace("</p>", "\n")
                .replace("<div>", "\n")
                .replace("</div>", "\n")
        }
    };

    // Process box drawing characters safely
    let cleaned_text = plain_text.chars()
        .filter_map(|c| {
            // Skip any invalid Unicode characters
            if !c.is_control() {
                Some(if (0x2500..=0x257F).contains(&(c as u32)) {
                    match c {
                        '─' | '━' | '═' | '╍' | '╌' | '╎' | '╏' => '-',
                        '│' | '┃' | '║' => '|',
                        '┌' | '┍' | '┎' | '┏' | '╒' | '╓' | '╔' |
                        '┐' | '┑' | '┒' | '┓' | '╕' | '╖' | '╗' |
                        '└' | '┕' | '┖' | '┗' | '╘' | '╙' | '╚' |
                        '┘' | '┙' | '┚' | '┛' | '╛' | '╜' | '╝' |
                        '├' | '┝' | '┞' | '┟' | '┠' | '┡' | '┢' | '┣' |
                        '┤' | '┥' | '┦' | '┧' | '┨' | '┩' | '┪' | '┫' |
                        '┬' | '┭' | '┮' | '┯' | '┰' | '┱' | '┲' | '┳' |
                        '┴' | '┵' | '┶' | '┷' | '┸' | '┹' | '┺' | '┻' |
                        '┼' | '┽' | '┾' | '┿' | '╀' | '╁' | '╂' | '╃' => '+',
                        _ => ' '
                    }
                } else {
                    c
                })
            } else {
                None
            }
        })
        .collect::<String>();

    // Filter lines more efficiently
    cleaned_text
        .lines()
        .filter(|line| {
            let line_trim = line.trim();

            // Skip empty lines
            if line_trim.is_empty() {
                return true;
            }

            // Quick check for separator lines
            if line_trim.chars().all(|c| c == '-' || c == '_' || c == '=') {
                return false;
            }

            // Check for email footer/header patterns
            if line_trim.contains('[') && line_trim.contains(']') && 
               (line_trim.contains('|') || line_trim.contains('│')) {
                let bracket_count = line_trim.chars().filter(|&c| c == '[' || c == ']').count();
                if bracket_count >= 4 {
                    return false;
                }
            }

            // Count special characters
            let special_char_count = line_trim.chars()
                .filter(|&c| !c.is_alphanumeric() && !c.is_whitespace())
                .count();

            let special_char_ratio = if !line_trim.is_empty() {
                special_char_count as f32 / line_trim.len() as f32
            } else {
                0.0
            };

            // Keep lines with meaningful content
            special_char_ratio <= 0.4 || line_trim.split_whitespace().count() >= 3
        })
        .collect::<Vec<&str>>()
        .join("\n")
}