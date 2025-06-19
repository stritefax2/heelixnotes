import React, { type FC, useState, useMemo, useRef, useEffect, useCallback } from "react";
import styled from "styled-components";
import { invoke } from '@tauri-apps/api/core';
import { 
  Box, 
  Menu, 
  MenuButton, 
  MenuList, 
  MenuItem, 
  IconButton, 
  Flex, 
  Badge,
  Tooltip,
  Divider,
  Input,
  InputGroup,
  InputLeftElement,
  Text as ChakraText,
  Tag,
  AlertDialog,
  AlertDialogBody,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogContent,
  AlertDialogOverlay,
  Button,
  useDisclosure,
  useToast
} from "@chakra-ui/react";
import { 
  Search, 
  File, 
  Trash2, 
  Edit, 
  X, 
  MoreHorizontal, 
  FilePlus, 
  FolderPlus,
  Mic,
  Square,
  Headphones,
  FileUp
} from 'lucide-react';
import { Text } from "@heelix-app/design";
import { useProject } from "../../state";
import { ProjectModal } from "@/components";
import { type Project } from "../../data/project";
import { open } from '@tauri-apps/plugin-dialog';
import { listen } from '@tauri-apps/api/event';
import { appConfigDir } from '@tauri-apps/api/path';
import { writeTextFile, readTextFile } from '@tauri-apps/plugin-fs';
import { HtmlSanitizer } from "@/components/HtmlSanitizer";

//
// -- Styled Components --
const Container = styled(Box)`
  display: flex;
  flex: 1;
  flex-direction: column;
  padding: var(--space-l);
  gap: var(--space-l);
  width: 100%;
  max-width: 420px; /* Increased width to occupy more space */
  margin: 0 auto;
  overflow: hidden;
`;

const StyledMenuButton = styled(MenuButton)`
  background-color: var(--card-content-background);
  border: 1px solid var(--default-border-color);
  border-radius: var(--chakra-radii-md);
  padding: 8px 12px;
  height: 40px;
  display: flex;
  align-items: center;
  width: 100%;
  transition: all 0.2s;
  color: var(--text-default-color);
  
  &:hover {
    background-color: var(--secondary-hover-color);
    border-color: var(--default-border-color);
  }
  
  &:focus {
    outline: none;
    box-shadow: none;
    border-color: var(--default-border-color);
  }
  
  &:focus-visible {
    outline: none;
    box-shadow: none;
    border-color: var(--default-border-color);
  }
`;

const ScrollableMenuList = styled(MenuList)`
  max-height: 300px;
  overflow-y: auto;
  background-color: var(--card-content-background);
  border-color: var(--default-border-color);
  
  /* Custom scrollbar styling */
  &::-webkit-scrollbar {
    width: 8px;
  }
  
  &::-webkit-scrollbar-track {
    background: var(--secondary-color);
    border-radius: 4px;
  }
  
  &::-webkit-scrollbar-thumb {
    background: var(--scrollbar-color);
    border-radius: 4px;
  }
  
  &::-webkit-scrollbar-thumb:hover {
    background: var(--scrollbar-color);
  }
`;

const DocumentsContainer = styled(Box)`
  max-height: 500px;
  overflow-y: auto;
  border-radius: var(--chakra-radii-md);
  
  /* Custom scrollbar styling */
  &::-webkit-scrollbar {
    width: 8px;
  }
  
  &::-webkit-scrollbar-track {
    background: transparent;
    border-radius: 4px;
  }
  
  &::-webkit-scrollbar-thumb {
    background: var(--scrollbar-color);
    border-radius: 4px;
  }
  
  &::-webkit-scrollbar-thumb:hover {
    background: var(--scrollbar-color);
  }
`;

const ProjectHeader = styled(Box)`
  background-color: var(--secondary-color);
  padding: 8px 12px;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-default-color);
  border-bottom: 1px solid var(--default-border-color);
`;

const DocumentName = styled(ChakraText)`
  font-size: 14px;
  line-height: 1.4;
  font-weight: 400;
  color: var(--text-default-color);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
  max-height: 40px; /* 2 lines * line height */
  max-width: calc(100% - 60px); /* Added more space for the three dots menu */
  padding-right: 4px; /* Extra padding to ensure separation */
`;

const ProjectTag = styled(Tag)`
  position: absolute;
  bottom: 8px;
  right: 8px;
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 12px;
  background-color: var(--secondary-color);
  color: var(--text-default-color);
  z-index: 1;
`;

const UnassignedTag = styled(Tag)`
  position: absolute;
  bottom: 8px;
  right: 8px;
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 12px;
  background-color: var(--secondary-color);
  color: var(--text-default-color);
  font-style: italic;
  z-index: 1;
`;

const SearchContainer = styled(Box)`
  margin-bottom: 10px;
`;

const truncateDocumentName = (name: string, maxLength: number = 30) => {
  if (name.length <= maxLength) return name;
  return `${name.substring(0, maxLength)}...`;
};

