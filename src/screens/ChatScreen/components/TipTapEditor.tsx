import { type FC, useState, useEffect, useRef, useCallback } from "react";
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TextStyle from '@tiptap/extension-text-style';
import FontFamily from '@tiptap/extension-font-family';
import History from '@tiptap/extension-history';
import {
  Box,
  Button,
  Flex,
  Text,
  Card,
  CardHeader,
  CardBody,
  HStack,
  IconButton,
  Input,
  Tooltip,
  AlertDialog,
  AlertDialogBody,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogContent,
  AlertDialogOverlay,
  useDisclosure,
  Select,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  useToast,
  InputGroup,
  InputLeftElement,
  Divider
} from '@chakra-ui/react';  
import { Edit2, Save, X, Bold, Italic, List, Undo, Redo, FolderPlus, ChevronDown, Search } from "lucide-react";
import { useProject } from "../../../state";
import { UNASSIGNED_PROJECT_NAME } from "../../../data/project";

type TipTapEditorProps = {
  content: string;
  title: string;
  isEditing: boolean;
  documentId: number; // Document ID to identify which document we're working with
  onEdit: () => void; 
  onSave: (content: string, title: string) => void;
  onCancel: () => void;
};

export const TipTapEditor: FC<TipTapEditorProps> = ({
  content,
  title,
  isEditing,
  documentId,
  onEdit,
  onSave,
  onCancel,
}) => {
  const [hasChanges, setHasChanges] = useState(false);
  const [documentTitle, setDocumentTitle] = useState(title);
  const [currentFont, setCurrentFont] = useState('Inter');
  const [projectSearchTerm, setProjectSearchTerm] = useState("");
  const titleInputRef = useRef<HTMLInputElement>(null);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const toast = useToast();
  // Add ref for debouncing editor updates
  const updateTimeoutRef = useRef<number | null>(null);
  
  const fonts = [
    { name: 'Inter', value: 'Inter' },
    { name: 'Arial', value: 'Arial, sans-serif' },
    { name: 'Times New Roman', value: 'Times New Roman, serif' },
    { name: 'Courier New', value: 'Courier New, monospace' },
    { name: 'Georgia', value: 'Georgia, serif' },
    { name: 'Verdana', value: 'Verdana, sans-serif' },
    { name: 'Roboto', value: 'Roboto, sans-serif' },
    { name: 'Open Sans', value: 'Open Sans, sans-serif' }
  ];
  
  // Get project-related data and functions
  const { 
    getVisibleProjects, 
    getActivityProject,
    moveActivity
  } = useProject();
  
  // Check if the current document is in the Unassigned project
  const documentProject = getActivityProject(documentId);
  const isUnassignedDocument = documentProject?.name === UNASSIGNED_PROJECT_NAME;
  
  // Get all projects excluding Unassigned for the dropdown
  const availableProjects = getVisibleProjects();
  
  // Filter projects based on search term
  const filteredProjects = availableProjects.filter(project => 
    project.name.toLowerCase().includes(projectSearchTerm.toLowerCase())
  );
  
  // Debounced update handler
  const debouncedUpdateHandler = useCallback(({ editor }: { editor: any }) => {
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }
    
    updateTimeoutRef.current = window.setTimeout(() => {
      setHasChanges(editor.getHTML() !== content || documentTitle !== title);
    }, 250) as unknown as number; // Debounce updates by 250ms
  }, [content, documentTitle, title]);
  
  const editor = useEditor({
    extensions: [
      // Replace default StarterKit History with optimized History
      StarterKit.configure({
        history: false, // Disable built-in history
      }),
      // Add optimized History extension
      History.configure({
        depth: 50,               // Reduce history stack (default 100)
        newGroupDelay: 1000,     // Increase delay for history grouping (default 500ms)
      }),
      TextStyle,
      FontFamily
    ],
    content: content,
    editable: isEditing,
    onUpdate: debouncedUpdateHandler, // Use debounced handler
  });

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  useEffect(() => {
    setDocumentTitle(title);
  }, [title]);

  useEffect(() => {
    if (editor) {
      editor.setEditable(isEditing);
    }
  }, [isEditing, editor]);

  useEffect(() => {
    if (isEditing && titleInputRef.current) {
      titleInputRef.current.focus();
    }
  }, [isEditing]);
  
  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, []);

  const handleSave = () => {
    if (editor) {
      onSave(editor.getHTML(), documentTitle);
      setHasChanges(false);
    }
  };

  const handleCancel = () => {
    if (hasChanges) {
      // Open the custom alert dialog instead of using window.confirm
      onOpen();
    } else {
      onCancel();
    }
  };
  
  const handleConfirmCancel = () => {
    editor?.commands.setContent(content);
    setDocumentTitle(title);
    setHasChanges(false);
    onClose();
    onCancel();
  };

  const handleTitleChange = (newTitle: string) => {
    setDocumentTitle(newTitle);
    setHasChanges(newTitle !== title || (editor ? editor.getHTML() !== content : false));
  };

  const handleFontChange = (fontFamily: string) => {
    if (editor) {
      editor.chain().focus().setFontFamily(fontFamily).run();
      setCurrentFont(fontFamily);
    }
  };

  // Clear search when menu closes
  const handleMenuClose = () => {
    setProjectSearchTerm("");
  };

  // Handle project assignment
  const handleAssignToProject = async (projectId: number) => {
    try {
      if (editor) {
        // Save any pending changes first
        onSave(editor.getHTML(), documentTitle);
        
        // Get the target project for the notification
        const targetProject = availableProjects.find(p => p.id === projectId);
        
        // Use the moveActivity function from useProject hook
        const success = await moveActivity(documentId, projectId);
        
        if (success) {
          // Show success toast notification
          toast({
            title: "Document Assigned",
            description: `Document assigned to project "${targetProject?.name}"`,
            status: "success",
            duration: 3000,
            isClosable: true,
            position: "bottom-right"
          });
        } else {
          // Show error toast notification
          toast({
            title: "Error",
            description: "Failed to assign document to the selected project",
            status: "error",
            duration: 5000,
            isClosable: true,
            position: "bottom-right"
          });
        }
      }
    } catch (error) {
      console.error("Error assigning document to project:", error);
      toast({
        title: "Error",
        description: "Failed to assign document to the selected project",
        status: "error",
        duration: 5000,
        isClosable: true,
        position: "bottom-right"
      });
    }
  };

  return (
    <Box width="100%" padding="var(--space-l)">
      <AlertDialog
        isOpen={isOpen}
        leastDestructiveRef={cancelRef}
        onClose={onClose}
      >
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize="lg" fontWeight="bold">
              Discard Changes
            </AlertDialogHeader>

            <AlertDialogBody>
              You have unsaved changes. Are you sure you want to discard them?
            </AlertDialogBody>

            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={onClose}>
                Keep Editing
              </Button>
              <Button colorScheme="red" onClick={handleConfirmCancel} ml={3}>
                Discard Changes
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
      
      <Card width="100%" maxWidth="100%" bg="var(--card-content-background)" color="var(--text-default-color)" borderColor="var(--default-border-color)">
        <CardHeader 
          display="flex" 
          flexDirection="column" 
          alignItems="flex-start" 
          pb={2}
          bg="var(--card-content-background)"
          color="var(--text-default-color)"
        >
          <Flex 
            width="100%" 
            justifyContent="space-between" 
            alignItems="center"
          >
            {isEditing ? (
              <Input
                ref={titleInputRef}
                value={documentTitle}
                onChange={(e) => handleTitleChange(e.target.value)}
                placeholder="Document Title"
                size="lg"
                fontWeight="bold"
                border="none"
                padding="0"
                bg="var(--card-content-background)"
                color="var(--text-default-color)"
                _focus={{
                  boxShadow: "none",
                  borderBottom: "2px solid",
                  borderColor: "var(--active-border-color)",
                  borderRadius: "0"
                }}
                maxWidth="80%"
              />
            ) : (
              <Text 
                fontSize="xl" 
                fontWeight="bold" 
                isTruncated 
                maxWidth="80%"
                color="var(--text-default-color)"
              >
                {documentTitle || "Untitled Document"}
              </Text>
            )}
            
            <Flex alignItems="center" gap={2}>
              {/* Project assignment dropdown - only show for Unassigned documents */}
              {isUnassignedDocument && (
                <Menu 
                  placement="bottom-end" 
                  isLazy 
                  onClose={handleMenuClose}
                >
                  <MenuButton
                    as={Button}
                    rightIcon={<ChevronDown size={16} />}
                    leftIcon={<FolderPlus size={16} />}
                    size="sm"
                    variant="outline"
                    colorScheme="blue"
                    color="var(--text-default-color)"
                    borderColor="var(--default-border-color)"
                    _hover={{ bg: "var(--secondary-hover-color)" }}
                  >
                    Assign to Project
                  </MenuButton>
                  <MenuList 
                    minWidth="240px" 
                    maxHeight="320px" 
                    overflow="auto"
                    padding={0}
                    bg="var(--card-content-background)"
                    borderColor="var(--default-border-color)"
                  >
                    {/* Project search input - sticky at the top */}
                    <Box 
                      p={2} 
                      position="sticky" 
                      top="0" 
                      bg="white" 
                      zIndex={1}
                      borderBottomWidth="1px"
                      borderBottomColor="gray.100"
                    >
                      <InputGroup size="sm">
                        <InputLeftElement pointerEvents="none">
                          <Search size={14} color="var(--chakra-colors-gray-400)" />
                        </InputLeftElement>
                        <Input
                          placeholder="Search projects..."
                          value={projectSearchTerm}
                          onChange={(e) => setProjectSearchTerm(e.target.value)}
                          autoComplete="off"
                          autoCorrect="off"
                          spellCheck="false"
                          onClick={(e) => e.stopPropagation()}
                        />
                      </InputGroup>
                    </Box>
                    
                    <Box p={1}>
                      {filteredProjects.length > 0 ? (
                        filteredProjects.map((project) => (
                          <MenuItem 
                            key={project.id}
                            onClick={() => handleAssignToProject(project.id)}
                            py={2}
                          >
                            {project.name}
                          </MenuItem>
                        ))
                      ) : (
                        <MenuItem isDisabled py={2}>
                          {projectSearchTerm ? "No matching projects" : "No projects available"}
                        </MenuItem>
                      )}
                    </Box>
                  </MenuList>
                </Menu>
              )}
              
              {isEditing ? (
                <>
                  <Tooltip label={hasChanges ? "Save changes" : "No changes to save"}>
                    <Button
                      variant="ghost" 
                      size="sm"
                      onClick={handleSave}
                      isDisabled={!hasChanges}
                      leftIcon={<Save size={16} />}
                      color="var(--text-default-color)"
                      _hover={{ bg: "var(--secondary-hover-color)" }}
                    >
                      Save
                    </Button>
                  </Tooltip>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCancel} 
                    leftIcon={<X size={16} />}
                    color="var(--text-default-color)"
                    _hover={{ bg: "var(--secondary-hover-color)" }}
                  >
                    Cancel
                  </Button>
                </>
              ) : (
                <Button 
                  variant="ghost"
                  size="sm" 
                  onClick={onEdit}
                  leftIcon={<Edit2 size={16} />}
                  color="var(--text-default-color)"
                  _hover={{ bg: "var(--secondary-hover-color)" }}
                >
                  Edit
                </Button>
              )}
            </Flex>
          </Flex>
        </CardHeader>
        
        <CardBody width="100%" bg="var(--card-content-background)">
          {isEditing && (
            <HStack mb={4} spacing={2} alignItems="center" flexWrap="wrap">
              <IconButton
                aria-label="Bold"
                icon={<Bold size={16} />}
                onClick={() => editor?.chain().focus().toggleBold().run()}
                isActive={editor?.isActive('bold')}
                variant={editor?.isActive('bold') ? 'solid' : 'outline'}
                size="sm"
                color="var(--text-default-color)"
                bg="var(--card-content-background)"
                borderColor="var(--default-border-color)"
                _hover={{ bg: "var(--secondary-hover-color)" }}
              />
              <IconButton
                aria-label="Italic"
                icon={<Italic size={16} />}
                onClick={() => editor?.chain().focus().toggleItalic().run()}
                isActive={editor?.isActive('italic')}
                variant={editor?.isActive('italic') ? 'solid' : 'outline'}
                size="sm"
                color="var(--text-default-color)"
                bg="var(--card-content-background)"
                borderColor="var(--default-border-color)"
                _hover={{ bg: "var(--secondary-hover-color)" }}
              />
              <IconButton
                aria-label="Bullet List"
                icon={<List size={16} />}
                onClick={() => editor?.chain().focus().toggleBulletList().run()}
                isActive={editor?.isActive('bulletList')}
                variant={editor?.isActive('bulletList') ? 'solid' : 'outline'}
                size="sm"
                color="var(--text-default-color)"
                bg="var(--card-content-background)"
                borderColor="var(--default-border-color)"
                _hover={{ bg: "var(--secondary-hover-color)" }}
              />
              <IconButton
                aria-label="Undo"
                icon={<Undo size={16} />}
                onClick={() => editor?.chain().focus().undo().run()}
                isDisabled={!editor?.can().undo()}
                size="sm"
                color="var(--text-default-color)"
                bg="var(--card-content-background)"
                borderColor="var(--default-border-color)"
                _hover={{ bg: "var(--secondary-hover-color)" }}
              />
              <IconButton
                aria-label="Redo"
                icon={<Redo size={16} />}
                onClick={() => editor?.chain().focus().redo().run()}
                isDisabled={!editor?.can().redo()}
                size="sm"
                color="var(--text-default-color)"
                bg="var(--card-content-background)"
                borderColor="var(--default-border-color)"
                _hover={{ bg: "var(--secondary-hover-color)" }}
              />
              
              {/* Font Family Dropdown */}
              <Select 
                size="sm"
                value={currentFont}
                onChange={(e) => handleFontChange(e.target.value)}
                width="auto"
                ml={2}
                color="var(--text-default-color)"
                bg="var(--card-content-background)"
                borderColor="var(--default-border-color)"
                _hover={{ borderColor: "var(--active-border-color)" }}
              >
                {fonts.map((font) => (
                  <option 
                    key={font.value} 
                    value={font.value}
                    style={{ fontFamily: font.value }}
                  >
                    {font.name}
                  </option>
                ))}
              </Select>
            </HStack>
          )}

          <Box 
            border="0"
            borderRadius="md"
            bg="var(--card-content-background)" 
            width="100%"
            sx={{
              ".ProseMirror": {
                outline: "none",
                width: "100%",
                maxWidth: "none",
                color: "var(--text-default-color)"
              },
              minH: "300px",
              p: 4,
              className: "prose max-w-none",
              fontSize: "var(--font-size-m)",
              fontFamily: "var(--font-family-body)"
            }}
          >
            <EditorContent editor={editor} style={{ width: '100%' }} />
          </Box>
        </CardBody>
      </Card>
    </Box>
  );
};