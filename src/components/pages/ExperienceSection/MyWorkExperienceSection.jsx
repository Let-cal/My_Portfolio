// src/components/pages/ExperienceSection/MyWorkExperienceSection.jsx
import { Box, Container, Typography } from "@mui/material";
import { motion } from "framer-motion";
import PropTypes from "prop-types";
import { useMemo, useState } from "react";
import WorkDetailModal from "./WorkDetailModal";
import WorkExperienceRow from "./WorkExperienceRow";

// Container animation variants
const sectionVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
      delayChildren: 0.2,
    },
  },
};

// Parse date format like "Sep 2023", "Sep 2023 - Jul 2024"
const parsePeriod = (period) => {
  // If period contains "–" or "-", get the later date (end date)
  const dates = period.split(/\s*[–-]\s*/);
  const lastDate = dates[dates.length - 1].trim();

  // Extract month and year
  const parts = lastDate.split(" ");
  let month = 0;
  let year = 0;

  // Convert month name to number
  const months = {
    Jan: 1,
    Feb: 2,
    Mar: 3,
    Apr: 4,
    May: 5,
    Jun: 6,
    Jul: 7,
    Aug: 8,
    Sep: 9,
    Oct: 10,
    Nov: 11,
    Dec: 12,
  };

  if (parts.length === 2) {
    month = months[parts[0]] || 0;
    year = parseInt(parts[1]) || 0;
  } else if (parts.length === 1) {
    year = parseInt(parts[0]) || 0;
  }

  return new Date(year, month, 1).getTime();
};

// Sort projects by date (oldest first)
const sortProjectsByDate = (projects) => {
  return [...projects].sort((a, b) => {
    const dateA = parsePeriod(a.period || a.timeline || "");
    const dateB = parsePeriod(b.period || b.timeline || "");
    return dateA - dateB; // Ascending order (oldest first)
  });
};

export default function MyWorkExperienceSection({ projects }) {
  // Process and sort projects by date (memoized)
  const sortedProjects = useMemo(
    () => sortProjectsByDate(projects),
    [projects]
  );

  // Modal state management
  const [selectedProject, setSelectedProject] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleOpenModal = (project) => {
    setSelectedProject(project);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  // Prepare projects with required fields if missing
  const processedProjects = useMemo(() => {
    return sortedProjects.map((project) => ({
      ...project,
      period: project.period || project.timeline || "",
      role: project.role || "",
    }));
  }, [sortedProjects]);

  return (
    <Box
      component="section"
      id="experience"
      sx={{
        py: { xs: 8, md: 12 },
        px: { xs: 3, md: 6 },
        bgcolor: "#111",
        color: "#fff",
      }}
    >
      <Container maxWidth="lg">
        <Typography
          variant="h2"
          component="h2"
          align="center"
          sx={{
            mb: { xs: 6, md: 10 },
            fontWeight: 700,
            color: "#fff",
            fontSize: { xs: "2rem", sm: "2.5rem", md: "3rem" },
          }}
        >
          My{" "}
          <Box component="span" sx={{ color: "#fb923c" }}>
            Experience
          </Box>
        </Typography>

        {/* Timeline Container */}
        <Box sx={{ position: "relative", minHeight: "200px" }}>
          {/* Timeline vertical line - visible on desktop and tablet */}
          <Box
            sx={{
              position: "absolute",
              left: { xs: "24px", md: "24px" },
              top: 0,
              bottom: 0,
              width: "2px",
              bgcolor: "rgba(255,255,255,0.1)",
              display: { xs: "block", sm: "block" },
              zIndex: 0,
            }}
          />

          {/* Experience rows - staggered animation on scroll */}
          <motion.div
            variants={sectionVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            sx={{
              display: "flex",
              flexDirection: "column",
              // Using flex to ensure consistent spacing
              "& > div": { mb: 2 },
            }}
          >
            {processedProjects.map((project, index) => (
              <WorkExperienceRow
                key={project.title + index}
                project={project}
                index={index}
                onClick={() => handleOpenModal(project)}
                isLast={index === processedProjects.length - 1}
              />
            ))}
          </motion.div>
        </Box>
      </Container>

      {/* Detail Modal */}
      {selectedProject && (
        <WorkDetailModal
          project={selectedProject}
          isOpen={isModalOpen}
          onClose={handleCloseModal}
        />
      )}
    </Box>
  );
}

MyWorkExperienceSection.propTypes = {
  projects: PropTypes.arrayOf(
    PropTypes.shape({
      title: PropTypes.string.isRequired,
      period: PropTypes.string,
      timeline: PropTypes.string,
      role: PropTypes.string,
      location: PropTypes.string,
      summary: PropTypes.string,
      description: PropTypes.string,
      image: PropTypes.string,
      demoLink: PropTypes.string,
      codeWebLink: PropTypes.string,
      codeMbLink: PropTypes.string,
      techStack: PropTypes.arrayOf(PropTypes.string),
    })
  ).isRequired,
};
