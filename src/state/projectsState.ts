import { useAtom } from "jotai";
import { atomWithReducer } from "jotai/utils";
import { useEffect } from "react";
import { projectService, type Project, UNASSIGNED_PROJECT_NAME } from "../data/project";
import { getFullActivityText, getFullActivityPlainText } from "../data/activities";

type ProjectState = {
  projects: Project[];
  selectedProject: Project["id"] | undefined;
  selectedActivityId: number | null;
};

type ProjectAction =
  | { type: "set"; payload: Project[] }
  | { type: "select"; payload: Project["id"] | undefined }
  | { type: "update"; payload: Project }
  | { type: "delete"; payload: Project["id"] }
  | { type: "selectActivity"; payload: number | null }
  | { type: "updateActivityName"; payload: { projectId: number; activityId: number; name: string } }
  | { type: "addActivity"; payload: { projectId: number; activityId: number } }
  | { type: "deleteActivity"; payload: { projectId: number; activityId: number } };

// Reducer
const projectReducer = (prev: ProjectState, action: ProjectAction): ProjectState => {
  switch (action.type) {
    case "set":
      return {
        ...prev,
        projects: action.payload,
      };

    case "select":
      return {
        ...prev,
        selectedProject: action.payload,
      };

    case "update":
      const projectIndex = prev.projects.findIndex(
        (project) => project.id === action.payload.id
      );
      if (projectIndex >= 0) {
        prev.projects[projectIndex] = action.payload;
      }
      return { ...prev };
      
    case "delete":
      const projectDeleteIndex = prev.projects.findIndex(
        (project) => project.id === action.payload
      );
      if (projectDeleteIndex >= 0) {
        prev.projects.splice(projectDeleteIndex, 1);
      }
      return { ...prev };
      
    case "selectActivity":
      return {
        ...prev,
        selectedActivityId: action.payload,
      };

    case "updateActivityName":
      return {
        ...prev,
        projects: prev.projects.map(project =>
          project.id === action.payload.projectId
            ? {
                ...project,
                activity_names: project.activity_names.map((name, idx) =>
                  project.activities[idx] === action.payload.activityId
                    ? action.payload.name
                    : name
                ),
              }
            : project
        ),
      };

    case "addActivity":
      return {
        ...prev,
        projects: prev.projects.map(project =>
          project.id === action.payload.projectId
            ? {
                ...project,
                activities: [...project.activities, action.payload.activityId],
                activity_ids: [...project.activity_ids, action.payload.activityId],
                activity_names: [...project.activity_names, "New Document"]
              }
            : project
        ),
      };
      
    case "deleteActivity":
      return {
        ...prev,
        projects: prev.projects.map(project => {
          if (project.id === action.payload.projectId) {
            const activityIndex = project.activities.findIndex(id => id === action.payload.activityId);
            
            if (activityIndex >= 0) {
              const newProject = {...project};
              newProject.activities.splice(activityIndex, 1);
              newProject.activity_ids.splice(activityIndex, 1);
              newProject.activity_names.splice(activityIndex, 1);
              return newProject;
            }
          }
          return project;
        }),
        selectedActivityId: prev.selectedActivityId === action.payload.activityId 
          ? null 
          : prev.selectedActivityId
      };

    default:
      return prev;
  }
};

// Initial state
const initialState: ProjectState = {
  projects: [],
  selectedProject: undefined,
  selectedActivityId: null,
};

// Atom
export const projectAtom = atomWithReducer<ProjectState, ProjectAction>(
  initialState,
  projectReducer
);

