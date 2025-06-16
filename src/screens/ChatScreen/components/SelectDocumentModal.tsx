import { FC, useState, useEffect } from "react";
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  Button,
  Checkbox,
  Spinner,
  Flex,
  Input,
  InputGroup,
  InputLeftElement,
  Box,
  SimpleGrid,
  Badge,
  Text,
  Divider,
  Tabs,
  TabList,
  Tab,
  TabPanels,
  TabPanel,
} from "@chakra-ui/react";
import styled from "styled-components";
import { Search, File, FolderOpen } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { useProject } from "../../../state";

type SelectDocumentModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (selectedDocuments: Array<{ id: number; text: string; name: string; projectName: string; }>) => void;
};

const ScrollableContainer = styled.div`
  max-height: calc(500px - 70px); /* Reduced height to make room for sticky footer */
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
    background: var(--chakra-colors-gray-200);
    border-radius: 4px;
  }
  
  &::-webkit-scrollbar-thumb:hover {
    background: var(--chakra-colors-gray-300);
  }
`;

const StickyFooter = styled(Flex)`
  position: sticky;
  bottom: 0;
  background: white;
  padding-top: 16px;
  padding-bottom: 8px;
  z-index: 1;
  border-top: 1px solid var(--chakra-colors-gray-100);
`;

const DocumentCard = styled(Box)<{ isSelected: boolean }>`
  position: relative;
  border-radius: 8px;
  padding: 16px;
  cursor: pointer;
  transition: all 0.2s ease-in-out;
  background-color: ${props => props.isSelected ? 'var(--chakra-colors-blue-50)' : 'white'};
  border: 1px solid ${props => props.isSelected ? 'var(--chakra-colors-blue-300)' : 'var(--chakra-colors-gray-200)'};
  box-shadow: ${props => props.isSelected 
    ? '0 2px 8px rgba(66, 153, 225, 0.15)' 
    : '0 1px 3px rgba(0, 0, 0, 0.05)'};
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
    border-color: ${props => props.isSelected ? 'var(--chakra-colors-blue-300)' : 'var(--chakra-colors-gray-300)'};
  }
`;

const DocumentTitle = styled(Text)`
  font-size: 14px;
  font-weight: 400;
  color: var(--chakra-colors-gray-800);
  margin-top: 8px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const ProjectLabel = styled(Badge)`
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
`;

const StyledSearch = styled(InputGroup)`
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.05);
  border-radius: 12px;
  overflow: hidden;
