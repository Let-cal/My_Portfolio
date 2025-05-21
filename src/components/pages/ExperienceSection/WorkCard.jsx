import { Box, Card, CardMedia, Stack, Typography } from "@mui/material";
import { motion } from "framer-motion";
import PropTypes from "prop-types";
import React from "react";

const MotionCard = motion(Card);

const WorkCard = ({ project, index, onClick }) => {
  const cardVariants = {
    hidden: { opacity: 0, y: 50 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.5,
        delay: index * 0.1,
      },
    },
  };

  return (
    <MotionCard
      variants={cardVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true }}
      whileHover={{ scale: 1.03, boxShadow: "0 10px 20px rgba(0,0,0,0.2)" }}
      onClick={onClick}
      sx={{
        p: 4,
        borderRadius: "md",
        boxShadow: "md",
        bgcolor: "white",
        position: "relative",
        overflow: "hidden",
        cursor: "pointer",
        width: "100%",
      }}
      aria-label={`View details of ${project.title}`}
    >
      <CardMedia
        component="img"
        image={project.image}
        alt={project.title}
        sx={{ height: 150, objectFit: "cover", width: "100%" }}
      />
      <Stack direction="column" spacing={1} sx={{ mt: 2 }}>
        <Typography variant="h6" fontWeight="bold" fontSize="lg">
          {project.title}
        </Typography>
        <Typography variant="body2" color="textSecondary" fontSize="sm">
          {project.role}
        </Typography>
        <Typography variant="body2" color="textSecondary" fontSize="sm">
          {project.period}
        </Typography>
      </Stack>
      <Box
        sx={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          bgcolor: "rgba(0,0,0,0.5)",
          opacity: 0,
          transition: "opacity 0.3s ease",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          p: 4,
          "&:hover": { opacity: 1 },
        }}
      >
        <Typography
          variant="body2"
          color="white"
          fontSize="sm"
          textAlign="center"
        >
          {project.summary}
        </Typography>
      </Box>
    </MotionCard>
  );
};

WorkCard.propTypes = {
  project: PropTypes.shape({
    title: PropTypes.string.isRequired,
    image: PropTypes.string.isRequired,
    role: PropTypes.string.isRequired,
    period: PropTypes.string.isRequired,
    summary: PropTypes.string.isRequired,
  }).isRequired,
  index: PropTypes.number.isRequired,
  onClick: PropTypes.func.isRequired,
};

export default React.memo(WorkCard);
