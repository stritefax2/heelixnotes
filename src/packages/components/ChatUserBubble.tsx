import { FC } from "react";
import styled from "styled-components";

const UserBubble = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background-color: #f0f0f0;
  font-size: 16px;
  font-weight: 600;
  color: #555555;
  [data-theme="dark"] & {
    background-color: #1e293b;
    color: #e1e1e1;
  }
`;

type ChatUserBubbleProps = {
  name: string;
};

export const ChatUserBubble: FC<ChatUserBubbleProps> = ({ name }) => {
  const getInitials = () => {
    const nameSplit = name.split(" ");
    const firstInitial = nameSplit[0]?.[0] || "";
    const lastInitial = nameSplit[1]?.[0] || "";
    return `${firstInitial}${lastInitial}`;
  };

  return <UserBubble>{getInitials()}</UserBubble>;
};