`;

export const SelectDocumentModal: FC<SelectDocumentModalProps> = ({
  isOpen,
  onClose,
  onSelect,
}) => {
  const { state } = useProject();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDocuments, setSelectedDocuments] = useState<Set<number>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState(0);

  // Group documents by project
  const documentsByProject = state.projects.reduce((acc, project) => {
    if (project.activities.length > 0) {
      acc[project.id] = project.activities.map((activityId, index) => ({
        id: activityId,
        name: project.activity_names[index] || `Document ${activityId}`,
        projectId: project.id,
        projectName: project.name
      }));
    }
    return acc;
  }, {} as Record<number, Array<{id: number, name: string, projectId: number, projectName: string}>>);

  // Prepare a flattened list of all documents across all projects
  const allDocuments = Object.values(documentsByProject).flat();

  // Filter documents based on search term
  const filteredDocuments = searchTerm.trim() === "" 
    ? allDocuments 
    : allDocuments.filter(doc => 
        doc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        doc.projectName.toLowerCase().includes(searchTerm.toLowerCase())
      );

  // Sort documents by ID (descending) to show newest first
  const sortedDocuments = [...filteredDocuments].sort((a, b) => b.id - a.id);

  useEffect(() => {
    if (!isOpen) {
      setSelectedDocuments(new Set());
      setSearchTerm("");
      setActiveTab(0);
    }
  }, [isOpen]);

  const handleToggleSelect = (documentId: number) => {
    setSelectedDocuments(prev => {
      const newSet = new Set(prev);
      if (newSet.has(documentId)) {
        newSet.delete(documentId);
      } else {
        newSet.add(documentId);
      }
      return newSet;
    });
  };

  const handleCardClick = (documentId: number) => {
    handleToggleSelect(documentId);
  };

  const handleAddSelected = async () => {
    setIsLoading(true);
    try {
      const selectedDocumentData = await Promise.all(
        Array.from(selectedDocuments).map(async (docId) => {
          // Find the project this document belongs to
          const document = allDocuments.find(doc => doc.id === docId);
          if (!document) return { id: docId, text: "", name: "", projectName: "" };
          
          // Get the document's full text
          const result = await invoke<[string, string] | null>("get_app_project_activity_text", {
            activityId: docId,
          });
          const text = result ? result[1] : "Document not found";
          
          return { 
            id: docId, 
            text,
            name: document.name,
            projectName: document.projectName
          };
        })
      );
      
      onSelect(selectedDocumentData.filter(doc => doc.text !== ""));
      onClose();
    } catch (error) {
      console.error("Error fetching document content:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    onClose();
    setSelectedDocuments(new Set());
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="4xl">
      <ModalOverlay backdropFilter="blur(2px)" />
      <ModalContent borderRadius="12px" boxShadow="xl">
        <ModalHeader 
          borderBottom="1px solid" 
          borderColor="gray.100" 
          py={5}
          fontSize="xl"
          fontWeight="600"
        >
          Add documents to your prompt
        </ModalHeader>
        <ModalCloseButton size="lg" top="16px" />
        <ModalBody p={6} pb={0}> {/* Removed bottom padding to avoid gap */}
          {/* Improved search bar */}
          <StyledSearch mb={6}>
            <InputLeftElement pointerEvents="none" h="full">
              <Search size={18} color="var(--chakra-colors-gray-400)" />
            </InputLeftElement>
            <Input
              placeholder="Search documents..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              autoComplete="off"
              autoCorrect="off"
              spellCheck="false"
              size="lg"
              borderRadius="12px"
              pl="40px"
              _focus={{
                boxShadow: "0 0 0 1px var(--chakra-colors-blue-400)",
                borderColor: "blue.400"
              }}
            />
          </StyledSearch>

          <Tabs 
            variant="soft-rounded" 
            colorScheme="blue" 
            mb={6}
            index={activeTab}
            onChange={(index) => setActiveTab(index)}
          >
            <TabList mb={4}>
              <Tab>All Documents ({allDocuments.length})</Tab>
              <Tab>Recent</Tab>
              <Tab>By Project</Tab>
            </TabList>
            <TabPanels>
              {/* All documents tab */}
              <TabPanel p={0}>
                <ScrollableContainer>
                  {searchTerm && (
                    <Box mb={4} fontSize="sm" color="gray.500">
                      {sortedDocuments.length} results found for "{searchTerm}"
                    </Box>
                  )}
                  
                  {sortedDocuments.length > 0 ? (
                    <SimpleGrid columns={[1, 2, 3]} spacing={4}>
                      {sortedDocuments.map((document) => (
                        <DocumentCard 
                          key={document.id}
                          isSelected={selectedDocuments.has(document.id)}
                          onClick={() => handleCardClick(document.id)}
                        >
                          <Flex justify="space-between" align="center">
                            <Box color="gray.500">
                              <File size={20} />
                            </Box>
                            <Checkbox
                              isChecked={selectedDocuments.has(document.id)}
                              onChange={(e) => {
                                e.stopPropagation();
                                handleToggleSelect(document.id);
                              }}
                              colorScheme="blue"
                            />
                          </Flex>
                          <DocumentTitle title={document.name}>
                            {document.name}
                          </DocumentTitle>
                          <Flex mt={2}>
                            <ProjectLabel colorScheme="blue" variant="subtle" size="sm">
                              {document.projectName}
                            </ProjectLabel>
                          </Flex>
                        </DocumentCard>
                      ))}
                    </SimpleGrid>
                  ) : (
                    <Flex 
                      direction="column" 
                      align="center" 
                      justify="center" 
                      py={12}
                      color="gray.400"
                    >
                      <File size={48} strokeWidth={1.5} />
                      <Text mt={4} fontSize="lg">
                        {searchTerm ? "No matching documents found" : "No documents available"}
                      </Text>
                    </Flex>
                  )}
                </ScrollableContainer>
              </TabPanel>
              
              {/* Recent tab */}
              <TabPanel p={0}>
                <ScrollableContainer>
                  <SimpleGrid columns={[1, 2, 3]} spacing={4}>
                    {sortedDocuments.slice(0, 20).map((document) => (
                      <DocumentCard 
                        key={document.id}
                        isSelected={selectedDocuments.has(document.id)}
                        onClick={() => handleCardClick(document.id)}
                      >
                        <Flex justify="space-between" align="center">
                          <Box color="gray.500">
                            <File size={20} />
                          </Box>
                          <Checkbox
                            isChecked={selectedDocuments.has(document.id)}
                            onChange={(e) => {
                              e.stopPropagation();
                              handleToggleSelect(document.id);
                            }}
                            colorScheme="blue"
                          />
                        </Flex>
                        <DocumentTitle title={document.name}>
                          {document.name}
                        </DocumentTitle>
                        <Flex mt={2}>
                          <ProjectLabel colorScheme="blue" variant="subtle" size="sm">
                            {document.projectName}
                          </ProjectLabel>
                        </Flex>
                      </DocumentCard>
                    ))}
                  </SimpleGrid>
                </ScrollableContainer>
              </TabPanel>
              
              {/* By Project tab */}
              <TabPanel p={0}>
                <ScrollableContainer>
                  {Object.entries(documentsByProject).map(([projectId, docs]) => (
                    <Box key={projectId} mb={6}>
                      <Flex align="center" mb={3}>
                        <FolderOpen size={16} />
                        <Text fontWeight="600" ml={2}>
                          {docs[0]?.projectName || "Unnamed Project"}
                        </Text>
                        <Badge ml={2} colorScheme="blue">
                          {docs.length} document{docs.length !== 1 ? 's' : ''}
                        </Badge>
                      </Flex>
                      <SimpleGrid columns={[1, 2, 3]} spacing={4}>
                        {docs.map((document) => (
                          <DocumentCard 
                            key={document.id}
                            isSelected={selectedDocuments.has(document.id)}
                            onClick={() => handleCardClick(document.id)}
                          >
                            <Flex justify="space-between" align="center">
                              <Box color="gray.500">
                                <File size={20} />
                              </Box>
                              <Checkbox
                                isChecked={selectedDocuments.has(document.id)}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  handleToggleSelect(document.id);
                                }}
                                colorScheme="blue"
                              />
                            </Flex>
                            <DocumentTitle title={document.name}>
                              {document.name}
                            </DocumentTitle>
                            <Flex mt={2}>
                              <ProjectLabel colorScheme="blue" variant="subtle" size="sm">
                                {document.projectName}
                              </ProjectLabel>
                            </Flex>
                          </DocumentCard>
                        ))}
                      </SimpleGrid>
                      <Divider mt={6} />
                    </Box>
                  ))}
                </ScrollableContainer>
              </TabPanel>
            </TabPanels>
          </Tabs>
          
          <StickyFooter 
            justifyContent="space-between" 
            pt={4} 
            pb={2}
            mt={4}
          >
            <Button variant="ghost" onClick={handleClose} size="lg" px={6}>
              Cancel
            </Button>
            <Button
              onClick={handleAddSelected}
              colorScheme="blue"
              isLoading={isLoading}
              isDisabled={selectedDocuments.size === 0}
              size="lg"
              px={6}
              rightIcon={selectedDocuments.size > 0 ? 
                <Badge colorScheme="blue" borderRadius="full" ml={1}>{selectedDocuments.size}</Badge> : 
                undefined
              }
            >
              Add Selected
            </Button>
          </StickyFooter>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}; 