import { invoke } from "@tauri-apps/api/core";

export type Project = {
  id: number;
  name: string;
  activities: number[];   
  activity_ids: (number | null)[];
  activity_names: string[];   // Array of document names
};

export const UNASSIGNED_PROJECT_NAME = "Unassigned";

export const fetchProjects = async (offset: number): Promise<any[]> => {
  return await invoke<any[]>("get_projects", {
    offset,
    limit: 50,
  });
};

export const saveProject = async (project: Omit<Project, "id">) => {
  return await invoke("save_app_project", project);
};

export const updateProject = async (project: Project) => {
  return await invoke("update_app_project", project);
};

export const deleteProject = async (projectId: Project["id"]) => {
  return await invoke("delete_app_project", { projectId });
};

export const addBlankActivity = async (projectId: number): Promise<number> => {
  return await invoke<number>("add_project_blank_activity", { projectId });
};

export const updateActivityName = async (activityId: number, name: string) => {
  return await invoke("update_project_activity_name", { 
    activityId,
    name 
  });
};

export const updateActivityContent = async (activityId: number, text: string) => {
  return await invoke("update_project_activity_text", {
    activityId,
    text
  });
};

export const deleteActivity = async (activityId: number) => {
  return await invoke("delete_project_activity", { activityId });
};

export const addUnassignedActivity = async (): Promise<number> => {
  return await invoke<number>("ensure_unassigned_activity");
};

export const moveDocumentToProject = async (documentId: number, targetProjectId: number) => {
  return await invoke("update_project_activity_content", {
    documentId,
    targetProjectId
  });
};

export const projectService = {
  fetch: fetchProjects,
  save: saveProject,
  update: updateProject,
  delete: deleteProject,
  updateActivityName,
  addBlankActivity,
  deleteActivity,
  addUnassignedActivity,
  moveDocumentToProject,
  updateActivityContent
};