export const useProject = () => {
  const [state, dispatch] = useAtom(projectAtom);

  // TODO: Implement proper date filter state management
  const getDateFilterState = () => ({
    startDate: null as string | null,
    endDate: null as string | null
  });

  const fetch = () => {
    projectService.fetch(0).then((result) => {
      dispatch({ type: "set", payload: result });
    });
  };

  useEffect(() => {
    fetch();
  }, []);

  const addProject = async (project: Omit<Project, "id">) => {
    await projectService.save(project);
    fetch();
  };

  const updateProject = async (project: Project) => {
    await projectService.update(project);
    fetch();
  };

  const deleteProject = async (projectId: Project["id"]) => {
    await projectService.delete(projectId);
    fetch();
  };

  const selectProject = (projectId: Project["id"] | undefined) =>
    dispatch({ type: "select", payload: projectId });

  const selectActivity = (activityId: number | null) =>
    dispatch({ type: "selectActivity", payload: activityId });

  // Find which project contains a specific activity
  const findProjectWithActivity = (activityId: number): Project | undefined => {
    return state.projects.find(project => 
      project.activities.includes(activityId)
    );
  };

  // Get activity name by ID regardless of project
  const getActivityName = (activityId: number): string => {
    for (const project of state.projects) {
      const activityIndex = project.activities.indexOf(activityId);
      if (activityIndex !== -1) {
        return project.activity_names[activityIndex] || "Untitled Document";
      }
    }
    return "Untitled Document";
  };

  const updateActivityName = async (activityId: number, name: string) => {
    // Find which project contains this activity
    const selectedProject = getSelectedProject();
    const projectWithActivity = selectedProject || findProjectWithActivity(activityId);
    
    if (projectWithActivity) {
      await projectService.updateActivityName(activityId, name);
      dispatch({
        type: "updateActivityName",
        payload: { projectId: projectWithActivity.id, activityId, name },
      });
    }
  };

  const updateActivityContent = async (activityId: number, content: string) => {
    try {
      // Call the backend service to update the activity content
      await projectService.updateActivityContent(activityId, content);
      return true;
    } catch (error) {
      console.error("Error updating activity content:", error);
      return false;
    }
  };

  const addBlankActivity = async () => {
    const selectedProject = getSelectedProject();
    if (selectedProject) {
      const newActivityId = await projectService.addBlankActivity(selectedProject.id);
      dispatch({
        type: "addActivity",
        payload: { projectId: selectedProject.id, activityId: newActivityId }
      });
      return newActivityId;
    }
    return undefined;
  };
  
  const addUnassignedActivity = async () => {
    try {
      const newActivityId = await projectService.addUnassignedActivity();
      // Refresh project list to ensure we have the updated data
      await fetch();
      return newActivityId;
    } catch (error) {
      console.error("Error adding unassigned activity:", error);
      return undefined;
    }
  };
  
  const deleteActivity = async (activityId: number) => {
    // Find which project contains this activity
    const projectWithActivity = findProjectWithActivity(activityId);
    
    if (projectWithActivity) {
      await projectService.deleteActivity(activityId);
      dispatch({
        type: "deleteActivity",
        payload: { projectId: projectWithActivity.id, activityId }
      });
    }
  };

  const getSelectedProject = () => {
    return state.projects.find((project) => project.id === state.selectedProject);
  };
  
  // Get visible projects (excluding unassigned project)
  const getVisibleProjects = () => {
    return state.projects.filter(project => project.name !== UNASSIGNED_PROJECT_NAME);
  };

  // Get the project that a specific activity belongs to
  const getActivityProject = (activityId: number) => {
    return state.projects.find(project => 
      project.activities.includes(activityId)
    );
  };

  const getSelectedProjectActivityText = async () => {
    const selectedProject = getSelectedProject();
    if (selectedProject) {
      // Get date filter state
      const { startDate, endDate } = getDateFilterState();
      
      // Get all activities for the selected project
      const filteredActivities = selectedProject.activities.filter((_, index) => {
        // If no date filters active, include all activities
        if (!startDate && !endDate) return true;
        
        // Get the activity creation date
        // TODO: Add activity_created_at field to Project type
        // const activityDate = selectedProject.activity_created_at[index];
        // if (!activityDate) return true; // Include if no date info available
        
        // For now, skip date filtering until activity_created_at is implemented
        return true;
        
        // const activityTimestamp = new Date(activityDate).getTime();
        
        // Filter by start date if provided
        // if (startDate) {
        //   const startTimestamp = new Date(startDate).getTime();
        //   if (activityTimestamp < startTimestamp) return false;
        // }
        
        // Filter by end date if provided
        // if (endDate) {
        //   // Add time to make it inclusive of the whole day
        //   const endTimestamp = new Date(endDate + 'T23:59:59').getTime();
        //   if (activityTimestamp > endTimestamp) return false;
        // }
        
        // return true;
      });

      // Get full text for filtered activities
      const promises = filteredActivities.map((activityId) =>
        getFullActivityPlainText(activityId)
      );
      const fullTextActivities = await Promise.all(promises);
      return fullTextActivities
        .map((text, index) => `${index + 1}. Activity: \n ${text}`)
        .join(", ");
    }
    return "";
  };
  
  const fetchSelectedActivityText = async () => {
    if (state.selectedActivityId) {
      const projectWithActivity = getActivityProject(state.selectedActivityId);
      if (projectWithActivity) {
        return getFullActivityText(state.selectedActivityId);
      }
    }
    return "";
  };

  // Add the moveActivity function
  const moveActivity = async (activityId: number, targetProjectId: number) => {
    try {
      // Find which project contains this activity
      const sourceProject = findProjectWithActivity(activityId);
      
      if (!sourceProject) {
        console.error("Source project not found for activity", activityId);
        return false;
      }
      
      // Call the backend service to update the project assignment
      await projectService.moveDocumentToProject(activityId, targetProjectId);
      
      // Refresh the projects to update the local state
      await fetch();
      
      return true;
    } catch (error) {
      console.error("Error moving activity to new project:", error);
      return false;
    }
  };

  return {
    state,
    getSelectedProject,
    getActivityProject,
    getVisibleProjects,
    getActivityName,
    getSelectedProjectActivityText,
    fetchSelectedActivityText,
    selectProject,
    selectActivity,
    addProject,
    deleteProject,
    updateProject,
    updateActivityName,
    addBlankActivity,
    addUnassignedActivity,
    deleteActivity,
    moveActivity,
    updateActivityContent
  };
};