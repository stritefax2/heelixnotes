import { type FC } from "react";
import styled from "styled-components";
import { IconButton, Flex } from "@chakra-ui/react";
import { type Project } from "../data/project";
import { Text } from "@heelix-app/design";
import { FaEdit, FaPlus, FaTrash } from "react-icons/fa";

const Container = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 4px;
`;

const ListItem = styled.div<{ isActive?: boolean }>`
  display: flex;
  flex: 1;
  cursor: pointer;
  padding: var(--space-default);
  justify-content: space-between;
  gap: 8px;
  padding: 12px;
  border-radius: var(--default-radius);
  align-items: center;
  background-color: ${({ isActive }) =>
    isActive ? "var(--secondary-color)" : "var(--card-content-background)"};
  color: var(--text-default-color);
  &:hover {
    background-color: var(--secondary-hover-color);
  }
`;

type ProjectListProps = {
  projects: Project[];
  onClickProject: (projectId: number) => void;
  selectedProjectId?: Project["id"];
  onClickNew: () => void;
  onClickEdit: (projectId: Project["id"]) => void;
  onDelete: (projectId: Project["id"]) => void;
};

export const ProjectList: FC<ProjectListProps> = ({
  projects,
  onClickProject,
  selectedProjectId,
  onClickNew,
  onClickEdit,
  onDelete,
}) => {
  return (
    <Container>
      <ListItem onClick={onClickNew}>
        <Flex gap={2} color="var(--text-default-color)">
          {FaPlus({ size: 20 }) as any}
          <Text type="m" bold>
            New Project
          </Text>
        </Flex>
      </ListItem>
      {projects.map((project) => (
        <ListItem
          key={project.id}
          isActive={project.id === selectedProjectId}
          onClick={() => onClickProject(project.id)}
        >
          <Text type="m" bold>
            {project.name}
          </Text>
          <Flex gap={2}>
            <IconButton
              aria-label="Edit"
              onClick={(e) => {
                e.stopPropagation();
                onClickEdit(project.id);
              }}
              bg="var(--card-content-background)"
              color="var(--text-default-color)" 
              _hover={{ bg: 'var(--secondary-hover-color)' }}
            >
              {FaEdit({}) as any}
            </IconButton>
            <IconButton
              aria-label="Delete"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(project.id);
              }}
              bg="var(--card-content-background)"
              color="var(--text-default-color)"
              _hover={{ bg: 'var(--secondary-hover-color)' }}
            >
              {FaTrash({}) as any}
            </IconButton>
          </Flex>
        </ListItem>
      ))}
    </Container>
  );
};
