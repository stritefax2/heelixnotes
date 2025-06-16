use crate::entity::project::Project;
use rusqlite::{named_params, params, Connection};
use log::info;
use heelix::html_to_plain_text;

pub fn delete_project(conn: &Connection, project_id: i64) -> Result<(), rusqlite::Error> {
    conn.execute("DELETE FROM projects WHERE id = ?1", params![project_id])?;
    delete_project_activities(conn, project_id)?;
    Ok(())
}

pub fn delete_project_activities(
    conn: &Connection,
    project_id: i64,
) -> Result<(), rusqlite::Error> {
    conn.execute(
        "DELETE FROM projects_activities WHERE project_id = ?1",
        params![project_id],
    )?;
    Ok(())
}

pub fn save_project(
    conn: &Connection,
    name: &str,
    activities: &Vec<i64>,
) -> Result<(), rusqlite::Error> {
    let mut statement = conn.prepare("INSERT INTO projects (name) VALUES (@name)")?;

    statement.execute(named_params! {
        "@name": name
    })?;
    let project_id = conn.last_insert_rowid();

    // Only add activities if the vector is not empty
    if !activities.is_empty() {
        add_project_activities(conn, project_id, activities)?;
    }
    
    Ok(())
}

pub fn update_project(
    conn: &Connection,
    project_id: i64,
    name: &str,
    activities: &Vec<i64>,
) -> Result<(), rusqlite::Error> {
    // Update the project name first
    conn.execute(
        "UPDATE projects SET name = ?1 WHERE id = ?2",
        params![name, project_id],
    )?;
    
    // Only handle activities if they're provided
    if !activities.is_empty() {
        delete_project_activities(conn, project_id)?;
        add_project_activities(conn, project_id, activities)?;
    }
    
    Ok(())
}

// Add this function to your database module:
pub fn move_document_to_project(
    conn: &Connection,
    document_id: i64,
    target_project_id: i64,
) -> Result<(), rusqlite::Error> {
    conn.execute(
        "UPDATE projects_activities SET project_id = ?1 WHERE id = ?2",
        params![target_project_id, document_id],
    )?;
    Ok(())
}

pub fn add_project_activities(
    conn: &Connection,
    project_id: i64,
    activity_ids: &Vec<i64>,
) -> Result<(), rusqlite::Error> {
    let mut stmt = conn.prepare(
        "INSERT INTO projects_activities (project_id, activity_id, document_name, full_document_text, plain_text)
         SELECT ?1, id, COALESCE(window_title, 'Document ' || id), edited_full_text, ?2
         FROM activity_full_text
         WHERE id = ?3"
    )?;

    for &activity_id in activity_ids {
        // Get the full text first
        let full_text = conn.query_row(
            "SELECT edited_full_text FROM activity_full_text WHERE id = ?1",
            params![activity_id],
            |row| row.get::<_, String>(0)
        )?;

        // Safety check for empty or invalid content
        if full_text.is_empty() {
            info!("Warning: Empty content for activity ID: {}", activity_id);
            stmt.execute(params![project_id, "", activity_id])?;
            continue;
        }

        // Log the first 100 characters of the HTML content for debugging
        info!("Processing HTML content for activity ID: {}. First 100 chars: {}", 
            activity_id, 
            full_text.chars().take(100).collect::<String>());

        // Convert to plain text with error handling
        let plain_text = match std::panic::catch_unwind(|| {
            html_to_plain_text(&full_text)
        }) {
            Ok(text) => {
                info!("Successfully converted HTML to plain text for activity ID: {}", activity_id);
                text
            },
            Err(e) => {
                info!("Error converting HTML to plain text for activity ID: {}. Error: {:?}", activity_id, e);
                info!("Falling back to basic HTML stripping for activity ID: {}", activity_id);
                // Fallback to basic HTML stripping if conversion fails
                full_text.replace("<br>", "\n")
                    .replace("<p>", "\n")
                    .replace("</p>", "\n")
                    .replace("<div>", "\n")
                    .replace("</div>", "\n")
            }
        };

        stmt.execute(params![project_id, plain_text, activity_id])?;
    }
    Ok(())
}

pub fn fetch_all_projects(conn: &Connection) -> Result<Vec<Project>, rusqlite::Error> {
    let mut stmt = conn.prepare("SELECT id, name, created_at FROM projects")?;
    let project_iter = stmt.query_map([], |row| {
        Ok(Project {
            id: row.get(0)?,
            name: row.get(1)?,
            activities: Vec::new(),
            activity_ids: Vec::new(),
            activity_names: Vec::new(),
            created_at: row.get(2)?,
        })
    })?;

    let mut projects = Vec::new();
    for project in project_iter {
        let mut project = project?;
        let (ids, activity_ids, names) = fetch_activities_by_project_id(conn, project.id)?;
        project.activities = ids;
        project.activity_ids = activity_ids;
        project.activity_names = names;
        projects.push(project);
    }

    Ok(projects)
}