const UNASSIGNED_PROJECT_NAME = "Unassigned";

// DeleteProjectButton component for project deletion
const DeleteProjectButton: FC<{
  project: Project;
  onDelete: (project: Project) => void;
}> = ({ project, onDelete }) => {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const cancelRef = useRef(null);
  
  const handleConfirm = () => {
    onDelete(project);
    onClose();
  };

  return (
    <>
      <Tooltip label="Delete this project">
        <IconButton
          aria-label="Delete project"
          icon={<Trash2 size={16} />}
          size="sm"
          variant="ghost"
          onClick={onOpen}
          color="var(--text-default-color)"
          _hover={{ bg: "var(--secondary-hover-color)" }}
        />
      </Tooltip>
      
      <AlertDialog
        isOpen={isOpen}
        leastDestructiveRef={cancelRef}
        onClose={onClose}
      >
        <AlertDialogOverlay>
          <AlertDialogContent 
            bg="var(--card-content-background)"
            borderColor="var(--default-border-color)"
          >
            <AlertDialogHeader fontSize="lg" fontWeight="bold" color="var(--text-default-color)">
              Delete Project
            </AlertDialogHeader>
            
            <AlertDialogBody color="var(--text-default-color)">
              Are you sure you want to delete "{project.name}"? 
              This action cannot be undone.
            </AlertDialogBody>
            
            <AlertDialogFooter>
              <Button 
                ref={cancelRef} 
                onClick={onClose}
                color="var(--text-default-color)"
                bg="var(--secondary-color)"
                _hover={{ bg: "var(--secondary-hover-color)" }}
              >
                Cancel
              </Button>
              <Button 
                colorScheme="red" 
                onClick={handleConfirm} 
                ml={3}
              >
                Delete
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </>
  );
};

//
// -- Main Export --
export const Projects: FC<{
  selectedActivityId: number | null;
  onSelectActivity: (activityId: number | null) => void;
}> = ({ selectedActivityId, onSelectActivity }) => {
  const { 
    state, 
    selectProject, 
    addProject, 
    deleteProject, 
    updateProject,
    updateActivityName,
    addBlankActivity,
    addUnassignedActivity,
    deleteActivity,
    updateActivityContent
  } = useProject();
  
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<null | number>(null);

  const currentProject = useMemo(() => 
    state.projects.find(p => p.id === state.selectedProject),
    [state.projects, state.selectedProject]
  );

  // Filter out the unassigned project for the dropdown
  const visibleProjects = useMemo(() => 
    state.projects.filter(p => p.name !== UNASSIGNED_PROJECT_NAME),
    [state.projects]
  );

  const handleProjectSelect = (project: Project) => {
    selectProject(project.id);
  };

  const handleUnselectProject = () => {
    selectProject(undefined);
  };

  const handleNewProject = () => {
    setSelectedProjectId(null);
    setModalOpen(true);
  };

  const handleEditProject = (project: Project) => {
    setSelectedProjectId(project.id);
    setModalOpen(true);
  };

  const handleDeleteProject = (project: Project) => {
    deleteProject(project.id);
    if (state.selectedProject === project.id) {
      selectProject(undefined);
    }
  };

  const handleClose = () => {
    setModalOpen(false);
    setSelectedProjectId(null);
  };

  const handleActivitySelect = (activityId: number) => {
    onSelectActivity(activityId);
  };

  return (
    <Container>
      <ProjectSelector
        projects={visibleProjects}
        allProjects={state.projects}
        selectedProject={currentProject}
        onSelectProject={handleProjectSelect}
        onUnselectProject={handleUnselectProject}
        onNewProject={handleNewProject}
        onEditProject={handleEditProject}
        onDeleteProject={handleDeleteProject}
        selectedActivityId={selectedActivityId}
        onSelectActivity={handleActivitySelect}
        onUpdateActivityName={updateActivityName}
        onAddBlankActivity={addBlankActivity}
        onAddUnassignedActivity={addUnassignedActivity}
        onDeleteActivity={deleteActivity}
        onUpdateActivityContent={updateActivityContent}
      />
      
      <ProjectModal
        isOpen={modalOpen}
        projectId={selectedProjectId}
        onClose={handleClose}
        onUpdate={updateProject}
        onSave={addProject}
      />
    </Container>
  );
};

//
// -- ProjectSelector Component --
type ActivityDocument = {
  id: number;
  activity_id: number | null;
  name: string;
  projectId: number;
  projectName: string;
};

