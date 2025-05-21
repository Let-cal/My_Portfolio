import { Box } from "@chakra-ui/react";
import gsap from "gsap";
import PropTypes from "prop-types";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

/**
 * Direction Indicator component that shows a progress bar animation
 * when user drags/slides the carousel
 *
 * @param {Object} props
 * @param {string} props.slideDirection - The direction of the slide ("left" or "right")
 * @param {boolean} props.isSliding - Whether the carousel is currently sliding
 * @param {function} props.onAnimationComplete - Callback function when animation completes
 */
const DirectionIndicator = ({
  slideDirection,
  isSliding,
  onAnimationComplete,
}) => {
  // Refs for container and active bar
  const containerRef = useRef(null);
  const activeBarRef = useRef(null);

  // GSAP context for cleanup
  const ctx = useRef(null);

  // Track animation state
  const [, setAnimationInProgress] = useState(false);

  // Setup GSAP context for proper cleanup
  useLayoutEffect(() => {
    // Create a new context
    ctx.current = gsap.context(() => {}, containerRef);

    // Cleanup function
    return () => ctx.current.revert();
  }, []);

  // Handle slide direction change
  useEffect(() => {
    if (!slideDirection || !isSliding || !containerRef.current) return;

    setAnimationInProgress(true);

    // Get container width for animation
    const containerWidth = containerRef.current.offsetWidth;

    // Create timeline
    const tl = gsap.timeline({
      onComplete: () => {
        setAnimationInProgress(false);
        if (onAnimationComplete) onAnimationComplete();
      },
    });

    // Animation based on slide direction
    if (slideDirection === "right") {
      // Reset active bar position before animation - Right direction
      gsap.set(activeBarRef.current, {
        x: 0,
        width: "0%",
        opacity: 0.6,
        boxShadow: "0 0 8px 2px rgba(255,165,0,0.7)",
        backgroundColor: "#Ffffff",
      });

      // Start from left to right
      tl.to(activeBarRef.current, {
        width: "100%",
        opacity: 1,
        boxShadow: "0 0 8px 2px rgba(255,165,0,0.7)",
        duration: 0.6,
        ease: "power1.in",
        backgroundColor: "#FFA500",
      });
    } else if (slideDirection === "left") {
      // Reset active bar position before animation - Left direction
      gsap.set(activeBarRef.current, {
        x: containerWidth,
        width: "0%",
        opacity: 0.6,
        boxShadow: "0 0 8px 2px rgba(255,165,0,0.7)",
        backgroundColor: "#Ffffff",
      });

      // Start from right to left
      tl.to(activeBarRef.current, {
        x: 0,
        width: "100%",
        opacity: 1,
        boxShadow: "0 0 8px 2px rgba(255,165,0,0.7)",
        duration: 0.6,
        ease: "power1.in",
        backgroundColor: "#FFA500",
      });
    }

    // Add to context for cleanup
    ctx.current.add(tl);
  }, [slideDirection, isSliding, onAnimationComplete]);

  return (
    <Box
      ref={containerRef}
      position="relative"
      width="100%"
      height="6px"
      borderRadius="6px"
      background="#000"
      mt="10px"
      overflow="hidden"
    >
      {/* Active progress bar */}
      <Box
        ref={activeBarRef}
        position="absolute"
        height="100%"
        width="0%"
        borderRadius="6px"
      />
    </Box>
  );
};

DirectionIndicator.propTypes = {
  slideDirection: PropTypes.oneOf(["left", "right", null]),
  isSliding: PropTypes.bool,
  onAnimationComplete: PropTypes.func,
};

DirectionIndicator.defaultProps = {
  slideDirection: null,
  isSliding: false,
};

export default DirectionIndicator;
