import { type FC } from "react";
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
  Button,
  Box,
  useToast,
} from "@chakra-ui/react";
import { Copy, Mail } from "lucide-react";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  emailText: string;
};

export const EmailDraftModal: FC<Props> = ({ isOpen, onClose, emailText }) => {
  const toast = useToast();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(emailText);
      toast({
        title: "Copied to clipboard",
        status: "success",
        duration: 2000,
        isClosable: true,
        position: "bottom-right",
      });
    } catch {
      toast({
        title: "Couldn't copy to clipboard",
        status: "error",
        duration: 3000,
        isClosable: true,
        position: "bottom-right",
      });
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl" scrollBehavior="inside">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader display="flex" alignItems="center" gap={2}>
          <Mail size={18} />
          Follow-up email draft
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <Box
            whiteSpace="pre-wrap"
            fontSize="sm"
            fontFamily="Inter, sans-serif"
            bg="gray.50"
            borderWidth="1px"
            borderColor="gray.200"
            borderRadius="md"
            p={4}
          >
            {emailText}
          </Box>
        </ModalBody>
        <ModalFooter gap={2}>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          <Button colorScheme="teal" leftIcon={<Copy size={14} />} onClick={handleCopy}>
            Copy
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
