import { useMediaQuery } from "@chakra-ui/react";
import CloseIcon from "@mui/icons-material/Close";
import { IconButton, Box as MuiBox, Stack, Typography } from "@mui/material";
import PropTypes from "prop-types";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export default function DetailModal({
  onClose,
  title,
  icon,
  description,
  additionalContent,
  footerContent,
}) {
  const [isClosing, setIsClosing] = useState(false);
  const [isLargerThan200] = useMediaQuery("(max-width: 450px)");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const handleClose = () => {
    setIsClosing(true);
    // Wait for animation to complete before actually closing
    setTimeout(() => {
      onClose();
    }, 300); // Match animation duration
  };
  // Lock body scroll when modal is open
  useEffect(() => {
    // Store current scroll position
    const scrollY = window.scrollY;

    // Store original body styles to restore later
    const originalBodyStyle = {
      position: document.body.style.position,
      top: document.body.style.top,
      width: document.body.style.width,
      overflow: document.body.style.overflow,
    };

    // Prevent body scroll without changing scroll position
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.left = "0";
    document.body.style.right = "0";
    document.body.style.width = "100%";

    // Prevent touchmove on body to avoid iOS Safari scrolling issues
    const preventTouchMove = (e) => {
      // Only prevent if the touch is not within the modal content area
      if (!e.target.closest("[data-modal-content]")) {
        e.preventDefault();
      }
    };

    // Handle escape key
    const handleEscKey = (e) => {
      if (e.key === "Escape") handleClose();
    };

    document.body.addEventListener("touchmove", preventTouchMove, {
      passive: false,
    });
    window.addEventListener("keydown", handleEscKey);

    return () => {
      // Restore body styles
      document.body.style.position = originalBodyStyle.position || "";
      document.body.style.top = originalBodyStyle.top || "";
      document.body.style.left = "";
      document.body.style.right = "";
      document.body.style.width = originalBodyStyle.width || "";
      document.body.style.overflow = originalBodyStyle.overflow || "";

      // Restore scroll position smoothly
      window.scrollTo(0, scrollY);

      document.body.removeEventListener("touchmove", preventTouchMove);
      window.removeEventListener("keydown", handleEscKey);
    };
  }, [handleClose, onClose]);

  const modalContent = (
    <>
      {/* Backdrop overlay with maximum z-index */}
      <MuiBox
        onClick={handleClose}
        sx={{
          position: "fixed !important",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 9999,
          backgroundColor: "rgba(0, 0, 0, 0.8)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 2,
          touchAction: "none", // Prevent touch scrolling on backdrop
          opacity: isClosing ? 0 : 1,
          transition: "opacity 0.3s ease-out",
          animation: isClosing
            ? "fadeOut 0.3s ease-out"
            : "fadeIn 0.3s ease-out",
          "@keyframes fadeIn": {
            from: { opacity: 0 },
            to: { opacity: 1 },
          },
          "@keyframes fadeOut": {
            from: { opacity: 1 },
            to: { opacity: 0 },
          },
        }}
      />

      {/* Modal content with maximum z-index */}
      <MuiBox
        data-modal-content
        onClick={(e) => e.stopPropagation()}
        sx={{
          position: "fixed !important",
          top: "50%",
          left: isLargerThan200 ? "44%" : "50%",
          zIndex: 9999,
          backgroundColor: "#1A202C",
          color: "white",
          borderRadius: 2,
          boxShadow:
            "0 20px 60px rgba(255,165,0,0.4), 0 0 0 1px rgba(255,165,0,0.3)",
          border: "1px solid rgba(255,165,0,0.4)",
          width: "95vw",
          maxWidth: 600,
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          willChange: "transform",
          opacity: isClosing ? 0 : 1,
          transform: isClosing
            ? "translate(-50%, -50%) scale(0.9) translateZ(0)"
            : "translate(-50%, -50%) scale(1) translateZ(0)",
          transition: "all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)",
          animation: isClosing
            ? "modalSlideOut 0.3s cubic-bezier(0.55, 0.085, 0.68, 0.53)"
            : "modalSlideIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)",
          "@keyframes modalSlideIn": {
            from: {
              opacity: 0,
              transform: "translate(-50%, -50%) scale(0.8) translateZ(0)",
            },
            to: {
              opacity: 1,
              transform: "translate(-50%, -50%) scale(1) translateZ(0)",
            },
          },
          "@keyframes modalSlideOut": {
            from: {
              opacity: 1,
              transform: "translate(-50%, -50%) scale(1) translateZ(0)",
            },
            to: {
              opacity: 0,
              transform: "translate(-50%, -50%) scale(0.9) translateZ(0)",
            },
          },
          // Mobile responsive adjustments
          "@media (max-width: 600px)": {
            width: "95vw",
            maxWidth: "none",
            maxHeight: "95vh",
            margin: "2.5vh",
            borderRadius: 3,
          },
        }}
      >
        {/* Header */}
        <MuiBox
          sx={{
            display: "flex",
            alignItems: "center",
            px: { xs: 2, sm: 3 },
            py: { xs: 1.5, sm: 2 },
            background:
              "linear-gradient(135deg, #FF8C00 0%, #FFA500 50%, #FFB84D 100%)",
            borderBottom: "1px solid rgba(255,255,255,0.1)",
            flexShrink: 0,
            borderTopLeftRadius: 8,
            borderTopRightRadius: 8,
            position: "relative",
            "&::before": {
              content: '""',
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background:
                "linear-gradient(135deg, rgba(255,255,255,0.1) 0%, transparent 50%)",
              borderTopLeftRadius: 8,
              borderTopRightRadius: 8,
            },
          }}
        >
          {icon && (
            <MuiBox
              sx={{
                width: { xs: 40, sm: 48 },
                height: { xs: 40, sm: 48 },
                mr: 2,
                p: 1,
                borderRadius: 1.5,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "rgba(0,0,0,0.25)",
                backdropFilter: "blur(8px)",
                boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
                border: "1px solid rgba(255,255,255,0.1)",
                transition: "transform 0.2s ease",
                "&:hover": {
                  transform: "scale(1.05)",
                },
              }}
            >
              <img
                src={icon}
                alt={title}
                loading="lazy"
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "contain",
                  filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.4))",
                }}
              />
            </MuiBox>
          )}
          <Typography
            variant="h5"
            sx={{
              fontWeight: 700,
              color: "white",
              flexGrow: 1,
              textShadow: "0 2px 8px rgba(0,0,0,0.4)",
              fontSize: { xs: "1.1rem", sm: "1.5rem" },
              lineHeight: 1.2,
            }}
          >
            {title}
          </Typography>
          <IconButton
            onClick={handleClose}
            size="small"
            sx={{
              color: "white",
              backgroundColor: "rgba(0,0,0,0.25)",
              backdropFilter: "blur(4px)",
              border: "1px solid rgba(255,255,255,0.1)",
              transition: "all 0.2s ease",
              "&:hover": {
                backgroundColor: "rgba(0,0,0,0.4)",
                transform: "scale(1.1)",
                boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
              },
              "&:active": {
                transform: "scale(0.95)",
              },
            }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </MuiBox>

        {/* Body */}
        <MuiBox
          sx={{
            px: { xs: 2, sm: 3 },
            py: { xs: 1.5, sm: 2 },
            flexGrow: 1,
            overflowY: "auto",
            overflowX: "hidden",
            touchAction: "pan-y", // Allow vertical scrolling only
            overscrollBehavior: "contain", // Prevent bounce effect
            scrollbarWidth: "thin",
            scrollbarColor: "rgba(255,165,0,0.5) rgba(255,255,255,0.1)",
            "&::-webkit-scrollbar": {
              width: 8,
            },
            "&::-webkit-scrollbar-thumb": {
              backgroundColor: "rgba(255,165,0,0.4)",
              borderRadius: 4,
              border: "1px solid rgba(255,165,0,0.2)",
              "&:hover": {
                backgroundColor: "rgba(255,165,0,0.6)",
              },
            },
            "&::-webkit-scrollbar-track": {
              backgroundColor: "rgba(255,255,255,0.05)",
              borderRadius: 4,
            },
            "&::-webkit-scrollbar-corner": {
              backgroundColor: "transparent",
            },
          }}
        >
          <Stack spacing={3}>
            {description && (
              <Typography
                variant="body1"
                sx={{
                  fontStyle: "italic",
                  color: "rgba(255,255,255,0.85)",
                  backgroundColor: "rgba(255,165,0,0.08)",
                  borderLeft: "4px solid #FFA500",
                  borderRadius: "0 8px 8px 0",
                  pl: 3,
                  pr: 2,
                  py: 2,
                  whiteSpace: "pre-wrap",
                  lineHeight: 1.6,
                  fontSize: { xs: "0.9rem", sm: "1rem" },
                  position: "relative",
                  "&::before": {
                    content: '"\\201C"',
                    position: "absolute",
                    top: 8,
                    left: 12,
                    fontSize: "2rem",
                    color: "rgba(255,165,0,0.3)",
                    lineHeight: 1,
                  },
                }}
              >
                {description}
              </Typography>
            )}
            {additionalContent && (
              <MuiBox
                sx={{
                  "& > *": {
                    animation: "slideInUp 0.5s ease-out",
                  },
                  "@keyframes slideInUp": {
                    from: {
                      opacity: 0,
                      transform: "translateY(20px)",
                    },
                    to: {
                      opacity: 1,
                      transform: "translateY(0)",
                    },
                  },
                }}
              >
                {additionalContent}
              </MuiBox>
            )}
          </Stack>
        </MuiBox>

        {/* Footer */}
        {footerContent && (
          <MuiBox
            sx={{
              p: { xs: 1.5, sm: 2 },
              borderTop: "1px solid rgba(255,255,255,0.1)",
              display: "flex",
              justifyContent: "flex-end",
              background: "rgba(0,0,0,0.25)",
              backdropFilter: "blur(8px)",
              width: "100%",
              flexShrink: 0,
              borderBottomLeftRadius: 8,
              borderBottomRightRadius: 8,
              gap: 1,
              flexWrap: "wrap",
            }}
          >
            {footerContent}
          </MuiBox>
        )}
      </MuiBox>
    </>
  );

  // Use React Portal to render modal at document.body level
  return createPortal(modalContent, document.body);
}

DetailModal.propTypes = {
  onClose: PropTypes.func.isRequired,
  title: PropTypes.string.isRequired,
  icon: PropTypes.string,
  description: PropTypes.string,
  additionalContent: PropTypes.node,
  footerContent: PropTypes.node,
};
