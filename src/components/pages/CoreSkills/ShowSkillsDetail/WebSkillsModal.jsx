// src/components/ShowSkillsDetail/WebSkillsModal.jsx
import { Badge, Box, Flex, Grid, Text } from "@chakra-ui/react";
import { motion } from "framer-motion";
import PropTypes from "prop-types";
import { useState } from "react";
import DetailModal from "../../../ui/detail_modal";
import SkillDetailModal from "../SkillDetailModal";

// Animation variants for smooth transitions
const contentVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05, delayChildren: 0.2 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 500, damping: 30 },
  },
};

const overlayVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.3 } },
  exit: { opacity: 0, transition: { delay: 0.2, duration: 0.3 } },
};

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

export default function WebSkillsModal({ isOpen, onClose, skills }) {
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedSkill, setSelectedSkill] = useState(null);
  const [isSkillDetailOpen, setIsSkillDetailOpen] = useState(false);

  if (!isOpen) return null;

  // Group skills by category
  const categories = ["all", "frontend", "framework", "language", "mobile"];
  const getSkillCategory = (skill) => {
    if (
      skill.name.includes("React") ||
      skill.name.includes("GSAP") ||
      skill.name.includes("Tailwind") ||
      skill.name.includes("Framer")
    )
      return "frontend";
    if (skill.name.includes("Next") || skill.name.includes("Vue"))
      return "framework";
    if (skill.name.includes("JavaScript") || skill.name.includes("TypeScript"))
      return "language";
    if (skill.name.includes("Flutter") || skill.name.includes("Swift"))
      return "mobile";
    return "frontend"; // Default category
  };

  // Filter skills based on selected category
  const filteredSkills =
    selectedCategory === "all"
      ? skills
      : skills.filter((skill) => getSkillCategory(skill) === selectedCategory);

  // Handler for opening skill detail
  const handleOpenSkillDetail = (skill) => {
    setSelectedSkill(skill);
    setIsSkillDetailOpen(true);
  };

  // Handler for closing skill detail
  const handleCloseSkillDetail = () => {
    setIsSkillDetailOpen(false);
    setSelectedSkill(null);
  };

  const additionalContent = (
    <motion.div variants={contentVariants} initial="hidden" animate="visible">
      {/* Category Filter */}
      <motion.div variants={itemVariants} className="mb-6">
        <Text color="orange.300" fontWeight="500" mb={2}>
          Filter by Category:
        </Text>
        <Flex flexWrap="wrap" gap={2}>
          {categories.map((category) => (
            <Badge
              key={category}
              px={3}
              py={1.5}
              cursor="pointer"
              borderRadius="full"
              textTransform="capitalize"
              bg={
                selectedCategory === category
                  ? "orange.500"
                  : "rgba(255,255,255,0.1)"
              }
              color={selectedCategory === category ? "white" : "whiteAlpha.700"}
              fontWeight="medium"
              onClick={() => setSelectedCategory(category)}
              _hover={{
                bg:
                  selectedCategory === category
                    ? "orange.600"
                    : "rgba(255,255,255,0.2)",
              }}
              transition="all 0.2s"
            >
              {category}
            </Badge>
          ))}
        </Flex>
      </motion.div>

      {/* Skills Grid */}
      <motion.div variants={itemVariants}>
        <Grid
          templateColumns={{
            base: "repeat(1, 1fr)",
            sm: "repeat(2, 1fr)",
            md: "repeat(3, 1fr)",
          }}
          gap={4}
          mt={4}
        >
          {filteredSkills.map((skill) => (
            <motion.div
              key={skill.id}
              variants={itemVariants}
              whileHover={{ scale: 1.03, transition: { duration: 0.2 } }}
            >
              <Box
                bg="rgba(255,255,255,0.05)"
                p={4}
                borderRadius="lg"
                borderLeft="3px solid #FFA500"
                boxShadow="0 4px 12px rgba(0,0,0,0.1)"
                transition="all 0.3s"
                _hover={{ bg: "rgba(255,255,255,0.1)" }}
                height="100%"
                display="flex"
                flexDirection="column"
                onClick={() => handleOpenSkillDetail(skill)}
                cursor="pointer"
              >
                <Flex align="center" mb={3}>
                  {skill.icon && (
                    <Box
                      width="36px"
                      height="36px"
                      borderRadius="lg"
                      bg="rgba(0,0,0,0.2)"
                      display="flex"
                      alignItems="center"
                      justifyContent="center"
                      mr={3}
                      p={1.5}
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
                  <Text fontWeight="bold" fontSize="lg" color="whiteAlpha.900">
                    {skill.name}
                  </Text>
                </Flex>

                <Box mb={3} flexGrow={1}>
                  <Text color="whiteAlpha.700" fontSize="sm" mb={2}>
                    {skill.description}
                  </Text>
                </Box>

                <Flex justify="space-between" align="center" mt="auto">
                  <Badge colorScheme="orange" borderRadius="full" px={2}>
                    {skill.level}% Proficiency
                  </Badge>
                  <Text fontSize="sm" color="orange.300">
                    {skill.experience?.split(" ")[0]}
                  </Text>
                </Flex>
              </Box>
            </motion.div>
          ))}
        </Grid>
      </motion.div>

      {/* If no skills match the filter */}
      {filteredSkills.length === 0 && (
        <Box textAlign="center" py={8} color="whiteAlpha.700">
          <Text>No skills found in this category</Text>
        </Box>
      )}
    </motion.div>
  );

  return (
    <>
      <motion.div
        key="modal-overlay"
        variants={overlayVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0,0,0,0.7)",
          backdropFilter: "blur(8px)",
          zIndex: 0, // Increased z-index to ensure modal appears above other elements
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 20,
        }}
        onClick={onClose}
      >
        <motion.div
          key="modal-content"
          variants={modalVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          style={{
            maxWidth: "800px",
            maxHeight: "600px", // Limit height to prevent overflow
            overflowY: "hidden", // Enable scrolling if content is too tall
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <DetailModal
            onClose={onClose}
            title="My Technical Skills"
            additionalContent={additionalContent}
            footerContent={null}
            description="A comprehensive overview of my technical skills, expertise levels, and experience. These skills have been developed through hands-on experience in production environments and various professional projects."
          />
        </motion.div>
      </motion.div>

      {/* Nested SkillDetailModal */}
      {selectedSkill && (
        <SkillDetailModal
          skill={selectedSkill}
          isOpen={isSkillDetailOpen}
          onClose={handleCloseSkillDetail}
        />
      )}
    </>
  );
}

WebSkillsModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  skills: PropTypes.array.isRequired,
};
