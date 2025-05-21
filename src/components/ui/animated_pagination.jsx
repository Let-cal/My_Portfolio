import { Box, useBreakpointValue } from "@chakra-ui/react";
import { motion, useAnimation, useMotionValue } from "framer-motion";
import PropTypes from "prop-types";
import { useCallback, useEffect, useState } from "react";
import DirectionIndicator from "../pages/CoreSkills/DirectionIndicator";

const AnimatedPagination = ({
  dots,
  currentSlide,
  slideDirection,
  hideDirectionIndicator = false,
  onSlideChange,
}) => {
  // Responsive dot spacing
  const dotSpacing = useBreakpointValue({ base: 20, md: 24 }) || 24;
  const initialOffset = 2;

  // State to track if slide animation is in progress
  const [isSliding, setIsSliding] = useState(false);
  const [dragStartPos, setDragStartPos] = useState(0);

  // Motion value for smooth highlight bar x position
  const x = useMotionValue(currentSlide * dotSpacing + initialOffset);
  const controls = useAnimation();

  // Animate x position on currentSlide change with spring easing
  useEffect(() => {
    controls.start({
      x: currentSlide * dotSpacing + initialOffset,
      transition: { type: "spring", stiffness: 280, damping: 30 },
    });
  }, [currentSlide, dotSpacing, initialOffset, controls]);

  // Set sliding state when direction changes
  useEffect(() => {
    if (slideDirection) {
      setIsSliding(true);
    }
  }, [slideDirection]);

  // Handle animation complete
  const handleAnimationComplete = () => {
    setIsSliding(false);
  };

  // Handle dot click to change slide
  const handleDotClick = (index) => {
    if (onSlideChange && index !== currentSlide) {
      onSlideChange(index);
    }
  };

  // Draggable dot functionality
  const handleDragStart = useCallback((event, info) => {
    setDragStartPos(info.point.x);
  }, []);

  const handleDragEnd = useCallback(
    (event, info) => {
      const dragEndPos = info.point.x;
      const dragDistance = dragEndPos - dragStartPos;

      // If drag distance is significant, change slide
      if (Math.abs(dragDistance) > 10 && onSlideChange) {
        const direction = dragDistance > 0 ? -1 : 1; // Negative for left swipe, positive for right
        const nextSlide = Math.max(
          0,
          Math.min(dots.length - 1, currentSlide + direction)
        );

        if (nextSlide !== currentSlide) {
          onSlideChange(nextSlide);
        }
      }
    },
    [dragStartPos, currentSlide, dots.length, onSlideChange]
  );

  // Variants for highlight bar
  const highlightVariants = {
    initial: { opacity: 0, width: 24 },
    animate: { opacity: 1, width: 24, transition: { duration: 0.3 } },
  };

  // Variants for dots (inactive, active, hover)
  const dotVariants = {
    inactive: {
      opacity: 0.6,
      scale: 1,
      backgroundColor: "#ccc",
      transition: { duration: 0.3 },
    },
    active: {
      opacity: 1,
      scale: 1.3,
      backgroundColor: "#fb923c", // Theme orange
      boxShadow: "0 0 8px 2px rgba(251, 146, 60, 0.7)",
      transition: { type: "spring", stiffness: 300, damping: 20 },
    },
    hover: {
      opacity: 1,
      scale: 1.5,
      transition: { type: "spring", stiffness: 400, damping: 15 },
    },
  };

  return (
    <Box
      position="absolute"
      left="0"
      right="0"
      bottom="-30px"
      width="100%"
      display="flex"
      justifyContent="center"
      alignItems="center"
      flexDirection="column"
      padding="10px 0"
    >
      <motion.div
        className="slider-pagination-container"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          position: "relative",
          width: "100%",
          maxWidth: "100%",
        }}
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.15}
        dragTransition={{ bounceStiffness: 600, bounceDamping: 20 }}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        {/* Direction Indicator - positioned above the dots and full width */}
        {!hideDirectionIndicator && (
          <Box
            position="absolute"
            width="100%"
            bottom="-20px"
            zIndex={1}
            left="0"
          >
            <DirectionIndicator
              slideDirection={slideDirection}
              isSliding={isSliding}
              onAnimationComplete={handleAnimationComplete}
            />
          </Box>
        )}

        {/* Dots container */}
        <ul
          style={{
            margin: 0,
            padding: 0,
            listStyle: "none",
            display: "flex",
            justifyContent: "center",
            gap: "8px",
            zIndex: 3,
            position: "relative",
          }}
        >
          {dots.map((dot, index) => (
            <motion.li
              key={index}
              variants={dotVariants}
              initial="inactive"
              animate={index === currentSlide ? "active" : "inactive"}
              whileHover="hover"
              onClick={() => handleDotClick(index)}
              style={{
                width: 12,
                height: 12,
                borderRadius: "50%",
                cursor: "pointer",
                backgroundColor: "#ccc",
              }}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.1}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              {dot}
            </motion.li>
          ))}
        </ul>

        {/* Main highlight bar */}
        <motion.div
          className="pagination-highlight"
          variants={highlightVariants}
          initial="initial"
          style={{
            position: "absolute",
            height: "6px",
            borderRadius: "6px",
            bottom: "-22px",
            zIndex: 2,
            width: 24,
            background: "linear-gradient(90deg, #fb923c, #feb47b)", // Using theme orange
            boxShadow: "0 0 12px 4px rgba(251, 146, 60, 0.8)", // Using theme orange
            x: x,
          }}
          animate={controls}
          key={`highlight-${currentSlide}`}
        />
      </motion.div>
    </Box>
  );
};

AnimatedPagination.propTypes = {
  dots: PropTypes.arrayOf(PropTypes.node).isRequired,
  currentSlide: PropTypes.number.isRequired,
  slideDirection: PropTypes.oneOf(["left", "right", null]),
  hideDirectionIndicator: PropTypes.bool,
  onSlideChange: PropTypes.func,
};

export default AnimatedPagination;
