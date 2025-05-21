import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { Box, Link, Paper, Typography } from "@mui/material";
import { motion } from "framer-motion";
import PropTypes from "prop-types";

const ProjectCard = ({ project, onClick }) => {
  return (
    <Paper
      component={motion.div}
      whileHover={{
        y: -4,
        boxShadow: "0 10px 20px rgba(255,165,0,0.2)",
        transition: { duration: 0.2 },
      }}
      elevation={2}
      sx={{
        p: 2,
        mb: 2,
        borderRadius: "8px",
        background: "rgba(35, 35, 35, 0.7)",
        borderLeft: "3px solid #FFA500",
        overflow: "hidden",
      }}
      cursor="pointer"
      onClick={() => onClick(project)}
    >
      <Typography
        variant="subtitle1"
        sx={{
          fontWeight: "bold",
          mb: 1,
          color: "white",
        }}
      >
        {project.title}
      </Typography>

      <Typography
        variant="body2"
        sx={{
          mb: 2,
          color: "rgba(255,255,255,0.7)",
        }}
      >
        {project.summary}
      </Typography>

      {project.codeLink && (
        <Box
          sx={{
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          <motion.div whileHover={{ x: 3 }}>
            <Link
              href={project.codeLink}
              target="_blank"
              rel="noopener noreferrer"
              sx={{
                display: "flex",
                alignItems: "center",
                color: "#FFA500",
                textDecoration: "none",
                fontSize: "0.8rem",
                fontWeight: "medium",
                "&:hover": {
                  color: "#FFD700",
                  textDecoration: "underline",
                },
              }}
            >
              Xem dự án
              <OpenInNewIcon sx={{ ml: 0.5, fontSize: "0.9rem" }} />
            </Link>
          </motion.div>
        </Box>
      )}
    </Paper>
  );
};

ProjectCard.propTypes = {
  project: PropTypes.shape({
    title: PropTypes.string.isRequired,
    summary: PropTypes.string.isRequired,
    description: PropTypes.string,
    demoLink: PropTypes.string,
    codeLink: PropTypes.string,
    techStack: PropTypes.arrayOf(PropTypes.string),
    timeline: PropTypes.string,
    role: PropTypes.string,
  }).isRequired,
  onClick: PropTypes.func.isRequired,
};

export default ProjectCard;
