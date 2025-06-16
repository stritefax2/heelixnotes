import { FC, ReactNode } from "react";
import styled, { css } from "styled-components";
import { ConditionalWrapper } from "@heelix-app/components";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverBody,
  Image,
} from "@chakra-ui/react";

const Wrapper = styled.div`
  display: flex;
  flex-direction: row;
  gap: 10px;
`;

const ImageAccent = styled.div`
  display: flex;
  width: 34px;
  height: 34px;
  background-color: var(--category-4-color);
  justify-content: center;
  align-items: center;
  border-radius: 50%;
  cursor: pointer;
  
  [data-theme="dark"] & {
    color: #e1e1e1;
  }
`;

const ImageHover = styled.div`
  &:hover {
    background-color: var(--secondary-hover-color);
  }
  display: flex;
  width: 40px;
  height: 40px;
  background-color: transparent;
  justify-content: center;
  border-radius: 50%;
  align-items: center;
  [data-theme="dark"] &:hover {
    background-color: #334155;
  }
`;

const UserBubble = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background-color: #f0f0f0;
  font-size: 16px;
  font-weight: 600;
  overflow: hidden;
  color: #555555;
  
  [data-theme="dark"] & {
    background-color: #1e293b;
    color: #e1e1e1;
  }
`;

const MenuContentContainer = styled.div`
  display: flex;
  flex-direction: column;
`;

type UserProfileInitialsProps = {
  picture: string;
  name: string;
  children?: ReactNode;
};
export const UserProfileInitials: FC<UserProfileInitialsProps> = ({
  picture,
  name,
  children,
}) => {
  const getInitials = () => {
    const nameSplit = name.split(" ");
    const firstInitial = nameSplit[0]?.[0] || "";
    const lastInitial = nameSplit[1]?.[0] || "";
    return `${firstInitial}${lastInitial}`;
  };
  return (
    <Wrapper>
      <ConditionalWrapper
        shouldWrap={!!children}
        wrapper={(localChildren) => (
          <Popover>
            <PopoverTrigger>{localChildren}</PopoverTrigger>

            {children && (
              <PopoverContent backgroundColor={"var(--page-background-color)"} borderColor={"var(--default-border-color)"}>
                <PopoverBody>
                  <MenuContentContainer>{children}</MenuContentContainer>
                </PopoverBody>
              </PopoverContent>
            )}
          </Popover>
        )}
      >
        <ImageAccent>
          <UserBubble>
            {picture ? <Image src={picture} /> : getInitials()}
          </UserBubble>
        </ImageAccent>
      </ConditionalWrapper>
    </Wrapper>
  );
};
