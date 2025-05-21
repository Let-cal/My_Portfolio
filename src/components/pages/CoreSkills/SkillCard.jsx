import { Box } from "@chakra-ui/react";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import {
  Card,
  CardActions,
  CardContent,
  IconButton,
  LinearProgress,
  Box as MuiBox,
  Tooltip,
  Typography,
} from "@mui/material";
import { motion } from "framer-motion";
import PropTypes from "prop-types";
import { memo, useRef, useState } from "react";

const SkillCard = ({ skill, onShowDetail }) => {
  // Track dragging state to prevent opening modal when dragging
  const [isDragging, setIsDragging] = useState(false);
  const startPos = useRef(0);
  const moveThreshold = 10; // pixels needed to consider as dragging

  const getLevelText = (level) => {
    if (level >= 90) return "Chuyên gia";
    if (level >= 75) return "Nâng cao";
    if (level >= 60) return "Trung cấp";
    return "Cơ bản";
  };

  const getLevelColor = (level) => {
    if (level >= 90) return "success";
    if (level >= 75) return "primary";
    if (level >= 60) return "warning";
    return "error";
  };

  // Handle mouse/touch down
  const handlePointerDown = (e) => {
    startPos.current = e.clientX || (e.touches && e.touches[0].clientX) || 0;
    setIsDragging(false);
  };

  // Handle mouse/touch move
  const handlePointerMove = (e) => {
    const clientX = e.clientX || (e.touches && e.touches[0].clientX) || 0;
    if (Math.abs(clientX - startPos.current) > moveThreshold) {
      setIsDragging(true);
    }
  };

  // Handle card click while avoiding drag triggers
  const handleCardClick = (e) => {
    // Only trigger if it's a genuine click (not a drag)
    if (!isDragging && e.detail === 1) {
      console.log("Card clicked, skill:", skill);
      onShowDetail(skill);
    }

    // Reset dragging state
    setIsDragging(false);
  };

  return (
    <Card
      sx={{
        position: "relative",
        height: "270px",
        display: "flex",
        flexDirection: "column",
        cursor: "pointer",
        background: "rgba(35, 35, 35, 0.7)",
        backdropFilter: "blur(10px)",
        color: "white",
        border: "1px solid rgba(255, 255, 255, 0.1)",
        borderRadius: "16px",
        transition: "all 0.3s ease",
        boxShadow: "0 4px 30px rgba(0, 0, 0, 0.1)",
        "&:hover": {
          borderColor: "#FFA500",
          boxShadow: "0 8px 32px rgba(255, 165, 0, 0.3)",
          transform: "translateY(-8px)",
        },
      }}
      // Handle pointer events to detect drags vs. clicks
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onClick={handleCardClick}
    >
      <Tooltip title="Xem chi tiết" placement="top">
        <IconButton
          size="small"
          sx={{
            position: "absolute",
            top: 8,
            right: 8,
            color: "rgba(255, 255, 255, 0.7)",
            backgroundColor: "rgba(0, 0, 0, 0.2)",
            "&:hover": {
              backgroundColor: "rgba(255, 165, 0, 0.3)",
              color: "white",
            },
          }}
          onClick={(e) => {
            e.stopPropagation();
            console.log("View details clicked, skill:", skill);
            onShowDetail(skill);
          }}
        >
          <InfoOutlinedIcon fontSize="small" />
        </IconButton>
      </Tooltip>

      <CardContent
        sx={{
          flexGrow: 1,
          display: "flex",
          flexDirection: "column",
          p: 3,
        }}
      >
        <MuiBox
          sx={{
            display: "flex",
            alignItems: "center",
            mb: 3,
          }}
        >
          <MuiBox
            component="div"
            sx={{
              width: 60,
              height: 60,
              mr: 2,
              p: 1.5,
              borderRadius: 2,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(255, 165, 0, 0.2)",
              border: "1px solid rgba(255, 165, 0, 0.3)",
              transition: "transform 0.3s ease",
              "&:hover": {
                transform: "rotate(5deg) scale(1.1)",
              },
            }}
          >
            <Box
              as="img"
              src={skill.icon}
              alt={skill.name}
              loading="lazy"
              sx={{
                width: "100%",
                height: "100%",
                objectFit: "contain",
                filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.3))",
              }}
            />
          </MuiBox>
          <Typography
            variant="h6"
            component="div"
            sx={{
              fontWeight: "bold",
              fontSize: "1.1rem",
              color: "white",
              textShadow: "0 1px 2px rgba(0,0,0,0.7)",
            }}
          >
            {skill.name}
          </Typography>
        </MuiBox>

        <MuiBox sx={{ width: "100%", mb: 2 }}>
          <MuiBox
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              mb: 0.5,
            }}
          >
            <Typography variant="body2" color="rgba(255, 255, 255, 0.7)">
              Trình độ
            </Typography>
            <Typography
              variant="body2"
              sx={{
                fontWeight: "bold",
                color:
                  skill.level >= 90
                    ? "#4CAF50"
                    : skill.level >= 75
                    ? "#2196F3"
                    : skill.level >= 60
                    ? "#FF9800"
                    : "#F44336",
              }}
            >
              {getLevelText(skill.level)}
            </Typography>
          </MuiBox>

          <LinearProgress
            variant="determinate"
            value={skill.level}
            color={getLevelColor(skill.level)}
            sx={{
              height: 10,
              borderRadius: 5,
              backgroundColor: "rgba(255, 255, 255, 0.15)",
              "& .MuiLinearProgress-bar": {
                borderRadius: 5,
              },
            }}
          />
        </MuiBox>

        <Typography
          variant="body2"
          color="rgba(255, 255, 255, 0.7)"
          sx={{
            flexGrow: 1,
            mb: 2,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {skill.description || "Không có mô tả"}
        </Typography>
      </CardContent>

      <CardActions
        sx={{
          justifyContent: "flex-end",
          p: 2,
          pt: 0,
        }}
      >
        <Typography
          component={motion.div}
          whileHover={{ x: 5 }}
          variant="button"
          sx={{
            color: "#FFA500",
            fontWeight: "bold",
            fontSize: "0.8rem",
            textTransform: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            "&:hover": {
              color: "#FFD700",
            },
          }}
          onClick={(e) => {
            e.stopPropagation();
            if (!isDragging) {
              onShowDetail(skill);
            }
          }}
        >
          Xem chi tiết →
        </Typography>
      </CardActions>
    </Card>
  );
};

SkillCard.propTypes = {
  skill: PropTypes.shape({
    id: PropTypes.string,
    name: PropTypes.string.isRequired,
    icon: PropTypes.string.isRequired,
    level: PropTypes.number.isRequired,
    description: PropTypes.string,
    experience: PropTypes.string,
    projects: PropTypes.arrayOf(
      PropTypes.shape({
        name: PropTypes.string.isRequired,
        description: PropTypes.string.isRequired,
        link: PropTypes.string,
      })
    ),
  }).isRequired,
  onShowDetail: PropTypes.func.isRequired,
};

// Use memo to prevent unnecessary re-renders
export default memo(SkillCard);
