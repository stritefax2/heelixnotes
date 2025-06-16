import { ThemeConfig } from "@chakra-ui/react";

type ThemeProps = {
  colorMode: 'light' | 'dark'
}

export const theme = {
  fonts: {
    heading: `"Montserrat", sans-serif`,
    body: `"Montserrat", sans-serif`,
  },
  colors: {
    brand: {
      main: "#3363AD",
      100: "#3363AD1F",
      300: "#4070b8",
      400: "#3363AD",
      600: "#2a5489",
    },
  },
  styles: {
    global: (props: ThemeProps) => ({
      body: {
        bg: props.colorMode === 'dark' ? '#1a2233' : 'white',
        color: props.colorMode === 'dark' ? '#e1e1e1' : 'gray.800',
      },
    }),
  },
  components: {
    Button: {
      variants: {
        primary: {
          bg: "brand.400",
          color: "white", // Text color
          _hover: {
            bg: "brand.600", // Color on hover
          },
        },
      },
    },
    Modal: {
      baseStyle: (props: ThemeProps) => ({
        dialog: {
          bg: props.colorMode === 'dark' ? '#1e293b' : 'white',
        }
      })
    },
    Menu: {
      baseStyle: (props: ThemeProps) => ({
        list: {
          bg: props.colorMode === 'dark' ? '#1e293b' : 'white',
          borderColor: props.colorMode === 'dark' ? '#334155' : 'gray.200',
        },
        item: {
          bg: props.colorMode === 'dark' ? '#1e293b' : 'white',
          _hover: {
            bg: props.colorMode === 'dark' ? '#334155' : 'gray.100',
          },
          _focus: {
            bg: props.colorMode === 'dark' ? '#334155' : 'gray.100',
          },
        },
      }),
    },
    Badge: {
      baseStyle: (props: ThemeProps) => ({
        bg: props.colorMode === 'dark' ? '#2d395a' : undefined,
      }),
    }
  },
  config: {
    initialColorMode: 'light',
    useSystemColorMode: false,
  },
  semanticTokens: {
    colors: {
      "chakra-body-bg": { 
        _light: "white", 
        _dark: "#1a2233"
      },
      "chakra-body-text": { 
        _light: "gray.800", 
        _dark: "#e1e1e1"
      },
      "selected-bg": {
        _light: "blue.50",
        _dark: "#2d395a"
      },
      "selected-text": {
        _light: "blue.600",
        _dark: "#4d7bbd"
      },
      "hover-bg": {
        _light: "gray.100",
        _dark: "#334155"
      }
    }
  }
};