pub fn fetch_activities_by_project_id(
    conn: &Connection,
    project_id: i64,
) -> Result<(Vec<i64>, Vec<Option<i64>>, Vec<String>), rusqlite::Error> {
    let mut stmt = conn.prepare(
        "SELECT pa.id, pa.activity_id, pa.document_name
         FROM projects_activities pa
         WHERE pa.project_id = ?1
         ORDER BY pa.id"
    )?;

    let rows = stmt.query_map(params![project_id], |row| {
        Ok((
            row.get::<_, i64>("id")?,
            row.get::<_, Option<i64>>("activity_id")?,
            row.get::<_, String>("document_name")?,
        ))
    })?;

    let mut ids = Vec::new();
    let mut activity_ids = Vec::new();
    let mut names = Vec::new();

    for row in rows {
        let (id, activity_id, name) = row?;
        ids.push(id);
        activity_ids.push(activity_id);
        names.push(name);
    }

    Ok((ids, activity_ids, names))
}

pub fn get_activity_text_from_project(
    conn: &Connection,
    activity_id: i64,
) -> Result<Option<(String, String)>, rusqlite::Error> {
    let mut stmt = conn.prepare(
        "SELECT document_name, full_document_text 
         FROM projects_activities 
         WHERE id = ?1"  // Only using the activity ID (document ID)
    )?;
    
    let result = stmt.query_row(params![activity_id], |row| {
        let document_name: String = row.get(0)?;
        let full_document_text: String = row.get(1)?;
        Ok((document_name, full_document_text))
    });

    match result {
        Ok((document_name, full_document_text)) => {
            Ok(Some((document_name, full_document_text)))
        }
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e),
    }
}

pub fn get_activity_plain_text_from_project(
    conn: &Connection,
    activity_id: i64,
) -> Result<Option<(String, String)>, rusqlite::Error> {
    let mut stmt = conn.prepare(
        "SELECT document_name, plain_text 
         FROM projects_activities 
         WHERE id = ?1"  // Only using the activity ID (document ID)
    )?;

    let result = stmt.query_row(params![activity_id], |row| {
        let document_name: String = row.get(0)?;
        let plain_text: String = row.get(1)?;
        Ok((document_name, plain_text))
    });

    match result {
        Ok((document_name, plain_text)) => {
            Ok(Some((document_name, plain_text)))
        }
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e),
    }
}

pub fn update_activity_text(
    conn: &Connection,
    activity_id: i64,
    text: &str,
) -> Result<bool, rusqlite::Error> {
    // Convert to plain text
    let plain_text = html_to_plain_text(text);

    // Update both the document text and plain text
    conn.execute(
        "UPDATE projects_activities SET full_document_text = ?1, plain_text = ?2 WHERE id = ?3",
        params![text, plain_text, activity_id],
    )?;
    
    info!("Updated document text for ID: {}, length: {}", activity_id, text.len());

    // Simple check: needs vectorization if text > 200 chars and not already vectorized
    if text.len() > 200 {
        let is_vectorized: bool = conn.query_row(
            "SELECT is_vectorized FROM projects_activities WHERE id = ?1",
            params![activity_id],
            |row| Ok(row.get::<_, i64>(0)? != 0)
        )?;
        
        info!("Document ID: {} - Text length > 200, already vectorized: {}", activity_id, is_vectorized);
        
        // Return true if document needs vectorization
        return Ok(!is_vectorized);
    }
    
    info!("Document ID: {} text length too short for vectorization", activity_id);
    Ok(false)
}

/// Simple function to mark a document as vectorized
pub fn mark_document_as_vectorized(
    conn: &Connection,
    activity_id: i64,
) -> Result<(), rusqlite::Error> {
    conn.execute(
        "UPDATE projects_activities SET is_vectorized = 1 WHERE id = ?1",
        params![activity_id],
    )?;
    info!("Marked document ID: {} as vectorized", activity_id);
    Ok(())
}

pub fn update_activity_name(
    conn: &Connection,
    activity_id: i64,
    name: &str,
) -> Result<(), rusqlite::Error> {
    conn.execute(
        "UPDATE projects_activities SET document_name = ?1 WHERE id = ?2",
        params![name, activity_id],
    )?;
    Ok(())
}

pub fn add_blank_document(
    conn: &Connection,
    project_id: i64,
) -> Result<i64, rusqlite::Error> {
    conn.execute(
        "INSERT INTO projects_activities (project_id, document_name, full_document_text) 
         VALUES (?1, ?2, ?3)",
        params![project_id, "New Document", "Start editing"],
    )?;
    Ok(conn.last_insert_rowid())
}

pub fn delete_project_document(
    conn: &Connection,
    activity_id: i64,
) -> Result<(), rusqlite::Error> {
    conn.execute(
        "DELETE FROM projects_activities WHERE id = ?1",
        params![activity_id],
    )?;
    Ok(())
}

const DEFAULT_PROJECT_ID: i64 = 0;

pub fn ensure_unassigned_project(conn: &Connection) -> Result<i64, rusqlite::Error> {
    // Check if unassigned project exists
    let mut stmt = conn.prepare("SELECT id FROM projects WHERE name = ?1")?;
    let mut rows = stmt.query_map(params!["Unassigned"], |row| row.get(0))?;
    
    if let Some(Ok(id)) = rows.next() {
      // Project exists, return its ID
      return Ok(id);
    }
    
    // Project doesn't exist, create it
    conn.execute(
      "INSERT INTO projects (name) VALUES (?1)",
      params!["Unassigned"],
    )?;
    
    Ok(conn.last_insert_rowid())
  }