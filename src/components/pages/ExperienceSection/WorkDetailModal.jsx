// src/components/pages/ExperienceSection/WorkDetailModal.jsx
import { Box, Chip, Link as MuiLink, Stack, Typography } from "@mui/material";
import { AnimatePresence, motion } from "framer-motion";
import PropTypes from "prop-types";
import React from "react";
import DetailModal from "../../ui/detail_modal";

// Overlay fade animation
const overlayVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.3 } },
  exit: { opacity: 0, transition: { delay: 0.2, duration: 0.3 } },
};

// Modal pop-in/out animation
const modalVariants = {
  hidden: { opacity: 0, scale: 0.9, y: 20 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { type: "spring", stiffness: 300, damping: 25, delay: 0.1 },
  },
  exit: { opacity: 0, scale: 0.95, y: 10, transition: { duration: 0.2 } },
};

// Content staggered animation
const contentVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.3 },
  },
};

// Individual items animation
const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 500, damping: 30 },
  },
};

export default function WorkDetailModal({ project, isOpen, onClose }) {
  const [expanded, setExpanded] = React.useState(false);
  const toggleExpanded = () => setExpanded((e) => !e);

  if (!project) return null;

  // Prepare animated content
  const animatedContent = (
    <motion.div variants={contentVariants} initial="hidden" animate="visible">
      {/* Description container with expandable text */}
      <motion.div variants={itemVariants}>
        <Typography
          variant="body1"
          sx={{
            whiteSpace: "pre-wrap",
            lineHeight: 1.6,
            mb: 1,
            overflow: "hidden",
            display: "-webkit-box",
            WebkitBoxOrient: "vertical",
            WebkitLineClamp: expanded ? "none" : 3, // 3 lines when not expanded
          }}
        >
          {project.description}
        </Typography>
        <Typography
          component="button"
          onClick={toggleExpanded}
          sx={{
            color: "#fb923c",
            fontWeight: 700,
            background: "none",
            border: "none",
            p: 0,
            cursor: "pointer",
            mb: 3,
            display: "block",
          }}
        >
          {expanded ? "Show less ▲" : "Read more ▼"}
        </Typography>
      </motion.div>

      {/* Demo / Code links */}
      {(project.demoLink || project.codeWebLink || project.codeMbLink) && (
        <motion.div variants={itemVariants}>
          <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
            {project.demoLink && (
              <MuiLink
                href={project.demoLink}
                target="_blank"
                rel="noopener noreferrer"
                sx={{ color: "#fb923c", textDecoration: "underline" }}
              >
                View Demo
              </MuiLink>
            )}
            {project.codeWebLink && (
              <MuiLink
                href={project.codeWebLink}
                target="_blank"
                rel="noopener noreferrer"
                sx={{ color: "#fb923c", textDecoration: "underline" }}
              >
                View Website Code
              </MuiLink>
            )}
            {project.codeMbLink && (
              <MuiLink
                href={project.codeMbLink}
                target="_blank"
                rel="noopener noreferrer"
                sx={{ color: "#fb923c", textDecoration: "underline" }}
              >
                View Mobile Code
              </MuiLink>
            )}
          </Stack>
        </motion.div>
      )}

      {/* Tech Stack */}
      {project.techStack && project.techStack.length > 0 && (
        <motion.div variants={itemVariants}>
          <Typography
            variant="subtitle1"
            sx={{ color: "#fb923c", fontWeight: 700, mb: 1 }}
          >
            Tech Stack:
          </Typography>
          <Box
            component="div"
            sx={{
              display: "flex",
              flexWrap: "wrap",
              gap: 1,
              mb: 3,
            }}
          >
            {project.techStack.map((tech, idx) => (
              <Chip
                key={idx}
                label={tech}
                sx={{
                  backgroundColor: "#f97316",
                  color: "#fff",
                  fontWeight: 700,
                  boxShadow: "0 0 6px rgba(249,115,22,0.6)",
                  mb: 1,
                }}
              />
            ))}
          </Box>
        </motion.div>
      )}

      {/* Timeline */}
      {project.timeline && (
        <motion.div variants={itemVariants}>
          <Typography variant="body2" sx={{ color: "#fff", mb: 1 }}>
            <strong>Timeline:</strong> {project.timeline}
          </Typography>
        </motion.div>
      )}

      {/* Role info (if available) */}
      {project.role && !project.timeline && (
        <motion.div variants={itemVariants}>
          <Typography variant="body2" sx={{ color: "#fff", mb: 1 }}>
            <strong>Role:</strong> {project.role}
          </Typography>
        </motion.div>
      )}
    </motion.div>
  );

  return (
    <AnimatePresence>
      {isOpen && (
        // Overlay fade animation
        <motion.div
          variants={overlayVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.7)",
            backdropFilter: "blur(8px)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onClick={onClose}
        >
          {/* Modal pop-in animation */}
          <motion.div
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            style={{
              width: "90%",
              maxWidth: 600,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <DetailModal
              onClose={onClose}
              title={project.title}
              icon={project.icon}
              description={project.summary}
              additionalContent={animatedContent}
              footerContent={null}
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

WorkDetailModal.propTypes = {
  project: PropTypes.shape({
    title: PropTypes.string.isRequired,
    icon: PropTypes.string,
    summary: PropTypes.string,
    description: PropTypes.string,
    demoLink: PropTypes.string,
    codeWebLink: PropTypes.string,
    codeMbLink: PropTypes.string,
    techStack: PropTypes.arrayOf(PropTypes.string),
    timeline: PropTypes.string,
    role: PropTypes.string,
  }),
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
};
