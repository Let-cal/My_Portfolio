// src/components/pages/ExperienceSection/WorkExperienceRow.jsx
import { Box, Stack, Typography } from "@mui/material";
import { motion } from "framer-motion";
import PropTypes from "prop-types";
import React from "react";

// Animation variants
const rowVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: "spring",
      stiffness: 300,
      damping: 25,
    },
  },
};

const timelineDotVariants = {
  hidden: { scale: 0, opacity: 0 },
  visible: {
    scale: 1,
    opacity: 1,
    transition: {
      type: "spring",
      stiffness: 500,
      damping: 25,
      delay: 0.2,
    },
  },
};

const WorkExperienceRow = ({ project, onClick, isLast }) => {
  return (
    <motion.div
      variants={rowVariants}
      whileHover={{
        y: -5,
        transition: { type: "spring", stiffness: 300, damping: 20 },
      }}
    >
      <Box
        onClick={onClick}
        sx={{
          cursor: "pointer",
          py: 4,
          mb: { xs: 0, md: 1 },
          position: "relative",
          borderRadius: 2,
          transition: "background-color 0.3s",
          "&:hover": {
            bgcolor: "rgba(255,255,255,0.03)",
            "& .timeline-dot": {
              bgcolor: "#fb923c",
              boxShadow: "0 0 10px 2px rgba(249,115,22,0.5)",
            },
          },
        }}
      >
        {/* Use a CSS Grid Layout instead of Material UI Grid for better control */}
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "40px 1fr",
              sm: "40px 250px 1fr", // Fixed width for company info column
            },
            minHeight: "100px",
            width: "100%",
            gap: 2,
          }}
        >
          {/* Timeline Column - with dot connector */}
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              position: "relative",
              height: "100%",
            }}
          >
            {/* Animated timeline dot */}
            <motion.div
              className="timeline-dot"
              variants={timelineDotVariants}
              style={{
                width: 16,
                height: 16,
                borderRadius: "50%",
                backgroundColor: "#fb923c",
                border: "3px solid #111",
                zIndex: 2,
                position: "relative",
                marginTop: 8,
                transition: "all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
              }}
            />

            {/* Extending line if not the last item */}
            {!isLast && (
              <Box
                sx={{
                  position: "absolute",
                  top: 24,
                  bottom: -40,
                  width: "2px",
                  bgcolor: "rgba(255,255,255,0.1)",
                  zIndex: 1,
                }}
              />
            )}
          </Box>

          {/* Company Information Column */}
          <Box sx={{ height: "100%" }}>
            <Typography
              variant="h6"
              component="h3"
              sx={{
                fontWeight: 700,
                fontSize: { xs: "1rem", sm: "1.1rem", md: "1.25rem" },
                color: "#fb923c",
                mb: 1,
              }}
            >
              {project.title}
            </Typography>

            {project.location && (
              <Typography
                variant="body2"
                sx={{
                  color: "rgba(255,255,255,0.7)",
                  mb: 1,
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                  fontSize: { xs: "0.8rem", sm: "0.875rem" },
                }}
              >
                <Box
                  component="span"
                  sx={{
                    display: "inline-block",
                    width: 12,
                    height: 12,
                    borderRadius: "50%",
                    bgcolor: "#fb923c",
                    opacity: 0.7,
                  }}
                />
                {project.location}
              </Typography>
            )}

            <Typography
              variant="body2"
              sx={{
                color: "rgba(255,255,255,0.7)",
                fontWeight: 500,
                fontSize: { xs: "0.8rem", sm: "0.875rem" },
              }}
            >
              {project.period}
            </Typography>
          </Box>

          {/* Role Details Column - This will now always start at the same position */}
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "flex-start",
              // On mobile, stack below the company info
              gridColumn: { xs: "1 / span 2", sm: "auto" },
              gridRow: { xs: 2, sm: "auto" },
              ml: { xs: 6, sm: 0 },
              mt: { xs: 2, sm: 0 },
            }}
          >
            {project.role && (
              <Typography
                variant="body1"
                sx={{
                  fontWeight: 600,
                  color: "#fff",
                  mb: 1,
                  fontSize: { xs: "0.9rem", sm: "1rem" },
                  height: "auto",
                }}
              >
                {project.role}
              </Typography>
            )}

            <Typography
              variant="body2"
              sx={{
                color: "rgba(255,255,255,0.7)",
                fontSize: { xs: "0.8rem", sm: "0.875rem" },
                lineHeight: 1.6,
                flexGrow: 1,
              }}
            >
              {project.summary}
            </Typography>

            {/* View More indicator */}
            <Stack
              direction="row"
              spacing={1}
              alignItems="center"
              sx={{ mt: 1.5 }}
            >
              <Typography
                variant="body2"
                sx={{
                  color: "#fb923c",
                  fontWeight: 600,
                  fontSize: "0.8rem",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                View Details
                <Box
                  component="span"
                  sx={{
                    ml: 0.5,
                    transition: "transform 0.3s",
                    display: "inline-block",
                    "div:hover &": { transform: "translateX(3px)" },
                  }}
                >
                  →
                </Box>
              </Typography>
            </Stack>
          </Box>
        </Box>
      </Box>
    </motion.div>
  );
};

WorkExperienceRow.propTypes = {
  project: PropTypes.shape({
    title: PropTypes.string.isRequired,
    period: PropTypes.string,
    location: PropTypes.string,
    role: PropTypes.string,
    summary: PropTypes.string,
  }).isRequired,
  index: PropTypes.number.isRequired,
  onClick: PropTypes.func.isRequired,
  isLast: PropTypes.bool,
};

WorkExperienceRow.defaultProps = {
  isLast: false,
};

// Memoize to prevent unnecessary re-renders
export default React.memo(WorkExperienceRow);