const ProjectSelector: FC<{
  projects: Project[];
  allProjects: Project[];
  selectedProject: Project | undefined;
  onSelectProject: (project: Project) => void;
  onUnselectProject: () => void;
  onNewProject: () => void;
  onEditProject: (project: Project) => void;
  onDeleteProject: (project: Project) => void;
  selectedActivityId: number | null;
  onSelectActivity: (activityId: number) => void;
  onUpdateActivityName: (activityId: number, name: string) => void;
  onAddBlankActivity: () => Promise<number | undefined>;
  onAddUnassignedActivity: () => Promise<number | undefined>;
  onDeleteActivity: (activityId: number) => void;
  onUpdateActivityContent?: (activityId: number, content: string) => void;
}> = ({
  projects,
  allProjects,
  selectedProject,
  onSelectProject,
  onUnselectProject,
  onNewProject,
  onEditProject,
  onDeleteProject,
  selectedActivityId,
  onSelectActivity,
  onUpdateActivityName,
  onAddBlankActivity,
  onAddUnassignedActivity,
  onDeleteActivity,
  onUpdateActivityContent
}) => {
  const [editingActivityId, setEditingActivityId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [documentSearchTerm, setDocumentSearchTerm] = useState("");
  
  // Add voice note recording states
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioURL, setAudioURL] = useState<string | null>(null);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isProcessingRecording, setIsProcessingRecording] = useState(false);
  const timerRef = useRef<number | null>(null);
  const recordingStartTime = useRef<number | null>(null);
  const audioChunks = useRef<Blob[]>([]);
  
  // Add a state to store the current recording file path
  const [recordingFilePath, setRecordingFilePath] = useState<string | null>(null);
  
   // Add states for HTML processing
   const [htmlToProcess, setHtmlToProcess] = useState<string | null>(null);
   const [pendingActivityData, setPendingActivityData] = useState<{
     activityId: number | undefined;
     plainText: string;
     isHtml: boolean;
   } | null>(null);

  // Add toast
  const toast = useToast();
  
  // Function to format recording time as mm:ss
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
  // Start recording function
  const startRecording = async () => {
    try {
      // Check if OpenAI API key is set before starting recording
      const settings = await invoke<{api_key_open_ai: string}>('get_openai_api_key');
      
      if (!settings.api_key_open_ai) {
        toast({
          title: "API key required",
          description: "An OpenAI API key is required for voice note transcription.",
          status: "warning",
          duration: 10000,
          isClosable: true,
          position: "top",
          render: ({ onClose }) => (
            <Box 
              p={4} 
              bg="yellow.100" 
              color="yellow.800" 
              borderRadius="md" 
              boxShadow="md"
            >
              <Flex direction="column" gap={3}>
                <ChakraText fontWeight="bold">API Key Required</ChakraText>
                <ChakraText>
                  An OpenAI API key is required for voice note transcription.
                  Please add it in the Settings menu (top-right corner).
                </ChakraText>
                <Flex justify="flex-end">
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    onClick={onClose}
                  >
                    Close
                  </Button>
                </Flex>
              </Flex>
            </Box>
          )
        });
        return;
      }
      
      // Reset audio state
      setAudioURL(null);
      setAudioBlob(null);
      setRecordingFilePath(null);
      setRecordingTime(0);
      
      // Call the Tauri command to start recording
      const filePath = await invoke<string>('start_audio_recording');
      setRecordingFilePath(filePath);
      console.log("Recording started, file path:", filePath);
      
      // Start timer using actual timestamps for more accuracy
      recordingStartTime.current = Date.now();
      timerRef.current = window.setInterval(() => {
        if (recordingStartTime.current) {
          const elapsedSeconds = Math.floor((Date.now() - recordingStartTime.current) / 1000);
          setRecordingTime(elapsedSeconds);
        }
      }, 1000);
      
      setIsRecording(true);
    } catch (error) {
      console.error("Failed to start recording:", error);
      toast({
        title: "Recording failed",
        description: "Could not start voice recording. Please try again.",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    }
  };
  
  // Stop recording function
  const stopRecording = async () => {
    try {
      // Show processing state immediately
      setIsProcessingRecording(true);
      setIsRecording(false);
      
      // Clear timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      
      // Final time snapshot for accuracy
      if (recordingStartTime.current) {
        const elapsedSeconds = Math.floor((Date.now() - recordingStartTime.current) / 1000);
        setRecordingTime(elapsedSeconds);
        recordingStartTime.current = null;
      }
      
      // Call the Tauri command to stop recording
      const filePath = await invoke<string>('stop_audio_recording');
      setRecordingFilePath(filePath);
      console.log("Recording stopped, file path:", filePath);
      
      // Delay reading the file to improve UI responsiveness
      setTimeout(async () => {
        try {
          // Read the file using Tauri's fs API
          const audioBytes = await invoke<number[]>('read_audio_file', { filePath });
          const audioArray = new Uint8Array(audioBytes);
          const blob = new Blob([audioArray], { type: 'audio/wav' });
          setAudioBlob(blob);
          const url = URL.createObjectURL(blob);
          setAudioURL(url);
        } catch (readError) {
          console.error("Failed to read audio file:", readError);
          toast({
            title: "Error reading recording",
            description: "Could not load the audio recording for playback.",
            status: "error",
            duration: 3000,
            isClosable: true,
          });
        } finally {
          setIsProcessingRecording(false);
        }
      }, 100); // Small delay to allow UI to update
      
    } catch (error) {
      console.error("Failed to stop recording:", error);
      setIsProcessingRecording(false);
      toast({
        title: "Recording error",
        description: "An error occurred while stopping the recording.",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    }
  };
  
  // Function to transcribe audio
  const transcribeAudio = async () => {
    if (!recordingFilePath) {
      console.error("No recording file path available");
      toast({
        title: "Transcription failed",
        description: "No recording file available",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
      return;
    }
    
    try {
      setIsTranscribing(true);
      
      // Call transcription API directly with the file path
      const transcription = await invoke<string>('transcribe_audio', { 
        filePath: recordingFilePath 
      }).catch(error => {
        console.error("Transcription API error:", error);
        toast({
          title: "Transcription failed",
          description: error.toString().includes("OpenAI API key") 
            ? "OpenAI API key is required for audio transcription. Please add it in Settings." 
            : "Failed to transcribe audio. Please try again.",
          status: "error",
          duration: 5000,
          isClosable: true,
        });
        throw error;
      });
      
      // Create a new activity with the transcription
      let newActivityId;
      
      if (selectedProject) {
        console.log('Creating voice note in selected project:', selectedProject.name);
        newActivityId = await onAddBlankActivity();
      } else {
        console.log('Creating voice note in unassigned project');
        newActivityId = await onAddUnassignedActivity();
      }
      
      if (newActivityId) {
        // Name the document with the current date and time
        const date = new Date();
        const documentName = `Voice Note ${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
        
        // Update the name and content
        await onUpdateActivityName(newActivityId, documentName);
        
        // Update content if available
        if (onUpdateActivityContent) {
          await onUpdateActivityContent(newActivityId, transcription);
        } else {
          // Fallback to direct invoke
          await invoke("update_project_activity_text", {
            activityId: newActivityId,
            text: transcription
          });
        }
        
        // Clear audio state
        setAudioBlob(null);
        setAudioURL(null);
        setRecordingFilePath(null);
        
        // Show success message
        toast({
          title: "Transcription complete",
          description: "Voice note has been transcribed and saved successfully",
          status: "success",
          duration: 3000,
          isClosable: true,
        });
      }
      
      setIsTranscribing(false);
      
    } catch (error) {
      console.error("Error during transcription process:", error);
      setIsTranscribing(false);
    }
  };
  
  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  // Filter projects by name
  const filteredProjects = useMemo(() => {
    if (!searchTerm.trim()) return projects;
    return projects.filter((p) =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [projects, searchTerm]);

  // Get all activities across all projects or from the selected project only
  const allDocuments = useMemo(() => {
    if (selectedProject) {
      // Only return this project's activities
      return selectedProject.activities.map((_, index) => ({
        id: selectedProject.activities[index],
        activity_id: selectedProject.activity_ids[index],
        name: selectedProject.activity_names[index] 
          || `Document ${selectedProject.activities[index]}`,
        projectId: selectedProject.id,
        projectName: selectedProject.name
      }));
    }
    // Otherwise, gather from all projects
    return allProjects.flatMap(project => 
      project.activities.map((_, index) => ({
        id: project.activities[index],
        activity_id: project.activity_ids[index],
        name: project.activity_names[index] 
          || `Document ${project.activities[index]}`,
        projectId: project.id,
        projectName: project.name
      }))
    );
  }, [selectedProject, allProjects]);

  // Filter documents by name/project name
  const filteredDocuments = useMemo(() => {
    if (!documentSearchTerm.trim()) return allDocuments;
    return allDocuments.filter(doc => 
      doc.name.toLowerCase().includes(documentSearchTerm.toLowerCase()) ||
      doc.projectName.toLowerCase().includes(documentSearchTerm.toLowerCase())
    );
  }, [allDocuments, documentSearchTerm]);

  // Sort documents by descending ID for recency
  const sortedDocuments = useMemo(() => {
    return [...filteredDocuments].sort((a, b) => b.id - a.id);
  }, [filteredDocuments]);

  // Start renaming a document
  const handleStartEdit = (activity: { id: number; name: string }) => {
    setEditingActivityId(activity.id);
    setEditingName(activity.name);
  };

  // Save document name change
  const handleSaveEdit = () => {
    if (editingActivityId && editingName.trim()) {
      onUpdateActivityName(editingActivityId, editingName.trim());
      setEditingActivityId(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      setEditingActivityId(null);
    }
  };

  // Create a new document in selected or unassigned project
  const handleAddNewDocument = async () => {
    let newActivityId;
    
    if (selectedProject) {
      newActivityId = await onAddBlankActivity();
    } else {
      newActivityId = await onAddUnassignedActivity();
    }
    
    if (newActivityId) {
      // Give it a default name first
      await onUpdateActivityName(newActivityId, "New Document");
      // Then immediately select it to open the editor
      onSelectActivity(newActivityId);
    }
  };

  // Select a document without forcing a project switch
  const handleDocumentSelect = (document: ActivityDocument) => {
    onSelectActivity(document.id);
  };

  // Delete a document
  const handleDeleteDocument = (e: React.MouseEvent, document: ActivityDocument) => {
    e.stopPropagation();
    onDeleteActivity(document.id);
  };

  // Handle paste events to create new documents
  // Add this function to handle HTML processing
  const processHtmlContent = useCallback(async (processedHtml: string) => {
    // Only proceed if we have pending activity data
    if (pendingActivityData && pendingActivityData.activityId) {
      const { activityId, plainText, isHtml } = pendingActivityData;
      
      // Use a simple "New Document" title for HTML content
      const documentName = isHtml ? 'New Document' : 'Pasted Document';
      
      console.log('Setting document name:', documentName);
      await onUpdateActivityName(activityId, documentName);
      
      // Update content with the processed HTML
      let contentUpdateSuccess = false;
      
      if (onUpdateActivityContent) {
        try {
          await onUpdateActivityContent(activityId, processedHtml);
          console.log('Document content updated successfully via callback');
          contentUpdateSuccess = true;
        } catch (error) {
          console.error('Failed to update document content via callback:', error);
        }
      }
      
      // Fallback to direct Tauri invoke if callback fails
      if (!contentUpdateSuccess) {
        try {
          console.log('Trying direct Tauri invoke as fallback');
          await invoke("update_project_activity_text", {
            activityId,
            text: processedHtml
          });
          console.log('Document content updated successfully via direct invoke');
        } catch (error) {
          console.error('Failed to update document content via direct invoke:', error);
        }
      }
      
      // Select the new document
      console.log('Selecting new document');
      onSelectActivity(activityId);
      
      // Clear pending data
      setPendingActivityData(null);
    }
  }, [pendingActivityData, onUpdateActivityName, onUpdateActivityContent, onSelectActivity, toast]);

  // Enhanced paste handler that captures and processes HTML
  const handlePaste = async (e: React.ClipboardEvent) => {
    e.preventDefault();
    
    // Try to get HTML content first
    let content = e.clipboardData.getData('text/html');
    let isHtml = !!content.trim();
    
    // Fall back to plain text if no HTML is available
    if (!isHtml) {
      content = e.clipboardData.getData('text');
    }
    
    // Get plain text for fallback and title extraction
    const plainText = e.clipboardData.getData('text');
    
    if (content.trim()) {
      console.log('Paste event detected, isHtml:', isHtml);
      
      try {
        // Create a new activity
        let newActivityId;
        if (selectedProject) {
          console.log('Creating document in selected project:', selectedProject.name);
          newActivityId = await onAddBlankActivity();
        } else {
          console.log('Creating document in unassigned project');
          newActivityId = await onAddUnassignedActivity();
        }
        
        console.log('New activity ID created:', newActivityId);
        
        if (newActivityId) {
          if (isHtml) {
            // For HTML content, set up the state for processing
            setPendingActivityData({
              activityId: newActivityId,
              plainText,
              isHtml
            });
            
            // Trigger HTML processing with the hidden TipTap editor
            setHtmlToProcess(content);
          } else {
            // For plain text, handle directly
            const firstLine = plainText.split('\n')[0].trim();
            const documentName = firstLine ? 
              (firstLine.length > 30 ? firstLine.substring(0, 30) + '...' : firstLine) : 
              'Pasted Document';
            
            console.log('Setting document name:', documentName);
            await onUpdateActivityName(newActivityId, documentName);
            
            // Update the content with plain text
            let contentUpdateSuccess = false;
            
            if (onUpdateActivityContent) {
              try {
                await onUpdateActivityContent(newActivityId, plainText);
                console.log('Document content updated successfully via callback');
                contentUpdateSuccess = true;
              } catch (error) {
                console.error('Failed to update document content via callback:', error);
              }
            }
            
            // Fallback to direct Tauri invoke if callback fails
            if (!contentUpdateSuccess) {
              try {
                console.log('Trying direct Tauri invoke as fallback');
                await invoke("update_project_activity_text", {
                  activityId: newActivityId,
                  text: plainText
                });
                console.log('Document content updated successfully via direct invoke');
              } catch (error) {
                console.error('Failed to update document content via direct invoke:', error);
              }
            }
            
            // Select the new document
            console.log('Selecting new document');
            onSelectActivity(newActivityId);
          }
        }
      } catch (error) {
        console.error('Error during paste processing:', error);
        toast({
          title: "Error processing paste",
          description: "Failed to process pasted content",
          status: "error",
          duration: 3000,
          isClosable: true,
        });
      }
    }
  };

  // Add function to discard the recording
  const discardRecording = () => {
    // Release URL object to prevent memory leaks
    if (audioURL) {
      URL.revokeObjectURL(audioURL);
    }
    
    // Reset all recording-related states
    setAudioURL(null);
    setAudioBlob(null);
    setRecordingFilePath(null);
    setRecordingTime(0);
    setIsProcessingRecording(false);
  };

  // Handle file import
  const handleFileImport = async () => {
    try {
      // Open file dialog to select files
      const selected = await open({
        multiple: false,
        filters: [{
          name: 'Documents',
          extensions: ['pdf', 'docx', 'txt', 'md', 'rtf']
        }]
      });
      
      if (!selected || Array.isArray(selected)) return;
      
      // Show loading toast
      const loadingToast = toast({
        title: "Importing document",
        description: "Please wait while we process your file...",
        status: "info",
        duration: null,
        isClosable: false,
      });
      
      try {
        // Extract text from file using Tauri command
        const extractedText = await invoke<string>('extract_document_text', { 
          filePath: selected
        });
        
        // Get filename without extension for the document title
        const fileName = selected.split('/').pop() || '';
        const documentName = fileName.includes('.') 
          ? fileName.substring(0, fileName.lastIndexOf('.'))
          : fileName;
        
        // Create new activity
        let newActivityId;
        if (selectedProject) {
          newActivityId = await onAddBlankActivity();
        } else {
          newActivityId = await onAddUnassignedActivity();
        }
        
        if (newActivityId && extractedText) {
          // Update activity name and content
          await onUpdateActivityName(newActivityId, documentName);
          
          if (onUpdateActivityContent) {
            await onUpdateActivityContent(newActivityId, extractedText);
          } else {
            // Fallback to direct invoke
            await invoke("update_project_activity_text", {
              activityId: newActivityId,
              text: extractedText
            });
          }
          
          // Select the new document
          onSelectActivity(newActivityId);
          
          // Close loading toast and show success
          toast.close(loadingToast);
          toast({
            title: "Import successful",
            description: `"${documentName}" has been imported successfully.`,
            status: "success",
            duration: 3000,
            isClosable: true,
          });
        }
      } catch (error) {
        console.error("Error importing document:", error);
        toast.close(loadingToast);
        toast({
          title: "Import failed",
          description: "Failed to import document. Please try again.",
          status: "error",
          duration: 5000,
          isClosable: true,
        });
      }
    } catch (error) {
      console.error("Error selecting file:", error);
    }
  };

  return (
    <Flex direction="column" w="full" gap={4} overflow="hidden">
      <Flex gap={2} w="full" align="center">
        <Menu>
          <Flex position="relative" w="full">
            <StyledMenuButton w="full">
              <Text type="m" bold>
                {selectedProject ? selectedProject.name : 'Select a Project'}
              </Text>
            </StyledMenuButton>

            {selectedProject && (
              <IconButton
                position="absolute"
                right="2"
                top="50%"
                transform="translateY(-50%)"
                aria-label="Unselect project"
                icon={<X size={14} />}
                size="xs"
                variant="ghost"
                zIndex="1"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onUnselectProject();
                }}
                _hover={{ bg: 'gray.100' }}
              />
            )}
          </Flex>

          <ScrollableMenuList minW="240px" w="240px" py={0}>
            {/* Sticky search box */}
            <Box 
              p={2} 
              h="56px" 
              display="flex" 
              alignItems="center" 
              position="sticky" 
              top="0" 
              bg="var(--card-content-background)" 
              zIndex="1"
            >
              <InputGroup size="sm">
                <InputLeftElement pointerEvents="none">
                  <Search size={14} color="var(--text-default-color)" />
                </InputLeftElement>
                <Input
                  placeholder="Search Projects..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck="false"
                  bg="var(--card-content-background)"
                  color="var(--text-default-color)"
                  borderColor="var(--default-border-color)"
                  _hover={{ borderColor: "var(--active-border-color)" }}
                  _focus={{ borderColor: "var(--active-border-color)" }}
                />
              </InputGroup>
            </Box>
            <Divider my={0} borderColor="var(--default-border-color)" opacity={1} sx={{
              '[data-theme="dark"] &': {
                borderColor: 'var(--secondary-color)'
              }
            }} />

            {/* "Create New Project" at the top */}
            <MenuItem 
              icon={<FolderPlus size={16} />}
              onClick={onNewProject}
              p={3}
              h="40px"
              bg="var(--card-content-background)"
              _hover={{ bg: '#EDF2F7' }}
              _focus={{ bg: '#EDF2F7' }}
              sx={{
                '[data-theme="dark"] &:hover': {
                  bg: '#334155'
                },
                '[data-theme="dark"] &:focus': {
                  bg: '#334155'
                }
              }}
            >
              <Text type="m">Create New Project</Text>
            </MenuItem>
            {/* <Divider my={2} borderColor="var(--default-border-color)" opacity={0.6} sx={{
              '[data-theme="dark"] &': {
                borderColor: 'var(--secondary-color)'
              }
            }} /> */}

            <Box>
              {filteredProjects.map((project) => (
                <MenuItem 
                  key={project.id}
                  onClick={() => onSelectProject(project)}
                  p={3}
                  h="40px"
                  bg="var(--card-content-background)"
                  _hover={{ bg: '#EDF2F7' }}
                  _focus={{ bg: '#EDF2F7' }}
                  sx={{
                    '[data-theme="dark"] &:hover': {
                      bg: '#334155'
                    },
                    '[data-theme="dark"] &:focus': {
                      bg: '#334155'
                    }
                  }}
                >
                  <Flex justify="space-between" align="center" w="full">
                    <Text type="m">{project.name}</Text>
                    <Badge colorScheme="blue" ml={2}>
                      {project.activities.length} docs
                    </Badge>
                  </Flex>
                </MenuItem>
              ))}
            </Box>
          </ScrollableMenuList>
        </Menu>
        {/* Removed the separate "Create New Project" plus icon */}
      </Flex>

      {/* Document list section */}
      <Flex direction="column" w="full">
        <Flex justify="space-between" align="center" mb={3}>
          <Text type="m" bold>
            {selectedProject ? `${selectedProject.name} Documents` : "All Documents"}
          </Text>
          
          <Flex gap={2}>
            {/* Voice note recording button */}
            <Tooltip label={isRecording ? "Stop recording" : "Record a voice note"}>
              <IconButton
                aria-label={isRecording ? "Stop recording" : "Record a voice note"}
                icon={isRecording ? <Square size={16} /> : <Mic size={16} />}
                size="sm"
                variant={isRecording ? "solid" : "ghost"}
                onClick={isRecording ? stopRecording : startRecording}
                colorScheme={isRecording ? "red" : "gray"}
                color="var(--text-default-color)"
                _hover={{ bg: "var(--secondary-hover-color)" }}
              />
            </Tooltip>
            
            {/* File import button */}
            <Tooltip label="Import document (PDF, DOCX, etc.)">
              <IconButton
                aria-label="Import document"
                icon={<FileUp size={16} />}
                size="sm"
                variant="ghost"
                onClick={handleFileImport}
                color="var(--text-default-color)"
                _hover={{ bg: "var(--secondary-hover-color)" }}
              />
            </Tooltip>
            
            {/* Button for creating a new document */}
            <Tooltip label="Create a new document">
              <IconButton
                aria-label="Add new document"
                icon={<FilePlus size={16} />}
                size="sm"
                variant="ghost"
                onClick={handleAddNewDocument}
                color="var(--text-default-color)"
                _hover={{ bg: "var(--secondary-hover-color)" }}
              />
            </Tooltip>
            
            {/* Only show delete button when a project is selected */}
            {selectedProject && (
              <DeleteProjectButton 
                project={selectedProject} 
                onDelete={onDeleteProject} 
              />
            )}
          </Flex>
        </Flex>
        
        {/* Display recording info and transcribe button when audioURL is available */}
        {(isRecording || audioURL || isProcessingRecording) && (
          <Box 
            p={3} 
            mb={3} 
            borderRadius="md" 
            borderWidth="1px" 
            borderColor="gray.200"
            bg="gray.50"
            position="relative"
          >
            {/* Add delete button if audio is ready */}
            {audioURL && (
              <Tooltip label="Discard recording">
                <IconButton
                  aria-label="Discard recording"
                  icon={<Trash2 size={14} />}
                  size="xs"
                  variant="ghost"
                  position="absolute"
                  top="6px"
                  right="6px"
                  color="gray.500"
                  _hover={{ color: "red.500", bg: "gray.100" }}
                  onClick={discardRecording}
                />
              </Tooltip>
            )}
            
            <Flex direction="column" gap={2}>
              {isRecording ? (
                <Flex align="center" gap={2}>
                  <Box color="red.500" animation="pulse 1.5s infinite">
                    <Mic size={16} />
                  </Box>
                  <ChakraText color="red.500" fontSize="sm">Recording: {formatTime(recordingTime)}</ChakraText>
                </Flex>
              ) : isProcessingRecording ? (
                <Flex align="center" gap={2} justifyContent="center">
                  <Button
                    isLoading
                    loadingText="Processing recording..."
                    variant="ghost"
                    pointerEvents="none"
                    size="sm"
                  />
                </Flex>
              ) : audioURL && (
                <>
                  <Flex align="center" gap={2}>
                    <Headphones size={16} />
                    <ChakraText fontSize="sm">Voice Note Ready ({formatTime(recordingTime)})</ChakraText>
                  </Flex>
                  <Box>
                    <audio src={audioURL} controls style={{ width: '100%' }} />
                  </Box>
                  <Button 
                    colorScheme="blue"
                    size="sm"
                    isLoading={isTranscribing}
                    loadingText="Transcribing..."
                    onClick={transcribeAudio}
                  >
                    Transcribe Voice Note
                  </Button>
                </>
              )}
            </Flex>
          </Box>
        )}
        
        <SearchContainer mb={3}>
          <InputGroup size="md">
            <InputLeftElement pointerEvents="none">
              <Search size={16} color="var(--chakra-colors-gray-400)" />
            </InputLeftElement>
            <Input
              placeholder="Search documents..."
              value={documentSearchTerm}
              onChange={(e) => setDocumentSearchTerm(e.target.value)}
              autoComplete="off"
              autoCorrect="off"
              spellCheck="false"
              borderRadius="full"
              _focus={{
                boxShadow: "0 0 0 1px var(--chakra-colors-blue-400)",
                borderColor: "blue.400"
              }}
            />
          </InputGroup>
        </SearchContainer>
        
        <DocumentsContainer 
          onPaste={handlePaste}
          tabIndex={0}
        >
          <Box>
            {sortedDocuments.length > 0 ? (
              sortedDocuments.map((document) => (
                <Flex
                  key={document.id}
                  p={3}
                  mb={1}
                  borderRadius="md"
                  align="center"
                  justify="space-between"
                  _hover={{ bg: '#EDF2F7' }}
                  transition="all 0.2s"
                  bg={selectedActivityId === document.id ? 'blue.50' : 'var(--card-content-background)'}
                  color={selectedActivityId === document.id ? 'blue.600' : 'var(--text-default-color)'}
                  fontWeight={selectedActivityId === document.id ? 'bold' : 'normal'}
                  onClick={() => editingActivityId !== document.id && handleDocumentSelect(document)}
                  cursor="pointer"
                  position="relative"
                  minHeight="55px"
                  role="group"
                  sx={{
                    '[data-theme="dark"] &:hover': {
                      bg: '#334155'
                    },
                    '[data-theme="dark"] &': {
                      bg: selectedActivityId === document.id ? '#2d395a' : 'var(--card-content-background)',
                      color: selectedActivityId === document.id ? '#4d7bbd' : 'var(--text-default-color)'
                    }
                  }}
                >
                  <Flex align="center" gap={3} flex={1}>
                    <Box color="var(--text-default-color)">
                      <File size={16} />
                    </Box>
                    <Box flex={1}>
                      {editingActivityId === document.id ? (
                        <Input
                          value={editingName}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditingName(e.target.value)}
                          onBlur={handleSaveEdit}
                          onKeyDown={handleKeyDown}
                          onClick={(e: React.MouseEvent) => e.stopPropagation()}
                          autoFocus
                          size="sm"
                          variant="unstyled"
                        />
                      ) : (
                        <Box>
                          <DocumentName>
                            {truncateDocumentName(document.name)}
                          </DocumentName>
                          
                          {/* Show project tag only if no project filter is applied */}
                          {!selectedProject && (
                            document.projectName === UNASSIGNED_PROJECT_NAME ? (
                              <></>
                            ) : (
                              <ProjectTag size="sm" variant="subtle">
                                {document.projectName}
                              </ProjectTag>
                            )
                          )}
                        </Box>
                      )}
                    </Box>
                  </Flex>
                  
                  {/* Three dots menu in the top-right corner */}
                  {!editingActivityId && (
                    <Menu placement="auto" isLazy>
                      <MenuButton
                        as={IconButton}
                        aria-label="Document options"
                        icon={<MoreHorizontal size={14} />}
                        size="xs"
                        variant="ghost"
                        opacity="0"
                        _groupHover={{ opacity: 1 }}
                        onClick={(e: React.MouseEvent) => e.stopPropagation()}
                        position="absolute"
                        top="2"
                        right="2"
                      />
                      <MenuList minW="150px" zIndex={1000}>
                        <MenuItem
                          icon={<Edit size={14} />}
                          onClick={(e: React.MouseEvent) => {
                            e.stopPropagation();
                            handleStartEdit(document);
                          }}
                        >
                          Rename
                        </MenuItem>
                        <MenuItem
                          icon={<Trash2 size={14} />}
                          onClick={(e: React.MouseEvent) => handleDeleteDocument(e, document)}
                          color="red.500"
                        >
                          Delete
                        </MenuItem>
                      </MenuList>
                    </Menu>
                  )}
                </Flex>
              ))
            ) : (
              <Flex 
                justify="center" 
                align="center" 
                p={8}
                color="gray.500"
                flexDirection="column"
                gap={2}
              >
                <File size={24} />
                <Text type="m">
                  {documentSearchTerm 
                    ? "No matching documents found" 
                    : selectedProject 
                      ? "No documents added yet" 
                      : "No documents added yet"}
                </Text>
              </Flex>
            )}
          </Box>
        </DocumentsContainer>
      </Flex>
      <HtmlSanitizer 
        htmlToProcess={htmlToProcess} 
        onHtmlProcessed={(html) => {
          processHtmlContent(html);
          setHtmlToProcess(null);
        }} 
      />
    </Flex>
  );
};
