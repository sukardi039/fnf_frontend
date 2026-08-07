import { createTheme } from "@mui/material/styles";

/**
 * Fresh storefront theme for fruit retail experiences.
 * Focus: lively color accents, soft surfaces, and clear readability.
 */
export const businessTheme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: "#39A74A",
      light: "#73CC70",
      dark: "#1F7A34",
      contrastText: "#ffffff",
    },
    secondary: {
      main: "#FF9F1C",
      light: "#FFC46C",
      dark: "#D97B00",
      contrastText: "#ffffff",
    },
    success: {
      main: "#39A74A",
      light: "#BFEBC4",
      dark: "#2B8A3C",
    },
    warning: {
      main: "#FF9F1C",
      light: "#FFD39A",
      dark: "#E88300",
    },
    error: {
      main: "#E5484D",
      light: "#F7A3A7",
      dark: "#BD2F34",
    },
    info: {
      main: "#1FA2A6",
      light: "#8ADBDC",
      dark: "#177A7E",
    },
    background: {
      default: "#F4FFF6",
      paper: "#FFFFFF",
    },
    text: {
      primary: "#1D3A2B",
      secondary: "#4F6B5C",
      disabled: "#9AB0A0",
    },
    divider: "rgba(57, 167, 74, 0.16)",
    sidebar: {
      background: "#1F6A43",
      text: "#F3FFF6",
      hover: "rgba(255, 255, 255, 0.12)",
      active: "#FF9F1C",
    },
  },
  typography: {
    fontFamily: '"Nunito", "Quicksand", "Avenir Next", "Segoe UI", sans-serif',
    h1: {
      fontSize: "2.5rem",
      fontWeight: 800,
      lineHeight: 1.15,
      letterSpacing: "-0.02em",
    },
    h2: {
      fontSize: "2rem",
      fontWeight: 800,
      lineHeight: 1.2,
      letterSpacing: "-0.015em",
    },
    h3: {
      fontSize: "1.75rem",
      fontWeight: 700,
      lineHeight: 1.25,
    },
    h4: {
      fontSize: "1.5rem",
      fontWeight: 700,
      lineHeight: 1.3,
    },
    h5: {
      fontSize: "1.25rem",
      fontWeight: 700,
      lineHeight: 1.35,
    },
    h6: {
      fontSize: "1rem",
      fontWeight: 700,
      lineHeight: 1.45,
    },
    body1: {
      fontSize: "1rem",
      lineHeight: 1.55,
    },
    body2: {
      fontSize: "0.9rem",
      lineHeight: 1.5,
    },
    button: {
      fontSize: "0.9rem",
      fontWeight: 700,
      textTransform: "none",
      letterSpacing: "0.01em",
    },
  },
  shape: {
    borderRadius: 16,
  },
  spacing: 8,
  shadows: [
    "none",
    "0 2px 6px rgba(30, 88, 53, 0.08)",
    "0 6px 14px rgba(30, 88, 53, 0.12)",
    "0 10px 22px rgba(30, 88, 53, 0.14)",
    "0 14px 30px rgba(30, 88, 53, 0.16)",
    "0 18px 36px rgba(30, 88, 53, 0.18)",
    "0 24px 44px rgba(30, 88, 53, 0.2)",
    "0 28px 52px rgba(30, 88, 53, 0.22)",
    "0 34px 62px rgba(30, 88, 53, 0.24)",
    ...Array(16).fill("0 34px 62px rgba(30, 88, 53, 0.24)"),
  ],
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          background:
            "radial-gradient(circle at 8% 10%, rgba(129, 226, 118, 0.22) 0, rgba(129, 226, 118, 0) 26%), radial-gradient(circle at 92% 16%, rgba(255, 179, 71, 0.2) 0, rgba(255, 179, 71, 0) 28%), linear-gradient(180deg, #f8fff9 0%, #f2fcf5 100%)",
        },
        "#root": {
          minHeight: "100vh",
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          border: "1px solid rgba(57, 167, 74, 0.14)",
          boxShadow: "0 10px 24px rgba(36, 102, 61, 0.1)",
          background: "linear-gradient(180deg, #ffffff 0%, #fbfffc 100%)",
          borderRadius: 18,
          transition: "transform 0.24s ease, box-shadow 0.24s ease",
          "&:hover": {
            transform: "translateY(-2px)",
            boxShadow: "0 16px 30px rgba(36, 102, 61, 0.14)",
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          border: "1px solid rgba(57, 167, 74, 0.12)",
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 999,
          padding: "9px 18px",
          boxShadow: "none",
          transition: "transform 0.18s ease, box-shadow 0.22s ease",
          "&:hover": {
            transform: "translateY(-1px)",
            boxShadow: "0 8px 16px rgba(37, 113, 63, 0.18)",
          },
        },
        containedPrimary: {
          background: "linear-gradient(120deg, #2f9a42 0%, #57bc48 100%)",
          "&:hover": {
            background: "linear-gradient(120deg, #27863a 0%, #48a93d 100%)",
          },
        },
        containedSecondary: {
          background: "linear-gradient(120deg, #f09018 0%, #ffaf2c 100%)",
          "&:hover": {
            background: "linear-gradient(120deg, #de7f0f 0%, #f3a521 100%)",
          },
        },
      },
    },
    MuiTextField: {
      defaultProps: {
        variant: "outlined",
        size: "small",
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 14,
          backgroundColor: "#ffffff",
          "&:hover .MuiOutlinedInput-notchedOutline": {
            borderColor: "rgba(57, 167, 74, 0.45)",
          },
          "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
            borderColor: "#39A74A",
            borderWidth: 2,
            boxShadow: "0 0 0 3px rgba(57, 167, 74, 0.14)",
          },
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          borderRight: "none",
          background:
            "linear-gradient(180deg, rgba(31,106,67,0.98) 0%, rgba(29,95,60,0.98) 100%)",
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: "rgba(255, 255, 255, 0.78)",
          backdropFilter: "blur(10px)",
          borderBottom: "1px solid rgba(57, 167, 74, 0.14)",
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderBottom: "1px solid rgba(57, 167, 74, 0.12)",
        },
        head: {
          fontWeight: 700,
          backgroundColor: "#f5fff7",
          color: "#29523d",
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 999,
          fontWeight: 700,
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: "#24573a",
          borderRadius: 10,
          padding: "8px 12px",
          fontSize: "0.75rem",
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          "&:hover": {
            backgroundColor: "rgba(57, 167, 74, 0.12)",
          },
        },
      },
    },
  },
  breakpoints: {
    values: {
      xs: 0,
      sm: 600,
      md: 960,
      lg: 1280,
      xl: 1920,
    },
  },
});

export const customColors = {
  charts: {
    kiwi: "#39A74A",
    mango: "#FF9F1C",
    mint: "#1FA2A6",
    berry: "#A03E8A",
    guava: "#EF6351",
    citrus: "#F9C74F",
    leafy: "#2F7C4F",
    ocean: "#2A9D8F",
  },
  status: {
    active: "#39A74A",
    inactive: "#9DAFA2",
    pending: "#FF9F1C",
    error: "#E5484D",
  },
};

export default businessTheme;
