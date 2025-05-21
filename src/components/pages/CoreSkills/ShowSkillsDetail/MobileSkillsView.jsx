// src/components/MobileSkillsView.jsx
import { Box, Chip, Stack, Typography } from "@mui/material";
import gsap from "gsap";
import PropTypes from "prop-types";
import { useEffect, useRef, useState } from "react";
import MobileSummaryModal from "../../../ui/mobile_summary_modal";

// Skill level indicator component
const SkillLevel = ({ level }) => {
  return (
    <Box sx={{ width: "100%", mt: 1, mb: 2 }}>
      <Box
        sx={{
          height: "6px",
          width: "100%",
          backgroundColor: "rgba(251, 146, 60, 0.2)",
          borderRadius: "3px",
          position: "relative",
        }}
      >
        <Box
          sx={{
            height: "100%",
            width: `${level}%`,
            backgroundColor: "rgb(251, 146, 60)",
            borderRadius: "3px",
            position: "relative",
            "&::after": {
              content: '""',
              position: "absolute",
              right: 0,
              top: "-2px",
              height: "10px",
              width: "10px",
              borderRadius: "50%",
              backgroundColor: "rgb(251, 146, 60)",
            },
          }}
        />
      </Box>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          mt: 0.5,
        }}
      >
        <Typography variant="caption" sx={{ color: "text.secondary" }}>
          Beginner
        </Typography>
        <Typography variant="caption" sx={{ color: "text.secondary" }}>
          Expert ({level}%)
        </Typography>
      </Box>
    </Box>
  );
};

const MobileSkillsView = ({ onClose, skills }) => {
  const [selectedCategory, setSelectedCategory] = useState("all");
  const contentRef = useRef(null);
  const skillsRef = useRef(null);

  // Categories for filtering
  const categories = [
    { id: "all", label: "All Skills" },
    { id: "frontend", label: "Frontend" },
    { id: "framework", label: "Frameworks" },
    { id: "language", label: "Languages" },
    { id: "tools", label: "Tools" },
  ];

  // Helper function to determine skill category
  const getSkillCategory = (skill) => {
    if (
      skill.name.includes("React") ||
      skill.name.includes("CSS") ||
      skill.name.includes("HTML") ||
      skill.name.includes("UI")
    )
      return "frontend";
    if (
      skill.name.includes("Next") ||
      skill.name.includes("Vue") ||
      skill.name.includes("Angular")
    )
      return "framework";
    if (
      skill.name.includes("JavaScript") ||
      skill.name.includes("TypeScript") ||
      skill.name.includes("Dart")
    )
      return "language";
    if (
      skill.name.includes("GSAP") ||
      skill.name.includes("Git") ||
      skill.name.includes("Webpack")
    )
      return "tools";
    return "frontend"; // Default category
  };

  // Filter skills based on selected category
  const filteredSkills =
    selectedCategory === "all"
      ? skills
      : skills.filter((skill) => getSkillCategory(skill) === selectedCategory);

  // Animation for filter chips
  useEffect(() => {
    if (!contentRef.current) return;

    // Animate category change
    if (skillsRef.current) {
      gsap.fromTo(
        skillsRef.current.children,
        {
          opacity: 0,
          y: 15,
        },
        {
          opacity: 1,
          y: 0,
          stagger: 0.05,
          duration: 0.4,
          ease: "power2.out",
        }
      );
    }
  }, [selectedCategory]);

  return (
    <MobileSummaryModal onClose={onClose}>
      <Box ref={contentRef}>
        <Box className="mb-4 pb-2 border-b border-gray-200">
          <Typography
            variant="h6"
            className="text-gray-800 font-medium"
            sx={{ fontSize: "1.25rem" }}
          >
            Technical Skills
          </Typography>
        </Box>
        <Box
          className="w-20 h-1 bg-orange-400 mb-4"
          sx={{ borderRadius: "2px" }}
        />

        {/* Filter Categories */}
        <Box
          sx={{
            mb: 3,
            pb: 1,
            overflowX: "auto",
            display: "flex",
            flexWrap: "nowrap",
          }}
        >
          <Stack
            direction="row"
            spacing={1}
            sx={{
              pb: 1,
              minWidth: "min-content",
              "&::-webkit-scrollbar": { height: "4px" },
              "&::-webkit-scrollbar-thumb": {
                backgroundColor: "rgba(251, 146, 60, 0.4)",
                borderRadius: "4px",
              },
            }}
          >
            {categories.map((category) => (
              <Chip
                key={category.id}
                label={category.label}
                variant={
                  selectedCategory === category.id ? "filled" : "outlined"
                }
                color="warning"
                size="small"
                onClick={() => setSelectedCategory(category.id)}
                sx={{
                  fontWeight: selectedCategory === category.id ? 500 : 400,
                  transition: "all 0.2s",
                  whiteSpace: "nowrap",
                }}
              />
            ))}
          </Stack>
        </Box>

        {/* Skills List */}
        <Box ref={skillsRef} sx={{ mb: 4 }}>
          {filteredSkills.map((skill) => (
            <Box
              key={skill.id}
              sx={{
                mb: 3,
                p: 2,
                borderRadius: "12px",
                backgroundColor: "rgba(251, 146, 60, 0.05)",
                border: "1px solid rgba(251, 146, 60, 0.2)",
                transition: "all 0.3s",
                "&:hover": {
                  backgroundColor: "rgba(251, 146, 60, 0.1)",
                  transform: "translateY(-2px)",
                  boxShadow: "0 4px 12px rgba(251, 146, 60, 0.15)",
                },
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
                {skill.icon && (
                  <Box
                    sx={{
                      width: 32,
                      height: 32,
                      mr: 1.5,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: "8px",
                      backgroundColor: "rgba(251, 146, 60, 0.1)",
                      padding: "5px",
                    }}
                  >
                    <img
                      src={skill.icon}
                      alt={skill.name}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "contain",
                      }}
                    />
                  </Box>
                )}
                <Typography
                  variant="subtitle1"
                  sx={{
                    fontWeight: 600,
                    color: "text.primary",
                  }}
                >
                  {skill.name}
                </Typography>
              </Box>

              <Typography
                variant="body2"
                sx={{
                  mb: 1,
                  color: "text.secondary",
                  fontSize: "0.875rem",
                  lineHeight: 1.5,
                }}
              >
                {skill.description}
              </Typography>

              <SkillLevel level={skill.level} />

              <Typography
                variant="caption"
                sx={{
                  display: "block",
                  color: "text.secondary",
                  fontStyle: "italic",
                }}
              >
                {skill.experience}
              </Typography>
            </Box>
          ))}

          {filteredSkills.length === 0 && (
            <Box
              sx={{
                textAlign: "center",
                py: 4,
                color: "text.secondary",
              }}
            >
              <Typography>No skills in this category</Typography>
            </Box>
          )}
        </Box>

        <Box
          className="w-full py-3 text-center text-white font-medium rounded-lg bg-orange-500"
          onClick={onClose}
          sx={{
            cursor: "pointer",
            marginTop: "16px",
            "&:hover": { backgroundColor: "rgb(249, 115, 22)" },
          }}
        >
          Close
        </Box>
      </Box>
    </MobileSummaryModal>
  );
};

SkillLevel.propTypes = {
  level: PropTypes.number.isRequired,
};

MobileSkillsView.propTypes = {
  onClose: PropTypes.func.isRequired,
  skills: PropTypes.array.isRequired,
};

export default MobileSkillsView;
