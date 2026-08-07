import React, { useState } from "react";
import { Box, useTheme, useMediaQuery } from "@mui/material";
import Sidebar from "./components/Sidebar";
import TopBar from "./components/TopBar";

const DRAWER_WIDTH = 260;
const DRAWER_WIDTH_COLLAPSED = 64;

const AdminLayout = ({ children }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleCollapseToggle = () => {
    setCollapsed(!collapsed);
  };

  const drawerWidth =
    collapsed && !isMobile ? DRAWER_WIDTH_COLLAPSED : DRAWER_WIDTH;

  return (
    <Box
      sx={{
        display: "flex",
        minHeight: "100vh",
        bgcolor: "background.default",
        backgroundImage:
          "radial-gradient(circle at 10% -10%, rgba(111, 214, 109, 0.24) 0, rgba(111, 214, 109, 0) 38%), radial-gradient(circle at 96% 4%, rgba(255, 179, 89, 0.2) 0, rgba(255, 179, 89, 0) 30%)",
      }}
    >
      {/* Sidebar */}
      <Sidebar
        open={mobileOpen}
        onClose={handleDrawerToggle}
        collapsed={collapsed}
        onToggleCollapse={handleCollapseToggle}
      />

      {/* Main Content Area */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: isMobile ? "100%" : `calc(100% - ${drawerWidth}px)`,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          transition: theme.transitions.create(["width", "margin"], {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.leavingScreen,
          }),
        }}
      >
        {/* Top Navigation Bar */}
        <TopBar onMenuClick={handleDrawerToggle} collapsed={collapsed} />

        {/* Page Content */}
        <Box
          sx={{
            flexGrow: 1,
            p: { xs: 2, sm: 3 },
            mt: 8, // Account for AppBar height
            width: "100%",
            maxWidth: "100%",
            mx: "auto",
            animation: "contentReveal 0.45s ease-out",
            "@keyframes contentReveal": {
              from: { opacity: 0, transform: "translateY(8px)" },
              to: { opacity: 1, transform: "translateY(0)" },
            },
          }}
        >
          <Box
            sx={{
              minHeight: "calc(100vh - 160px)",
              borderRadius: 4,
              border: "1px solid rgba(57, 167, 74, 0.12)",
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.9) 0%, rgba(247,255,249,0.9) 100%)",
              boxShadow: "0 16px 38px rgba(31, 90, 53, 0.1)",
              p: { xs: 2, sm: 3 },
            }}
          >
            {children}
          </Box>
        </Box>

        {/* Footer (Optional) */}
        <Box
          component="footer"
          sx={{
            py: 2,
            px: { xs: 2, sm: 3 },
            mt: "auto",
            borderTop: "1px solid",
            borderColor: "divider",
            bgcolor: "rgba(255,255,255,0.78)",
            backdropFilter: "blur(8px)",
          }}
        >
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 1,
            }}
          >
            <Box sx={{ fontSize: "0.875rem", color: "text.secondary" }}>
              © {new Date().getFullYear()} Fresh n Freshness. All rights
              reserved.
            </Box>
            <Box sx={{ fontSize: "0.875rem", color: "text.secondary" }}>
              Version 1.0.0
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default AdminLayout;
